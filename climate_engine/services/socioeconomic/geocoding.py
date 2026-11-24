"""
climate_engine/services/socioeconomic/geocoding.py — Geocoding providers (Photon, Open-Meteo, Nominatim).
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import unicodedata
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set

import httpx
import pycountry

from .fallback import get_tier_for_country

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "ClimateRisk-Engine/2.1 (https://github.com/aakash029-coder/openplanet-climate; research)",
    "Accept": "application/json",
}

OPEN_METEO_SEMAPHORE = asyncio.Semaphore(10)
NOMINATIM_SEMAPHORE = asyncio.Semaphore(1)


# ── Country hint helpers ───────────────────────────────────────────────────────

_COUNTRY_ALIASES: Dict[str, str] = {
    "uk": "GB", "england": "GB", "britain": "GB", "great britain": "GB",
    "scotland": "GB", "wales": "GB", "northern ireland": "GB",
    "usa": "US", "america": "US", "united states of america": "US",
    "uae": "AE", "emirates": "AE",
    "south korea": "KR", "korea": "KR",
    "north korea": "KP",
    "russia": "RU",
    "iran": "IR", "persia": "IR",
    "vietnam": "VN", "viet nam": "VN",
    "laos": "LA",
    "bolivia": "BO",
    "taiwan": "TW",
    "moldova": "MD",
    "czechia": "CZ", "czech republic": "CZ",
    "syria": "SY",
    "tanzania": "TZ",
    "congo": "CD",
    "ivory coast": "CI", "cote d'ivoire": "CI",
}


def _country_codes_from_hint(hint: str) -> Set[str]:
    """Map a country name or ISO code hint to alpha-2 codes."""
    normalized = hint.strip().lower()
    if not normalized:
        return set()

    if normalized in _COUNTRY_ALIASES:
        return {_COUNTRY_ALIASES[normalized]}

    codes: Set[str] = set()
    for country in pycountry.countries:
        names = {country.name.lower()}
        if getattr(country, "common_name", None):
            names.add(country.common_name.lower())
        official = getattr(country, "official_name", None)
        if official:
            names.add(official.lower())

        if normalized in names:
            codes.add(country.alpha_2.upper())
        if normalized in (country.alpha_2.lower(), country.alpha_3.lower()):
            codes.add(country.alpha_2.upper())

    return codes


def _location_country_hint(location: str) -> Optional[str]:
    """Return the country token from 'City, Country' or 'City Country' queries."""
    if "," in location:
        parts = [p.strip() for p in location.split(",") if p.strip()]
        return parts[-1] if len(parts) >= 2 else None

    words = location.strip().split()
    if len(words) >= 2:
        last = words[-1]
        if _country_codes_from_hint(last):
            return last
    return None


def _city_token_for_geocoder(location: str) -> str:
    """Return the city-only portion of a query, stripping any trailing country token."""
    hint = _location_country_hint(location)
    if hint:
        if "," in location:
            return location.split(",")[0].strip()
        words = location.strip().split()
        return " ".join(words[:-1]).strip() or location
    return location.split(",")[0].strip()


# ── Keyword cleaner ────────────────────────────────────────────────────────────

def _clean_city_keyword(raw_city: str) -> str:
    """
    Strips administrative prefixes to extract the core geographical entity.
    """
    cleaned = re.sub(r",\s*undefined\b", "", raw_city, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"\bundefined\b", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = cleaned.strip(",;. ").strip()

    parts = [p.strip() for p in cleaned.split(",")]
    core_city = parts[0]

    noise_patterns = [
        r"^special\s+capital\s+region\s+of\s+",
        r"^national\s+capital\s+region\s+of\s+",
        r"^national\s+capital\s+territory\s+of\s+",
        r"^federal\s+territory\s+of\s+",
        r"^province\s+of\s+",
        r"^state\s+of\s+",
        r"^city\s+of\s+",
        r"^greater\s+",
        r"^municipality\s+of\s+",
        r"^metropolitan\s+area\s+of\s+",
        r"^metropolitan\s+",
        r"^urban\s+area\s+of\s+",
    ]
    for pattern in noise_patterns:
        core_city = re.sub(pattern, "", core_city, flags=re.IGNORECASE).strip()

    if not core_city:
        return raw_city

    parts[0] = core_city
    return ", ".join(p for p in parts if p)


def _prepare_geocoding_query(raw_city: str) -> str:
    """Normalize client artifacts while preserving the full location string."""
    return _clean_city_keyword(raw_city.strip())


# ── Result dataclasses ────────────────────────────────────────────────────────

@dataclass(frozen=True, slots=True)
class GeocodingResult:
    city_population: int
    country_code: str
    latitude: float
    longitude: float
    source: str
    elevation: float = 0.0
    elevation_source: str = "unresolved"


@dataclass(frozen=True, slots=True)
class GeocodingCandidate:
    id: str
    name: str
    display_name: str
    country: str
    country_code: str
    latitude: float
    longitude: float
    source: str


# ── Null-island & DEM elevation ────────────────────────────────────────────────

# Plausible global elevation band (Dead Sea ≈ −430 m, habitable max ≈ La Rinconada
# ~5100 m). Anything outside is treated as a bad DEM read.
_ELEVATION_MIN_M = -450.0
_ELEVATION_MAX_M = 6000.0


def _is_null_island(lat: float, lng: float) -> bool:
    """True for the (0,0) Gulf-of-Guinea 'null island' geocoder leak."""
    return abs(lat) < 0.01 and abs(lng) < 0.01


async def _fetch_dem_elevation(
    lat: float, lng: float, client: httpx.AsyncClient
) -> tuple[float, str]:
    """
    Authoritative DEM point elevation, reconciled across two free sources:
      1. Open-Meteo Elevation API (Copernicus DEM GLO-90)
      2. Open-Topo-Data SRTM 30 m (fallback)

    Disk-cached and retried on 429 so a transient rate limit (common on the HF
    shared IP) does not silently degrade to 0.0. Returns (elevation_m, source);
    returns (0.0, 'unresolved') only if both sources truly fail — never fabricates.
    """
    from climate_engine.services.disk_cache import disk_get, disk_set

    cache_key = f"dem_elev_{round(lat, 4)}_{round(lng, 4)}"
    cached = disk_get(cache_key, ttl=86400 * 90)
    if cached is not None:
        return cached[0], cached[1]

    # Primary: Open-Meteo Elevation (Copernicus DEM), with 429 backoff.
    for attempt in range(1, 4):
        try:
            resp = await client.get(
                "https://api.open-meteo.com/v1/elevation",
                params={"latitude": lat, "longitude": lng},
                timeout=8.0,
            )
            if resp.status_code == 429:
                await asyncio.sleep(2 ** attempt)
                continue
            resp.raise_for_status()
            arr = resp.json().get("elevation", [])
            if arr and arr[0] is not None:
                elev = float(arr[0])
                if _ELEVATION_MIN_M <= elev <= _ELEVATION_MAX_M:
                    disk_set(cache_key, [round(elev, 1), "open_meteo_copernicus_dem"])
                    return round(elev, 1), "open_meteo_copernicus_dem"
            break
        except Exception as exc:
            logger.warning("[elevation] Open-Meteo DEM attempt %d failed for (%.4f,%.4f): %s", attempt, lat, lng, exc)
            if attempt < 3:
                await asyncio.sleep(2 ** attempt)

    # Fallback: Open-Topo-Data SRTM 30 m
    try:
        resp = await client.get(
            "https://api.opentopodata.org/v1/srtm30m",
            params={"locations": f"{lat},{lng}"},
            timeout=10.0,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if results and results[0].get("elevation") is not None:
            elev = float(results[0]["elevation"])
            if _ELEVATION_MIN_M <= elev <= _ELEVATION_MAX_M:
                disk_set(cache_key, [round(elev, 1), "opentopodata_srtm30m"])
                return round(elev, 1), "opentopodata_srtm30m"
    except Exception as exc:
        logger.warning("[elevation] Open-Topo-Data failed for (%.4f,%.4f): %s", lat, lng, exc)

    return 0.0, "unresolved"


async def _finalize_geocode(
    result: GeocodingResult, client: httpx.AsyncClient
) -> GeocodingResult:
    """Reject null-island leaks and attach a DEM-reconciled point elevation."""
    from dataclasses import replace

    if _is_null_island(result.latitude, result.longitude):
        raise ValueError(
            f"Geocoder returned null-island (0,0) for source '{result.source}' — rejected."
        )

    elev, elev_src = await _fetch_dem_elevation(result.latitude, result.longitude, client)
    return replace(result, elevation=elev, elevation_source=elev_src)


# ── Hit selectors ─────────────────────────────────────────────────────────────

def _select_openmeteo_hit(results: List[Dict[str, Any]], location_query: str) -> Dict[str, Any]:
    """Prefer geocoder hits that match an explicit country hint in the query."""
    country_hint = _location_country_hint(location_query)
    if country_hint:
        codes = _country_codes_from_hint(country_hint)
        if codes:
            matching = [
                r for r in results
                if (r.get("country_code") or "").upper() in codes
            ]
            if matching:
                return max(matching, key=lambda r: r.get("population") or 0)

    return max(results, key=lambda r: r.get("population") or 0)


def _select_nominatim_hit(results: List[Dict[str, Any]], location_query: str) -> Dict[str, Any]:
    """Prefer Nominatim hits that match an explicit country hint in the query."""
    country_hint = _location_country_hint(location_query)
    if country_hint:
        codes = _country_codes_from_hint(country_hint)
        if codes:
            for hit in results:
                cc = (hit.get("address", {}).get("country_code") or "").upper()
                if cc in codes:
                    return hit

    return results[0]


# ── Provider implementations ──────────────────────────────────────────────────

async def _fetch_openmeteo_geocoding(
    location_query: str,
    client: httpx.AsyncClient,
) -> GeocodingResult:
    url = "https://geocoding-api.open-meteo.com/v1/search"
    city_name_only = location_query.split(",")[0].strip()
    params = {"name": city_name_only, "count": 10, "format": "json"}

    data: Dict[str, Any] = {}
    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        async with OPEN_METEO_SEMAPHORE:
            try:
                resp = await client.get(url, params=params, timeout=8.0)
                if resp.status_code == 429:
                    await asyncio.sleep(2 ** attempt)
                    continue
                resp.raise_for_status()
                data = resp.json()
                break
            except Exception as exc:
                if attempt < max_attempts:
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise ValueError(
                        f"Open-Meteo geocoding failed for '{location_query}': {exc}"
                    ) from exc

    results = data.get("results", [])
    if not results:
        raise ValueError(f"Open-Meteo: no results for '{location_query}'")

    hit = _select_openmeteo_hit(results, location_query)
    country_code = (hit.get("country_code") or "").upper()

    base_population = hit.get("population") or 0
    tier = get_tier_for_country(country_code)

    if base_population > 0:
        metro_population = int(base_population * tier.density_factor)
    else:
        metro_population = int(500_000 * tier.density_factor)

    return GeocodingResult(
        city_population=metro_population,
        country_code=country_code,
        latitude=hit.get("latitude", 0.0),
        longitude=hit.get("longitude", 0.0),
        source="open-meteo",
    )


async def _fetch_nominatim_geocoding(
    location_query: str,
    client: httpx.AsyncClient,
) -> GeocodingResult:
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": location_query,
        "format": "json",
        "limit": 5,
        "addressdetails": 1,
    }

    async with NOMINATIM_SEMAPHORE:
        try:
            nom_headers = {
                **HEADERS,
                "User-Agent": "ClimateRisk-Research/2.1 (https://github.com/aakash029-coder/openplanet-climate; officialaakash029@gmail.com)",
            }
            await asyncio.sleep(1.1)
            resp = await client.get(url, params=params, headers=nom_headers, timeout=15.0)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            raise ValueError(
                f"Nominatim geocoding failed for '{location_query}': {exc}"
            ) from exc

    if not data:
        raise ValueError(f"Nominatim: no results for '{location_query}'")

    hit = _select_nominatim_hit(data, location_query)
    address = hit.get("address", {})
    country_code = (address.get("country_code") or "").upper()

    tier = get_tier_for_country(country_code)
    fallback_population = int(1_000_000 * tier.density_factor)

    return GeocodingResult(
        city_population=fallback_population,
        country_code=country_code,
        latitude=float(hit.get("lat", 0)),
        longitude=float(hit.get("lon", 0)),
        source="nominatim",
    )


# Populated-place points must outrank administrative-boundary centroids: an admin
# polygon's centroid drifts off the city (Lisbon *District* centroid is ~30 km N of
# the city at 339 m vs the city itself at ~10 m — the root of the elevation bug).
_PHOTON_PLACE_RANK = {
    "city": 0, "town": 1, "municipality": 2, "borough": 3,
    "village": 4, "suburb": 5, "locality": 6, "hamlet": 7,
}

_ADMIN_SUFFIX_PATTERN = re.compile(
    r"\s+(?:Governorate|District|Tehsil|Tahsil|Taluka|Taluk|Sub-division|Subdivision|Sadar|Suburb|Municipality|Prefecture|County|City\s+Corporation|Metropolitan\s+Area)$",
    re.IGNORECASE,
)
_ADMIN_PREFIX_PATTERN = re.compile(
    r"^(?:Governorate\s+of|District\s+of|Municipality\s+of|County\s+of|Prefecture\s+of|City\s+of)\s+",
    re.IGNORECASE,
)

_SUB_CITY_ROLLUP = {
    "andheri": {"city": "Mumbai", "country": "India"},
    "borivali": {"city": "Mumbai", "country": "India"},
    "bandra": {"city": "Mumbai", "country": "India"},
    "juhu": {"city": "Mumbai", "country": "India"},
    "dadar": {"city": "Mumbai", "country": "India"},
    "kurla": {"city": "Mumbai", "country": "India"},
    "powai": {"city": "Mumbai", "country": "India"},
    "colaba": {"city": "Mumbai", "country": "India"},
    "manhattan": {"city": "New York", "country": "United States"},
    "brooklyn": {"city": "New York", "country": "United States"},
    "queens": {"city": "New York", "country": "United States"},
    "bronx": {"city": "New York", "country": "United States"},
    "staten island": {"city": "New York", "country": "United States"},
    "new cairo": {"city": "Cairo", "country": "Egypt"},
}

_BLOCKED_PLACE_TYPES = {
    "state", "province", "region", "county", "state_district",
    "district", "subdistrict", "suburb", "neighbourhood", "neighborhood",
    "city_district", "quarter", "borough", "ward", "postcode", "postal_code",
    "administrative", "country", "continent",
}


def clean_city_name(raw_name: str) -> str:
    """
    Cleans city name by removing administrative suffixes/prefixes and rolling up sub-cities.
    E.g. 'Varanasi Sadar' -> 'Varanasi', 'Cairo Governorate' -> 'Cairo', 'Andheri' -> 'Mumbai'.
    """
    if not raw_name:
        return ""
    name = raw_name.strip()

    # Handle parenthetical aliases like 'Sohra (Cherrapunji)' or 'Cherrapunji (Sohra)'
    m = re.match(r"^(.*?)\s*\((.*?)\)$", name)
    if m:
        p1, p2 = m.group(1).strip(), m.group(2).strip()
        if "cherrapunji" in p2.lower():
            name = p2
        elif "cherrapunji" in p1.lower():
            name = p1
        else:
            name = p1

    name = _ADMIN_PREFIX_PATTERN.sub("", name).strip()

    for _ in range(3):
        prev = name
        name = _ADMIN_SUFFIX_PATTERN.sub("", name).strip()
        if name == prev:
            break

    low = name.lower()
    if low in _SUB_CITY_ROLLUP:
        return _SUB_CITY_ROLLUP[low]["city"]

    return name


def _photon_feature_rank(feature: Dict[str, Any]) -> int:
    props = feature.get("properties", {})
    osm_key = (props.get("osm_key") or "").lower()
    osm_value = (props.get("osm_value") or "").lower()
    if osm_key == "place" and osm_value in _PHOTON_PLACE_RANK:
        return _PHOTON_PLACE_RANK[osm_value]
    if osm_key == "place":
        return 10
    return 20  # boundary/administrative (county/region/state) — last resort


def _rank_photon_features(features: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Stable-sort Photon features so populated places precede admin-boundary centroids."""
    return sorted(features, key=_photon_feature_rank)


