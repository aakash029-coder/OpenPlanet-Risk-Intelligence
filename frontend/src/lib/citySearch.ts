import { WORLD_CITIES, WorldCity } from './data/worldCities';

export interface CitySuggestion {
  id: string | number;
  name: string;
  country: string;
  country_code?: string;
  state?: string;
  latitude: number;
  longitude: number;
  lat?: number;
  lng?: number;
  display_name: string;
  population?: number;
  source?: 'local' | 'remote' | 'photon' | 'osm' | 'openmeteo';
  score?: number;
}

/**
 * Administrative suffixes to strip from city portion.
 * Excludes state, province, district, governorate, tehsil, taluka, etc.
 */
export const ADMIN_SUFFIX_REGEX = /\s+(?:Governorate|District|Tehsil|Tahsil|Taluka|Taluk|Sub-division|Subdivision|Sadar|Suburb|Municipality|Prefecture|County|City\s+Corporation|Metropolitan\s+Area)$/i;
export const ADMIN_PREFIX_REGEX = /^(?:Governorate\s+of|District\s+of|Municipality\s+of|County\s+of|Prefecture\s+of|City\s+of)\s+/i;

/**
 * Sub-city divisions, suburbs, neighborhoods and boroughs mapped strictly to their parent city.
 */
export const SUB_CITY_ROLLUP: Record<string, { city: string; country: string }> = {
  andheri: { city: 'Mumbai', country: 'India' },
  borivali: { city: 'Mumbai', country: 'India' },
  bandra: { city: 'Mumbai', country: 'India' },
  juhu: { city: 'Mumbai', country: 'India' },
  dadar: { city: 'Mumbai', country: 'India' },
  kurla: { city: 'Mumbai', country: 'India' },
  powai: { city: 'Mumbai', country: 'India' },
  colaba: { city: 'Mumbai', country: 'India' },
  manhattan: { city: 'New York', country: 'United States' },
  brooklyn: { city: 'New York', country: 'United States' },
  queens: { city: 'New York', country: 'United States' },
  bronx: { city: 'New York', country: 'United States' },
  'staten island': { city: 'New York', country: 'United States' },
  'new cairo': { city: 'Cairo', country: 'Egypt' },
};

/**
 * Known standalone states/provinces/regions to exclude from standalone city suggestions.
 */
export const STANDALONE_STATES_REGIONS = new Set([
  'california', 'maharashtra', 'texas', 'florida', 'alaska', 'hawaii',
  'washington state', 'bavaria', 'ontario', 'quebec', 'british columbia',
  'uttar pradesh', 'madhya pradesh', 'rajasthan', 'gujarat', 'karnataka',
  'tamil nadu', 'kerala', 'punjab', 'haryana', 'west bengal', 'bihar',
  'telangana', 'andhra pradesh', 'odisha', 'assam', 'jharkhand',
  'cairo governorate', 'alexandria governorate', 'giza governorate',
]);

/**
 * Strips administrative suffixes/prefixes and rolls up sub-city suburbs to their whole parent city.
 * E.g. "Varanasi Sadar" -> "Varanasi", "Cairo Governorate" -> "Cairo", "Andheri" -> "Mumbai".
 */
export function cleanCityName(rawName: string): string {
  if (!rawName) return '';
  let name = rawName.trim();

  // Handle parenthetical aliases like "Sohra (Cherrapunji)" or "Cherrapunji (Sohra)"
  const parenMatch = name.match(/^(.*?)\s*\((.*?)\)$/);
  if (parenMatch) {
    const p1 = parenMatch[1].trim();
    const p2 = parenMatch[2].trim();
    if (/cherrapunji/i.test(p2)) name = p2;
    else if (/cherrapunji/i.test(p1)) name = p1;
    else name = p1;
  }

  name = name.replace(ADMIN_PREFIX_REGEX, '').trim();

  for (let i = 0; i < 3; i++) {
    const prev = name;
    name = name.replace(ADMIN_SUFFIX_REGEX, '').trim();
    if (name === prev) break;
  }

  const low = name.toLowerCase();
  if (SUB_CITY_ROLLUP[low]) {
    return SUB_CITY_ROLLUP[low].city;
  }

  return name;
}

