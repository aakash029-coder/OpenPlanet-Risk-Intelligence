"""Unit tests for location geocoding disambiguation."""

from climate_engine.services.socioeconomic_service import (
    _country_codes_from_hint,
    _prepare_geocoding_query,
    _select_nominatim_hit,
    _select_openmeteo_hit,
)


def test_prepare_geocoding_query_preserves_country():
    assert _prepare_geocoding_query("Athens, Greece") == "Athens, Greece"


def test_country_codes_from_hint_greece():
    assert "GR" in _country_codes_from_hint("Greece")


def test_openmeteo_prefers_country_hint_over_population():
    results = [
        {
            "name": "Athens",
            "country_code": "US",
            "population": 130_000,
            "latitude": 32.2,
            "longitude": -83.4,
        },
        {
            "name": "Athens",
            "country_code": "GR",
            "population": 664_000,
            "latitude": 37.98,
            "longitude": 23.73,
        },
    ]
    hit = _select_openmeteo_hit(results, "Athens, Greece")
    assert hit["country_code"] == "GR"


def test_nominatim_prefers_country_hint():
    results = [
        {
            "lat": "32.2048735",
            "lon": "-83.3776558",
            "address": {"country_code": "us"},
        },
        {
            "lat": "37.9839412",
            "lon": "23.7282712",
            "address": {"country_code": "gr"},
        },
    ]
    hit = _select_nominatim_hit(results, "Athens, Greece")
    assert hit["address"]["country_code"] == "gr"


def test_tier1_local_vault_lookup():
    from climate_engine.services.socioeconomic.geocoding import _search_local_vault_candidates
    candidates = _search_local_vault_candidates("Mumbai")
    assert len(candidates) > 0
    first = candidates[0]
    assert first.source == "local-dictionary"
    assert abs(first.latitude - 19.0760) < 0.1
    assert abs(first.longitude - 72.8777) < 0.1
    assert first.latitude != 0.0 and first.longitude != 0.0


def test_null_island_rejection():
    from climate_engine.services.socioeconomic.geocoding import _is_null_island
    assert _is_null_island(0.0, 0.0) is True
    assert _is_null_island(0.0001, -0.0001) is True
    assert _is_null_island(19.0760, 72.8777) is False


def test_hard_guardrail_rejects_null_island():
    from fastapi.testclient import TestClient
    from climate_engine.api.main import app
    client = TestClient(app)
    response = client.post("/api/climate-risk", json={
        "lat": 0.0,
        "lng": 0.0,
        "ssp": "SSP2-4.5",
        "canopy_offset_pct": 0,
        "albedo_offset_pct": 0,
        "location_hint": "Unknown City",
    })
    assert response.status_code == 422
    assert "Location not found—please select from dropdown." in response.json()["detail"]

    response_predict = client.post("/api/predict", json={
        "city": "Unknown City Nonexistent 123456",
        "lat": 0.0,
        "lng": 0.0,
        "ssp": "SSP2-4.5",
        "year": "2050",
        "canopy": 0,
        "coolRoof": 0,
    })
    assert response_predict.status_code == 422
    assert "Location not found—please select from dropdown." in response_predict.json()["detail"]