async def _search_photon_candidates(
    query: str, client: httpx.AsyncClient
) -> List[GeocodingCandidate]:
    """Photon geocoder by Komoot — Elasticsearch-backed OSM data."""
    url = "https://photon.komoot.io/api/"
    city_token = _city_token_for_geocoder(query)
    params = {"q": city_token, "limit": 15, "lang": "en"}

    resp = await client.get(url, params=params, headers=HEADERS, timeout=8.0)
    resp.raise_for_status()
    data = resp.json()

    features = data.get("features", [])
    city_features = _rank_photon_features(features)

    country_hint = _location_country_hint(query)
    if country_hint:
        codes = _country_codes_from_hint(country_hint)
        if codes:
            filtered = [
                f for f in city_features
                if (f.get("properties", {}).get("countrycode") or "").upper() in codes
            ]
            if filtered:
                city_features = filtered

    candidates: List[GeocodingCandidate] = []
    seen: set = set()
    for f in city_features:
        if len(candidates) >= 8:
            break
        props = f.get("properties", {})
        coords = f.get("geometry", {}).get("coordinates", [0.0, 0.0])

        osm_value = (props.get("osm_value") or "").lower()
        feat_type = (props.get("type") or "").lower()
        country_code = (props.get("countrycode") or "").upper()
        country = props.get("country", "")
        city_prop = props.get("city")
        name_prop = props.get("name") or ""

        # Exclude standalone states, provinces, regions, counties
        if osm_value in {"state", "province", "region", "county"} or feat_type in {"state", "province", "region", "county"}:
            continue

        # Handle sub-city divisions / suburbs
        if osm_value in {"suburb", "neighbourhood", "neighborhood", "city_district", "quarter", "borough", "ward"} or feat_type in {"suburb", "district"}:
            if city_prop:
                raw_city = city_prop
            elif name_prop.lower() in _SUB_CITY_ROLLUP:
                raw_city = _SUB_CITY_ROLLUP[name_prop.lower()]["city"]
            else:
                continue
        else:
            raw_city = name_prop or city_prop or query.split(",")[0].strip()

        city_name = clean_city_name(raw_city)
        if not city_name or not country:
            continue

        display = f"{city_name}, {country}"
        dedup_key = (city_name.lower(), country.lower())
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        candidates.append(GeocodingCandidate(
            id=f"photon-{props.get('osm_id', len(candidates))}",
            name=city_name,
            display_name=display,
            country=country,
            country_code=country_code,
            latitude=float(coords[1]),
            longitude=float(coords[0]),
            source="photon-osm",
        ))

    return candidates