/**
 * Formats every city suggestion and selected location strictly as:
 * "<City/Town Name>, <Country Name>"
 * (e.g. "Indore, India", "Mumbai, India", "Cherrapunji, India", "Cairo, Egypt").
 * All states, provinces, and regions are strictly excluded from the display label.
 */
export function formatCityCountry(cityName: string, countryName: string): string {
  const cleanCity = cleanCityName(cityName);
  const cleanCountry = countryName ? countryName.trim() : '';
  if (!cleanCountry) return cleanCity;
  return `${cleanCity}, ${cleanCountry}`;
}

/**
 * Checks whether a candidate is a standalone state, province, or region.
 */
export function isStandaloneState(cityName: string, _countryName?: string): boolean {
  const norm = normalizeText(cityName);
  return STANDALONE_STATES_REGIONS.has(norm);
}

/**
 * Strips diacritics and normalizes a string for fast, robust accent-insensitive matching.
 * Examples: "São Paulo" -> "sao paulo", "München" -> "munchen", "Bogotá" -> "bogota".
 */
export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * In-memory LRU query cache for instant responses on backspace or retyping.
 */
const queryCache = new Map<string, CitySuggestion[]>();
const MAX_CACHE_SIZE = 120;

export function getCachedSuggestions(query: string): CitySuggestion[] | undefined {
  const key = normalizeText(query);
  return queryCache.get(key);
}

export function setCachedSuggestions(query: string, suggestions: CitySuggestion[]): void {
  const key = normalizeText(query);
  if (!key) return;
  if (queryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey) queryCache.delete(oldestKey);
  }
  queryCache.set(key, suggestions);
}

export function clearCitySearchCache(): void {
  queryCache.clear();
}

/**
 * Instant 0ms local city search with Google Maps-style hierarchical ranking.
 * Strict rules:
 * - Suggests ONLY standalone whole cities or towns formatted as "City, Country"
 * - Excludes all states/provinces from display label
 * - Excludes standalone states like "California, United States" or "Maharashtra, India"
 */
export function searchLocalCities(rawQuery: string, limit = 8): CitySuggestion[] {
  const trimmed = rawQuery.trim();
  if (!trimmed) return [];

  const parts = trimmed.split(',').map((p) => normalizeText(p)).filter(Boolean);
  const primary = parts[0] || '';
  const secondary = parts[1] || '';

  if (!primary) return [];

  // Exclude standalone states typed directly (e.g. typing "California" or "Maharashtra")
  if (isStandaloneState(primary)) {
    return [];
  }

  // Check sub-city rollup for raw typed query (e.g. "Andheri" -> resolves to Mumbai, India)
  const rollupMatch = SUB_CITY_ROLLUP[primary];
  const effectivePrimary = rollupMatch ? normalizeText(rollupMatch.city) : primary;

  const matches: Array<{ score: number; city: WorldCity }> = [];

  for (const city of WORLD_CITIES) {
    const cleanName = cleanCityName(city.name);
    const normName = normalizeText(cleanName);
    const normCountry = normalizeText(city.country);
    const normState = city.state ? normalizeText(city.state) : '';
    const normAliases = (city.aliases || []).map((a) => normalizeText(a));

    let score = -1;

    // 1. Exact match on city name
    if (normName === effectivePrimary) {
      score = 100000;
    }
    // 2. Exact match on alias (e.g. "Sohra" -> Cherrapunji)
    else if (normAliases.includes(effectivePrimary)) {
      score = 90000;
    }
    // 3. Name starts with query (Prefix match)
    else if (normName.startsWith(effectivePrimary)) {
      score = 50000 - (normName.length - effectivePrimary.length) * 15;
    }
    // 4. Word boundary match on multi-word city names (e.g. 'Town' in 'Cape Town', 'London' in 'Greater London')
    else if (normName.split(/\s+/).some((w) => w.startsWith(effectivePrimary))) {
      score = 35000;
    }
    // 5. Alias starts with query
    else if (normAliases.some((a) => a.startsWith(effectivePrimary))) {
      score = 30000;
    }
    // 6. Substring match inside city name (min 3 chars to avoid noisy matches)
    else if (effectivePrimary.length >= 3 && normName.includes(effectivePrimary)) {
      score = 15000;
    }

    if (score < 0) continue;

    // Secondary query bonus (e.g. "Cairo, Egypt" or "Mumbai, India")
    if (secondary) {
      if (
        normCountry.startsWith(secondary) ||
        normState.startsWith(secondary) ||
        city.country_code.toLowerCase() === secondary
      ) {
        score += 25000;
      }
    }

    // Population tie-breaker bonus (up to 20,000 pts)
    const popBonus = Math.min(20000, Math.floor((city.population || 0) / 1000));
    score += popBonus;

    matches.push({ score, city });
  }

  matches.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const results: CitySuggestion[] = [];

  for (const { score, city } of matches) {
    const cleanName = cleanCityName(city.name);
    const display_name = formatCityCountry(cleanName, city.country);
    const dedupKey = `${normalizeText(cleanName)}|${normalizeText(city.country)}`;

    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    results.push({
      id: city.id,
      name: cleanName,
      country: city.country,
      country_code: city.country_code,
      state: city.state,
      latitude: city.latitude,
      longitude: city.longitude,
      lat: city.latitude,
      lng: city.longitude,
      display_name,
      population: city.population,
      source: 'local',
      score,
    });

    if (results.length >= limit) break;
  }

  return results;
}

