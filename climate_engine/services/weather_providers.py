"""
climate_engine/services/weather_providers.py — Provider-neutral Historical Weather Providers

Common interface for Weatherstack, Meteostat, Visual Crossing and others.
Configuration is centralized via environment variables with sensible defaults.
Providers can be replaced without breaking data validation or climate calculations.
"""

from __future__ import annotations

import asyncio
import logging
import os
import urllib.parse
from typing import Any, Dict, Optional, Protocol

import httpx

logger = logging.getLogger(__name__)


class HistoricalProvider(Protocol):
    """Common interface for historical weather data providers."""

    async def fetch(self, lat: float, lng: float) -> Optional[Dict[str, Any]]:
        """Fetch and normalize historical era data to the standard format."""
        ...


class ProviderConfig:
    """Centralized configuration for weather providers."""

    @staticmethod
    def weatherstack_key() -> Optional[str]:
        return os.getenv("WEATHERSTACK_API_KEY") or os.getenv("HISTORICAL_WEATHERSTACK_KEY")

    @staticmethod
    def meteostat_key() -> Optional[str]:
        return os.getenv("METEOSTAT_API_KEY") or os.getenv("RAPIDAPI_KEY")

    @staticmethod
    def visual_crossing_key() -> Optional[str]:
        return os.getenv("VISUAL_CROSSING_API_KEY") or os.getenv("VISUALCROSSING_API_KEY")

    @staticmethod
    def enabled_providers() -> list[str]:
        raw = os.getenv("HISTORICAL_PROVIDERS", "openmeteo,weatherstack,meteostat,visualcrossing,nasapower")
        return [p.strip().lower() for p in raw.split(",") if p.strip()]


class OpenMeteoProvider:
    """Tier 1: Open-Meteo ERA5 daily archive (free, no key required)."""

    async def fetch(self, lat: float, lng: float) -> Optional[Dict[str, Any]]:
        from climate_engine.services.historical_service import _fetch_open_meteo_era5

        return await _fetch_open_meteo_era5(lat, lng)


class WeatherstackProvider:
    """Weatherstack commercial historical API."""

    async def fetch(self, lat: float, lng: float) -> Optional[Dict[str, Any]]:
        from climate_engine.services.historical_service import _fetch_weatherstack

        return await _fetch_weatherstack(lat, lng)


class MeteostatProvider:
    """Meteostat monthly via RapidAPI."""

    async def fetch(self, lat: float, lng: float) -> Optional[Dict[str, Any]]:
        from climate_engine.services.historical_service import _fetch_meteostat

        return await _fetch_meteostat(lat, lng)


class VisualCrossingProvider:
    """Visual Crossing daily historical weather API."""

    async def fetch(self, lat: float, lng: float) -> Optional[Dict[str, Any]]:
        from climate_engine.services.historical_service import _fetch_visual_crossing

        return await _fetch_visual_crossing(lat, lng)


class NasapowerProvider:
    """NASA POWER reanalysis (free, no key required)."""

    async def fetch(self, lat: float, lng: float) -> Optional[Dict[str, Any]]:
        from climate_engine.services.historical_service import _fetch_nasa_power

        return await _fetch_nasa_power(lat, lng)


# Registry for replaceable providers
PROVIDER_REGISTRY: Dict[str, HistoricalProvider] = {
    "openmeteo": OpenMeteoProvider(),
    "weatherstack": WeatherstackProvider(),
    "meteostat": MeteostatProvider(),
    "visualcrossing": VisualCrossingProvider(),
    "nasapower": NasapowerProvider(),
}


async def fetch_from_provider(name: str, lat: float, lng: float) -> Optional[Dict[str, Any]]:
    provider = PROVIDER_REGISTRY.get(name.lower())
    if not provider:
        logger.warning("Unknown historical provider: %s", name)
        return None
    try:
        return await provider.fetch(lat, lng)
    except Exception as exc:
        logger.warning("Provider %s failed for (%.4f, %.4f): %s", name, lat, lng, exc)
        return None