async def _search_nominatim_candidates(
    query: str, client: httpx.AsyncClient
) -> List[GeocodingCandidate]:
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": query, "format": "json", "limit": 10, "addressdetails": 1, "featuretype": "settlement"}
    nom_headers = {
        **HEADERS,
        "User-Agent": "ClimateRisk-Research/2.1 (https://github.com/aakash029-coder/openplanet-climate; officialaakash029@gmail.com)",
    }

    async with NOMINATIM_SEMAPHORE:
        await asyncio.sleep(1.1)
        resp = await client.get(url, params=params, headers=nom_headers, timeout=15.0)
        resp.raise_for_status()
        data = resp.json()

    candidates: List[GeocodingCandidate] = []
    seen: set = set()
    for r in data:
        if len(candidates) >= 8:
            break
        address = r.get("address", {})
        country = address.get("country", "")
        country_code = (address.get("country_code") or "").upper()
        addr_type = (r.get("addresstype") or "").lower()
        r_type = (r.get("type") or "").lower()
        r_name = r.get("name") or ""

        # Block standalone states, counties, districts
        if addr_type in {"state", "province", "region", "county", "state_district", "subdistrict", "postcode"} or r_type in {"administrative", "state", "county"}:
            city_prop = address.get("city") or address.get("town")
            if city_prop:
                raw_city = city_prop
            else:
                continue
        elif addr_type in {"suburb", "neighbourhood", "neighborhood", "city_district", "quarter", "borough", "ward"} or r_type in {"suburb"}:
            city_prop = address.get("city") or address.get("town")
            if city_prop:
                raw_city = city_prop
            elif r_name.lower() in _SUB_CITY_ROLLUP:
                raw_city = _SUB_CITY_ROLLUP[r_name.lower()]["city"]
            else:
                continue
        else:
            raw_city = address.get("city") or address.get("town") or address.get("municipality") or address.get("village") or r_name

        city_name = clean_city_name(raw_city)
        if not city_name or not country:
            continue

        display = f"{city_name}, {country}"
        dedup_key = (city_name.lower(), country.lower())
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        candidates.append(GeocodingCandidate(
            id=str(r.get("place_id", f"nom-{len(candidates)}")),
            name=city_name,
            display_name=display,
            country=country,
            country_code=country_code,
            latitude=float(r.get("lat", 0)),
            longitude=float(r.get("lon", 0)),
            source="nominatim-osm",
        ))
    return candidates