/**
 * Deduplicates and merges remote suggestions with local ones.
 * Keeps local suggestions high in ranking and adds new distinct remote cities.
 * Deduplicates strictly by clean "City, Country" identity.
 */
export function mergeSuggestions(
  local: CitySuggestion[],
  remote: CitySuggestion[],
  limit = 8
): CitySuggestion[] {
  const seen = new Set<string>();
  const merged: CitySuggestion[] = [];

  for (const item of local) {
    const cleanName = cleanCityName(item.name);
    const key = `${normalizeText(cleanName)}|${normalizeText(item.country)}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({
        ...item,
        name: cleanName,
        display_name: formatCityCountry(cleanName, item.country),
      });
    }
  }

  for (const item of remote) {
    const cleanName = cleanCityName(item.name);
    if (isStandaloneState(cleanName, item.country)) continue;

    const key = `${normalizeText(cleanName)}|${normalizeText(item.country)}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({
        ...item,
        name: cleanName,
        display_name: formatCityCountry(cleanName, item.country),
      });
      if (merged.length >= limit) break;
    }
  }

  return merged.slice(0, limit);
}

/**
 * Fetches remote geocoding candidates with AbortSignal.
 * Strictly cleans and filters results:
 * - Excludes standalone states, provinces, and regions
 * - Formats display_name strictly as "<City/Town Name>, <Country Name>"
 * - Rolls up sub-cities (e.g. Andheri/Borivali -> Mumbai, New Cairo -> Cairo)
 * - Strips administrative suffixes ("Governorate", "District", "Sadar", etc.)
 */
export async function fetchRemoteGeocodeCandidates(
  query: string,
  signal?: AbortSignal
): Promise<CitySuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  try {
    const res = await fetch(`/api/geocode-search?q=${encodeURIComponent(trimmed)}`, {
      headers: { Accept: 'application/json' },
      signal,
    });

    if (!res.ok) return [];

    const data: {
      results?: Array<{
        id: string;
        name: string;
        display_name: string;
        country: string;
        country_code?: string;
        latitude: number;
        longitude: number;
        source?: string;
      }>;
    } = await res.json();

    if (!data.results || !Array.isArray(data.results)) return [];

    const seen = new Set<string>();
    const candidates: CitySuggestion[] = [];

    for (const c of data.results) {
      const cleanName = cleanCityName(c.name);
      const country = c.country || '';

      if (isStandaloneState(cleanName, country)) continue;

      const display_name = formatCityCountry(cleanName, country);
      const dedupKey = `${normalizeText(cleanName)}|${normalizeText(country)}`;

      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      candidates.push({
        id: c.id || `remote-${candidates.length}-${cleanName}`,
        name: cleanName,
        display_name,
        country,
        country_code: c.country_code,
        latitude: c.latitude,
        longitude: c.longitude,
        lat: c.latitude,
        lng: c.longitude,
        source: (c.source as CitySuggestion['source']) || 'remote',
      });

      if (candidates.length >= 8) break;
    }

    return candidates;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return [];
    }
    return [];
  }
}
