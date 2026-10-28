# Platform Independence (DPGA Platform Independence Fixes)

This document records concrete, implemented changes to reduce vendor/platform lock-in.

## 1) Groq AI — Provider-neutral LLM client
- **Files:** `climate_engine/services/llm_service.py`, `requirements.txt`
- **Change:** Replaced Groq-only client with OpenAI-compatible async client. Configured via `LLM_BASE_URL`/`OPENAI_BASE_URL`, `LLM_API_KEY`/`OPENAI_API_KEY`/`GROQ_API_KEY` (backward compatible), `LLM_MODEL`. Defaults preserve existing behavior. Supports Ollama/vLLM/OpenRouter/local endpoints; falls back to keyless local mode where feasible.
- **Optional:** AI remains optional. Core climate calculations (`generate_strategic_analysis` deterministic path) work without any LLM keys.

## 2) Weather providers — Common interface + central config
- **Files:** `climate_engine/services/weather_providers.py` (new), `climate_engine/services/historical_service.py` (existing cascade retained)
- **Change:** Added `HistoricalProvider` protocol, `ProviderConfig`, registry, and provider classes for Open-Meteo, Weatherstack, Meteostat, Visual Crossing, NASA POWER. Credentials centralized via env vars (`WEATHERSTACK_API_KEY`/`HISTORICAL_WEATHERSTACK_KEY`, `METEOSTAT_API_KEY`/`RAPIDAPI_KEY`, `VISUAL_CROSSING_API_KEY`/`VISUALCROSSING_API_KEY`). Fallback chain unchanged; providers replaceable without breaking validation/calculations.

## 3) Google Earth Engine — Unused settings/validators
- **Files:** `climate_engine/settings.py`
- **Change:** Added `GEE_ENABLED` flag. Existing GEE settings/validators remain for backward compatibility but are not required for core functionality. No active GEE imports/usages found in the main engine paths; settings are treated as optional.

## 4) Google Analytics — Consent-gated, configurable
- **Files:** `frontend/src/app/layout.tsx`, `frontend/src/components/AnalyticsConsent.tsx` (new), `frontend/src/components/CookieBanner.tsx`, `PRIVACY.md`
- **Change:** GA measurement ID moved to `NEXT_PUBLIC_GA_ID` (fallback `NEXT_PUBLIC_GA_MEASUREMENT_ID`). Analytics loads only if ID is set **and** user grants explicit consent. Consent stored in `localStorage` (`op_consent_analytics`); banner updated. Privacy policy updated.

## 5) Google Authentication — Configurable + generic OIDC (Keycloak/Authentik)
- **Files:** `frontend/src/app/api/auth/[...nextauth]/route.ts`
- **Change:** Auth providers are conditionally configured. Supports Google (if env set), Keycloak, Authentik, and generic OIDC via `OIDC_*` env vars. No hard requirement for Google; preserves JWT/session behavior and security.

## 6) Formspree — Backend proxy endpoint + configurable delivery
- **Files:** `frontend/src/app/api/contact/route.ts` (new), `frontend/src/app/support/page.tsx`
- **Change:** Frontend now POSTs to `/api/contact` (configurable via `NEXT_PUBLIC_CONTACT_ENDPOINT`). Backend validates input, supports delivery via webhook/Resend/Formspree (env-configured), never exposes secrets, returns safe errors. Direct browser Formspree submission removed as default path.

## 7) CARTO maps — Configurable style URL + attribution restored
- **Files:** `frontend/src/components/MapHelpers.tsx`, `frontend/src/components/map/MapCanvas.tsx`
- **Change:** Map style URL moved to `NEXT_PUBLIC_MAP_STYLE_URL` (defaults to CARTO). MapLibre attribution restored (`attributionControl={true}`). Documented feasible self-hosting via Protomaps/PMTiles (see below).

## Docker deployment
- **Files:** `Dockerfile`, `README.md`
- **Change:** Dockerfile remains generic (FastAPI on port 7860). No Vercel or Hugging Face hard dependencies required for containerized deployment. External services are optional/configurable.

## Protomaps/PMTiles self-hosting (feasible option)
1. Generate PMTiles from OpenStreetMap data (e.g., via Planetiler) or use Protomaps basemaps.
2. Host PMTiles on object storage/CDN (or locally).
3. Use a MapLibre style JSON pointing to PMTiles source (or `pmtiles://` protocol with `pmtiles` package).
4. Set `NEXT_PUBLIC_MAP_STYLE_URL` to your self-hosted style URL in `frontend/.env.local`.
5. Ensure attribution is included per OSM/Protomaps license.