async def _search_openmeteo_candidates(
    query: str, client: httpx.AsyncClient
) -> List[GeocodingCandidate]:
    url = "https://geocoding-api.open-meteo.com/v1/search"
    country_hint = _location_country_hint(query)
    codes = _country_codes_from_hint(country_hint) if country_hint else set()
    search_name = _city_token_for_geocoder(query) if (codes or "," not in query) else query
    params = {"name": search_name, "count": 10, "format": "json"}

    async with OPEN_METEO_SEMAPHORE:
        resp = await client.get(url, params=params, timeout=8.0)
        resp.raise_for_status()
        data = resp.json()

    results = data.get("results", [])
    if codes:
        filtered = [r for r in results if (r.get("country_code") or "").upper() in codes]
        if filtered:
            results = filtered

    candidates: List[GeocodingCandidate] = []
    seen: set = set()
    for r in results:
        if len(candidates) >= 8:
            break
        fc = (r.get("feature_code") or "").upper()
        country_code = (r.get("country_code") or "").upper()
        country = r.get("country", "")
        raw_name = r.get("name", "")

        # Block administrative divisions (states, counties)
        if fc in {"ADM1", "ADM2", "ADM3", "ADM4", "CONT", "RGN"}:
            continue
        # Suburb / section of populated place
        if fc == "PPLX":
            if raw_name.lower() in _SUB_CITY_ROLLUP:
                raw_city = _SUB_CITY_ROLLUP[raw_name.lower()]["city"]
            else:
                continue
        else:
            raw_city = raw_name

        city_name = clean_city_name(raw_city)
        if not city_name or not country:
            continue

        display = f"{city_name}, {country}"
        dedup_key = (city_name.lower(), country.lower())
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        candidates.append(GeocodingCandidate(
            id=str(r.get("id", f"om-{len(candidates)}")),
            name=city_name,
            display_name=display,
            country=country,
            country_code=country_code,
            latitude=float(r.get("latitude", 0)),
            longitude=float(r.get("longitude", 0)),
            source="open-meteo",
        ))
    return candidates


