# Platform Independence (DPGA Platform Independence Audit & Architecture)

This document records concrete, verified implementations across the repository that eliminate vendor lock-in, proprietary runtime dependencies, and mandatory commercial subscriptions.

---

## 1) Provider-Neutral LLM Client (Groq / OpenAI / Local Endpoints)
- **Files:** [`climate_engine/services/llm_service.py`](file:///Users/aakash/openplanet-climate/climate_engine/services/llm_service.py), [`requirements.txt`](file:///Users/aakash/openplanet-climate/requirements.txt)
- **Implementation:** The LLM integration uses a standard OpenAI-compatible async client (`AsyncOpenAI`). It is fully configurable via standard environment variables:
  - Base URL: `LLM_BASE_URL` / `OPENAI_BASE_URL` (defaults to Groq OpenAI-compatible endpoint for backward compatibility; easily directed to Ollama, vLLM, LocalAI, or OpenRouter).
  - API Key: `LLM_API_KEY` / `OPENAI_API_KEY` / `GROQ_API_KEY` (automatically falls back to keyless mode `"ollama"` on localhost endpoints).
  - Model: `LLM_MODEL` / `OPENAI_MODEL` / `GROQ_MODEL` (default: `openai/gpt-oss-20b`).
- **Zero Proprietary SDK Lock-in:** `AsyncGroq` imports and vendor-specific request kwargs (`include_reasoning`) have been completely eradicated.
- **Strictly Optional:** AI is completely optional. Core physics, climate calculations, and vulnerability screening run deterministically without any LLM configured.

---

## 2) Weather Providers — Common Interface, Declarative Settings & Externalized Endpoints
- **Files:** [`climate_engine/services/weather_providers.py`](file:///Users/aakash/openplanet-climate/climate_engine/services/weather_providers.py), [`climate_engine/services/historical_service.py`](file:///Users/aakash/openplanet-climate/climate_engine/services/historical_service.py), [`climate_engine/settings.py`](file:///Users/aakash/openplanet-climate/climate_engine/settings.py)
- **Implementation:** All historical weather data providers conform to the `HistoricalProvider` protocol and `ProviderConfig` registry.
- **Centralized Settings:** API keys for commercial tiers are explicitly declared as `SecretStr` fields in `Settings` (`WEATHERSTACK_API_KEY`, `METEOSTAT_API_KEY`, `VISUAL_CROSSING_API_KEY`).
- **Externalized Endpoints:** Vendor base URLs are extracted out of cascade logic into top-level constants (`WEATHERSTACK_BASE_URL`, `METEOSTAT_BASE_URL`, `METEOSTAT_RAPIDAPI_HOST`, `VISUAL_CROSSING_BASE_URL`) in `weather_providers.py` with environment variable overrides.
- **Key-Gated Disablement:** A commercial provider stays dormant unless its API key is explicitly configured in environment variables.
- **Keyless Core:** Primary historical reanalysis (Open-Meteo ERA5 daily archive, Tier 1) and tertiary emergency fallback (NASA POWER, Tier 4) require zero API keys.

---

## 3) Google Earth Engine — Complete Removal of Settings and Dependencies
- **Files:** [`climate_engine/settings.py`](file:///Users/aakash/openplanet-climate/climate_engine/settings.py)
- **Implementation:** All Google Earth Engine (`GEE_*`) fields, flags, credentials, and startup validators have been completely removed from `climate_engine/settings.py`.
- **Runtime Decoupling:** The active climate engine routes, projection calculations, and spatial layers contain zero runtime imports or calls to Google Earth Engine.

---

## 4) Google Analytics — Consent-Gated & Configurable Measurement ID
- **Files:** [`frontend/src/components/AnalyticsConsent.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/components/AnalyticsConsent.tsx), [`frontend/src/app/layout.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/app/layout.tsx)
- **Implementation:** The analytics measurement ID is read exclusively from environment variables (`NEXT_PUBLIC_GA_ID` or fallback `NEXT_PUBLIC_GA_MEASUREMENT_ID`). No hardcoded `G-XXXX` IDs exist in application source code.
- **Opt-In Only:** When `localStorage` is empty (initial visit), `AnalyticsConsent` returns `null`, and no scripts or beacons are loaded.
- **Immediate Withdrawal:** When consent is declined or withdrawn, `window['ga-disable-<ID>'] = true` is set immediately in memory, and tracking cookies (`_ga`, `_gid`, `_gat`) are expired across domains.

---

## 5) Authentication — Dynamic Providers & UI Abstraction
- **Files:** [`frontend/src/app/api/auth/[...nextauth]/route.ts`](file:///Users/aakash/openplanet-climate/frontend/src/app/api/auth/[...nextauth]/route.ts), [`frontend/src/lib/auth.ts`](file:///Users/aakash/openplanet-climate/frontend/src/lib/auth.ts), [`frontend/src/components/Navbar.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/components/Navbar.tsx), [`frontend/src/app/discover/page.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/app/discover/page.tsx), [`frontend/src/components/LandingDesktop.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/components/LandingDesktop.tsx), [`frontend/src/components/LandingMobile.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/components/LandingMobile.tsx)
- **Implementation:** The NextAuth route constructs provider lists dynamically based on provisioned environment variables. It natively supports Google OAuth, Keycloak, Authentik, and generic OIDC endpoints (`OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_ISSUER`).
- **UI Decoupling:** All frontend interactive login triggers (`signIn`) invoke the shared constant `AUTH_PROVIDER_ID` imported from `@/lib/auth` (configured via `NEXT_PUBLIC_AUTH_PROVIDER_ID`, defaulting to `"google"`). No hardcoded `signIn('google')` calls exist in UI components.
- **Non-Authenticated Core:** Authentication is strictly optional; all city-scale climate risk calculations, interactive maps, research tabs, and report exports are publicly accessible without an account.

---

## 6) Contact Form & Privacy Requests — Backend Proxy & Configurable Delivery
- **Files:** [`frontend/src/app/api/contact/route.ts`](file:///Users/aakash/openplanet-climate/frontend/src/app/api/contact/route.ts), [`frontend/src/app/support/page.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/app/support/page.tsx)
- **Implementation:** Client components submit exclusively to the same-origin backend route `/api/contact`. Formspree is completely absent from all client components.
- **Configurable Forwarding:** The server route forwards inquiries via webhook (`CONTACT_WEBHOOK_URL`), Resend API (`RESEND_API_KEY`), or Formspree endpoint (`CONTACT_FORMSPREE_ENDPOINT`). If none are configured, it returns HTTP 503 without storing any data to disk or database.
- **Abuse Prevention:** Submissions enforce a 64KB body ceiling, IP sliding-window rate limiting (5 req / 10 min), field length bounds, and category allowlisting.

---

## 7) Maps — Configurable Style URL & Restored Attribution
- **Files:** [`frontend/src/components/MapHelpers.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/components/MapHelpers.tsx), [`frontend/src/components/map/MapCanvas.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/components/map/MapCanvas.tsx)
- **Implementation:** Vector basemap style URL is read from `NEXT_PUBLIC_MAP_STYLE_URL` (defaulting to CARTO Dark Matter).
- **Attribution Preserved:** MapLibre attribution is explicitly enabled via `attributionControl={{ compact: true }}` with zero CSS rules hiding attribution notices.
- **Self-Hosting Path:** Operators can self-host PMTiles/Protomaps basemaps and point `NEXT_PUBLIC_MAP_STYLE_URL` to an internal tile server.

---

## 8) Containerized Deployment Independence
- **Files:** [`backend/Dockerfile`](file:///Users/aakash/openplanet-climate/backend/Dockerfile), [`README.md`](file:///Users/aakash/openplanet-climate/README.md)
- **Implementation:** The engine packages as a standard, self-contained Docker container exposing a FastAPI service on port 7860. It requires no vendor-locked hosting adapters (runs identically on bare metal, AWS ECS, GCP Cloud Run, Hugging Face Spaces, or private Kubernetes clusters).