try:
    _COORDS_VAULT_PATH = os.path.join(
        os.path.dirname(__file__), "../../data/city_coords.json"
    )
    with open(_COORDS_VAULT_PATH, "r", encoding="utf-8") as _f:
        _LOCAL_CITY_COORDS: Dict[str, Any] = json.load(_f)
except Exception:
    _LOCAL_CITY_COORDS = {}


def _search_local_vault_candidates(query: str) -> List[GeocodingCandidate]:
    """Tier 1: Pre-cached local dictionary lookup (instant, 0ms latency)."""
    norm_q = re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFD", query).lower())
    if len(norm_q) < 2:
        return []

    candidates: List[GeocodingCandidate] = []
    seen: set = set()
    for key, data in _LOCAL_CITY_COORDS.items():
        norm_key = re.sub(r"[^a-z0-9]", "", key.lower())
        parts = key.split("_")
        raw_city = parts[0].capitalize()
        city_name = clean_city_name(raw_city)
        country_code = (data.get("country_code") or "").upper()
        country_obj = pycountry.countries.get(alpha_2=country_code)
        country_name = country_obj.name if country_obj else (parts[-1].capitalize() if len(parts) > 1 else "")

        if norm_q in norm_key or norm_key.startswith(norm_q) or norm_q in city_name.lower():
            display = f"{city_name}, {country_name}" if country_name else city_name
            dedup = (city_name.lower(), country_name.lower())
            if dedup in seen:
                continue
            seen.add(dedup)
            lat = float(data.get("lat", 0.0))
            lng = float(data.get("lng", 0.0))
            if _is_null_island(lat, lng):
                continue
            candidates.append(GeocodingCandidate(
                id=f"vault-{key}",
                name=city_name,
                display_name=display,
                country=country_name,
                country_code=country_code,
                latitude=lat,
                longitude=lng,
                source="local-dictionary",
            ))
            if len(candidates) >= 5:
                break
    return candidates


# ── Public API ────────────────────────────────────────────────────────────────

async def search_geocode_candidates(
    query: str, client: httpx.AsyncClient
) -> List[GeocodingCandidate]:
    """
    Returns up to 8 location candidates for autocomplete.
    Chained in exact order:
      1. Tier 1 (Local Dictionary): Check pre-cached cities first (instant, zero latency).
      2. Tier 2 (Open-Meteo API): Fetch from Open-Meteo (handles 99.9% of global cities/towns in <100ms).
      3. Tier 3 (Nominatim Fallback): If Open-Meteo returns empty (e.g. Sola, Ahmedabad), fall back to Nominatim.
      4. Hard Guardrail: Never allow lat = 0, lon = 0.
    """
    location_query = _prepare_geocoding_query(query)

    # ── 1. Tier 1 (Local Dictionary) ──────────────────────────────────────────
    local_candidates = _search_local_vault_candidates(location_query)

    # ── 2. Tier 2 (Open-Meteo API) ────────────────────────────────────────────
    om_candidates: List[GeocodingCandidate] = []
    try:
        om_candidates = await _search_openmeteo_candidates(location_query, client)
    except Exception as e:
        logger.warning("Open-Meteo search failed for '%s': %s", location_query, e)

    candidates: List[GeocodingCandidate] = []
    seen: set = set()

    for c in local_candidates + om_candidates:
        if _is_null_island(c.latitude, c.longitude):
            continue
        key = (c.name.lower(), c.country.lower())
        if key not in seen:
            seen.add(key)
            candidates.append(c)

    if candidates:
        return candidates[:8]

    # ── 3. Tier 3 (Nominatim Fallback) ────────────────────────────────────────
    # If Open-Meteo returns empty (e.g. for specific districts/neighborhoods like 'Sola, Ahmedabad')
    try:
        nom_candidates = await _search_nominatim_candidates(location_query, client)
        for c in nom_candidates:
            if _is_null_island(c.latitude, c.longitude):
                continue
            key = (c.name.lower(), c.country.lower())
            if key not in seen:
                seen.add(key)
                candidates.append(c)
        if candidates:
            return candidates[:8]
    except Exception as e:
        logger.warning("Nominatim search failed for '%s': %s", location_query, e)

    # Optional Tier 3b: Photon fallback if Nominatim also returned empty
    try:
        photon_candidates = await _search_photon_candidates(location_query, client)
        for c in photon_candidates:
            if _is_null_island(c.latitude, c.longitude):
                continue
            key = (c.name.lower(), c.country.lower())
            if key not in seen:
                seen.add(key)
                candidates.append(c)
    except Exception:
        pass

    return candidates[:8]


async def geocode_city(city: str, client: httpx.AsyncClient) -> GeocodingResult:
    """
    Geocode a single location to precise WGS-84 coordinates.
    Chained in exact order:
      Tier 1 (Local Dictionary) -> Tier 2 (Open-Meteo) -> Tier 3 (Nominatim) -> Photon -> Hard Guardrail.
    """
    location_query = _prepare_geocoding_query(city)
    if location_query.lower() != city.strip().lower():
        logger.info("Geocoding query normalized: '%s' -> '%s'", city, location_query)

    def _candidate_to_result(c: GeocodingCandidate) -> GeocodingResult:
        tier = get_tier_for_country(c.country_code)
        return GeocodingResult(
            city_population=int(500_000 * tier.density_factor),
            country_code=c.country_code,
            latitude=c.latitude,
            longitude=c.longitude,
            source=c.source,
        )

    # 1. Tier 1 (Local Dictionary)
    local_candidates = _search_local_vault_candidates(location_query)
    for c in local_candidates:
        if not _is_null_island(c.latitude, c.longitude):
            logger.info("[geocode] Local Dictionary resolved '%s' -> (%.4f, %.4f)", location_query, c.latitude, c.longitude)
            return await _finalize_geocode(_candidate_to_result(c), client)

    # 2. Tier 2 (Open-Meteo API)
    try:
        om_candidates = [
            c for c in await _search_openmeteo_candidates(location_query, client)
            if not _is_null_island(c.latitude, c.longitude)
        ]
        if om_candidates:
            logger.info("[geocode] Open-Meteo resolved '%s' -> (%.4f, %.4f)", location_query, om_candidates[0].latitude, om_candidates[0].longitude)
            return await _finalize_geocode(_candidate_to_result(om_candidates[0]), client)
    except Exception as e:
        logger.warning("Open-Meteo geocoding failed for '%s': %s", location_query, e)

    # 3. Tier 3 (Nominatim Fallback)
    try:
        nom_candidates = [
            c for c in await _search_nominatim_candidates(location_query, client)
            if not _is_null_island(c.latitude, c.longitude)
        ]
        if nom_candidates:
            logger.info("[geocode] Nominatim resolved '%s' -> (%.4f, %.4f)", location_query, nom_candidates[0].latitude, nom_candidates[0].longitude)
            return await _finalize_geocode(_candidate_to_result(nom_candidates[0]), client)
    except Exception as e:
        logger.warning("Nominatim geocoding failed for '%s': %s", location_query, e)

    # Optional Tier 3b: Photon fallback
    try:
        candidates = [
            c for c in await _search_photon_candidates(location_query, client)
            if not _is_null_island(c.latitude, c.longitude)
        ]
        if candidates:
            logger.info(
                "[geocode] Photon resolved '%s' -> (%.4f, %.4f) [%s]",
                location_query, candidates[0].latitude, candidates[0].longitude, candidates[0].country_code,
            )
            return await _finalize_geocode(_candidate_to_result(candidates[0]), client)
    except Exception as e:
        logger.warning("Photon geocoding failed for '%s': %s", location_query, e)

    raise ValueError(f"Location not found—please select from dropdown. Geocoding failed across all tiers for: {city}")

