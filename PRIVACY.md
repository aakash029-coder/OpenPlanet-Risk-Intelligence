# Privacy Policy & Data-Flow Architecture — OpenPlanet

**Document Reference: OP-PRV-02**  
**Revision Date: November 2026**

OpenPlanet is an open-source, city-scale physical climate risk intelligence engine. The core climate calculations and risk projections are fully accessible to the public without requiring user registration or authentication.

This policy transparently documents how user inputs, coordinates, browser storage, server caches, logs, and external service integrations operate across the repository and live deployments.

---

## 1. Core Climate Risk Analysis & Location Data

- **No Authentication Required:** Searching for a city, entering coordinates, viewing historical climate baselines, exploring CMIP6 projections, and modeling urban cooling interventions are public capabilities that require no account creation.
- **Location Inputs Processed:** Users may supply geographic coordinates (latitude and longitude) or location query strings (city names).
- **Processing Scope:** Coordinates are used solely on demand to query meteorological reanalysis data (ERA5), climate projection models (CMIP6), and digital elevation models (Copernicus DEM).
- **Identity Disassociation:** The application code does not link query coordinates, city names, or calculation results to personal identities, authenticated user profiles, or tracking profiles.

---

## 2. Optional Authentication & Session Handling

- **Deployment Discretion:** Authentication is optional and inactive unless the deployment operator explicitly configures OAuth or OIDC environment credentials (`GOOGLE_CLIENT_ID`, `KEYCLOAK_CLIENT_ID`, `AUTHENTIK_CLIENT_ID`, or generic `OIDC_*`).
- **Session Strategy:** If enabled, OpenPlanet uses NextAuth.js configured with encrypted JSON Web Token (JWT) HTTP session cookies.
- **No User Database:** The repository maintains no user table, profile store, or relational database for accounts.
- **Token Minimization:** External OAuth provider access tokens are deliberately excluded from client session JWTs. Only minimal identity identifiers (e.g., subject ID, name, email as authorized by the provider) are held within the session cookie.
- **Engine Independence:** Core climate calculation routes remain completely open and unauthenticated regardless of whether NextAuth is active.

---

## 3. Analytics, Cookies, and Consent Choice

Google Analytics may optionally be enabled by the deployment operator via `NEXT_PUBLIC_GA_ID` or `NEXT_PUBLIC_GA_MEASUREMENT_ID`.

- **Disabled by Default:** Analytics scripts and beacons are never loaded on first visit. They remain dormant unless the user grants explicit opt-in consent.
- **Persistent Choice:** User consent is saved in browser `localStorage` under key `op_consent_analytics` (`granted` or `denied`).
- **Persistent Withdrawal Mechanism:** Users can reopen privacy preferences at any time via:
  - The interactive settings card on the `/privacy` page.
  - The "Cookie Settings" link in the global site footer.
  - The consent banner itself.
- **Withdrawal & Cookie Cleanup:** Withdrawing consent immediately sets `window['ga-disable-<ID>'] = true` to disable Google Analytics tracking in memory, expires tracking cookies (`_ga`, `_gid`, `_gat`, `_ga_*`) across active domains, and updates stored preferences to `denied`.
- **Technical Limitation Disclosure:** Withdrawing consent stops future tracking events and beacon transmissions; however, it cannot retroactively undo data already received by Google servers prior to withdrawal. Furthermore, because browsers cannot dynamically un-execute third-party JavaScript files already loaded in memory, full script unloading requires a page reload.

---

## 4. Server-Side Caching (Memory and Disk)

To prevent upstream API throttling, maintain compliance with fair-use limits, and deliver sub-second responses on shared cloud hosting (e.g., Hugging Face Spaces free tier), OpenPlanet maintains multi-tiered caching:

### 4.1 Transient In-Memory Caches
- **ERA5 Relative Humidity Cache:** Keyed by 2-decimal rounded coordinates (~1.1 km resolution). TTL: 24 hours.
- **Historical Eras Cache:** Thread-safe bounded LRU cache capped at 10,000 spatial cells. TTL: 7 days.
- **City Socioeconomic Cache:** Bounded LRU cache capped at 1,000 cities. TTL: 7 days.
- **Country Indicators Cache:** Bounded LRU cache capped at 300 ISO3 country entries. TTL: 30 days.

### 4.2 Persistent Disk Cache
Persistent disk caching is implemented in `climate_engine/services/disk_cache.py`:
- **Directory:** Governed by `OPENPLANET_CACHE_DIR` (defaults to `climate_engine/data/cache`).
- **File Eviction:** Hard ceiling of 5,000 files (`OPENPLANET_CACHE_MAX_FILES`). Entries beyond the cap are evicted using an LRU policy based on file modification timestamps.
- **Cache Keys & TTLs:**
  - `era5_bundle_{lat}_{lng}`: TTL = 30 days (stores daily ERA5 temperature/precipitation arrays for 2-decimal rounded coordinates).
  - `cmip6_{model}_{ssp}_{lat}_{lng}`: TTL = 30 days.
  - `cckp_delta_{iso3}_{ssp}_{year}`: TTL = 30 days (stores World Bank regional warming anomalies).
  - `dem_elevation_{lat}_{lng}`: TTL = 90 days (stores Copernicus/SRTM30m elevation).
- **Data Contained:** Disk cache files store meteorological arrays, numerical climate metrics, and elevation numbers. They never store personal user data, emails, or credentials.

---

## 5. Third-Party Service Inventory

The codebase interfaces with the following categories of external services:

### 5.1 Active Core Services
- **Open-Meteo (`open-meteo.com`):** Primary provider for ERA5 daily reanalysis, CMIP6 climate model projections, Copernicus DEM elevation, and geocoding. Receives latitude, longitude, and query strings.
- **NASA POWER (`power.larc.nasa.gov`):** Solar and meteorological reanalysis used as an emergency fallback tier.
- **Photon (`photon.komoot.io`):** Autocomplete geocoding service based on OpenStreetMap data.
- **Nominatim / OpenStreetMap (`openstreetmap.org`):** Administrative boundary polygon retrieval for spatial mesh generation.
- **OpenTopoData (`opentopodata.org`):** SRTM 30m digital elevation model fallback.
- **UN Population Division API (`population.un.org`):** Country-level crude death rate indicators (Indicator 59) used for epidemiological baseline mortality rates.
- **World Bank Climate Change Knowledge Portal (`cckpapi.worldbank.org`):** Country-level CMIP6 warming anomaly fallback.
- **CARTO / MapLibre:** Vector and raster basemap tiles rendered on client maps.

### 5.2 Optional / Configurable Integrations
- **Weatherstack (`weatherstack.com`):** Secondary historical weather fallback (inactive unless `WEATHERSTACK_API_KEY` is configured).
- **Meteostat / RapidAPI (`rapidapi.com`):** Secondary monthly weather fallback (inactive unless `METEOSTAT_API_KEY` is configured).
- **Visual Crossing (`visualcrossing.com`):** Tertiary weather fallback (inactive unless `VISUAL_CROSSING_API_KEY` is configured).
- **Groq / OpenAI-compatible LLM Endpoints:** Optional strategic analysis narrative generation. Aggregated city climate figures are sent; no personal user information is transmitted.
- **Google Analytics:** Loaded strictly upon explicit opt-in consent.
- **NextAuth Providers:** Google OAuth, Keycloak, Authentik, or generic OIDC when enabled.
- **Contact Gateways:** External webhook (`CONTACT_WEBHOOK_URL`), Resend API (`api.resend.com`), or Formspree.

### 5.3 Hosting & Infrastructure
- **Climate Engine Host (configurable via `ENGINE_URL`):** The Python FastAPI engine location is configurable through the server-side `ENGINE_URL` environment variable (defaulting to `http://localhost:7860` for self-hosted deployments). On the operator's current hosted deployment, the containerized engine runs on **Hugging Face Spaces**.
- **Vercel (or alternative host):** Hosts the Next.js frontend application and edge API proxy routes.

---

## 6. Application Logging, Redaction, and Retention

- **Coordinate Coarsening:** Backend log statements coarsen coordinates to 2 decimal places (`%.2f`) (~1.1 km) rather than raw pinpoint precision.
- **Zero Secret Logging:** API keys, access tokens, and passwords are never output to logs. Invalid API key attempts record only the string length for diagnostic debugging.
- **Distributed Tracing:** Every HTTP transaction receives a unique UUIDv4 `X-Request-ID` header.
- **Public Error Masking:** Production error handlers sanitize responses, returning generic error summaries with the request reference ID to avoid exposing internal stack traces.
- **Infrastructure Log Retention:** Raw server access logs (including remote IP address, user-agent, and HTTP method) are retained by hosting platforms (Hugging Face Spaces, Vercel). Their exact retention duration is governed by hosting platform terms (typically 1 hour to 1 day on standard Vercel tiers, and ephemeral container runtime on Hugging Face Spaces) and must be verified by the deployment owner.

---

## 7. Contact Form & Privacy Requests

Users can communicate with maintainers via `/support`:
- **Input Validation:** Strict server-side validation enforces character limits on name (max 100), email (max 254), organization (max 100), category (max 50), and message (min 5, max 5000), with a 64KB maximum body ceiling.
- **Abuse Prevention:** Client IP sliding-window rate limiting restricts submissions to a maximum of 5 requests per 10 minutes.
- **No Database Retention:** Contact messages are never saved to a database or file in this codebase.
- **Configured Forwarding:** Valid submissions are forwarded to the operator's configured webhook, Resend email service, or Formspree gateway. If none are configured, the API returns HTTP 503 with the maintainer direct contact email (aakash@openplanetrisk.com) without storing data.
- **Privacy Inquiries:** To exercise data subject rights or submit a privacy inquiry, select category **"Privacy Request"** on the support form (/support) or email project maintainers directly at [aakash@openplanetrisk.com](mailto:aakash@openplanetrisk.com). All privacy requests are handled manually.
- **Important Security Warning:** **Never submit personal data, email addresses, or query coordinates in public GitHub issues**, as public repositories are permanently indexed across the web.

---

## 8. Browser Storage Inventory

| Key | Storage Type | Purpose | Persistence |
|---|---|---|---|
| `op_consent_analytics` | `localStorage` | Stores user analytics consent choice (`granted`/`denied`) | Persistent until cleared or withdrawn |
| `op_cookies_v1` | `localStorage` | Compatibility banner state flag | Persistent until cleared |
| `op_consent` | `localStorage` | Legacy compatibility banner flag | Persistent until cleared |
| `op_sync_state` | `localStorage` | UI controls & scenario state synchronization (non-PII) | Persistent until cleared |
| `hasSeenDesktopWarning` | `sessionStorage` | Dismissal flag for viewport advisory | Active browser session only |
| NextAuth session cookie | `Cookie` (HTTP) | Encrypted JWT session token (only if sign-in enabled) | Governed by NextAuth session settings |
| `_ga`, `_gid`, `_gat` | `Cookie` (HTTP) | Google Analytics identifiers (only if consent granted) | 24 hours to 2 years (or cleared on withdrawal) |

---

## 9. Data Retention, Deletion, and Privacy Rights

- **Local Storage Deletion:** Users can clear browser storage and cookies at any time via browser settings or the `/privacy` consent controls.
- **Server Cache Invalidation:** Server-side caches automatically expire via TTL (24 hours to 90 days) or LRU capacity eviction. These records are not associated with user accounts.
- **Third-Party Data:** When requests pass to external providers (e.g., Open-Meteo, NASA, webhook destinations), data retention is governed by those third parties.
- **Deletion Limitations:** Because this repository does not operate an account database or query history table, there is no automated account deletion API.

---

## 10. Implemented Security Controls

- **Security Headers:** Strict-Transport-Security (HSTS), X-Content-Type-Options (`nosniff`), X-Frame-Options (`DENY`), Referrer-Policy (`strict-origin-when-cross-origin`), and Permissions-Policy.
- **CORS Protection:** Origin allowlists enforced via environment configuration.
- **Multi-Level Rate Limiting:** SlowAPI per-IP rate ceilings on Python engine routes; IP window rate limiting on contact form routes.
- **Strict Typing & Schema Validation:** Pydantic v2 validation on backend requests; TypeScript validation across all frontend routes.
- **Credential Minimization:** OAuth provider access tokens are excluded from session cookies; client-side endpoints do not expose backend service keys.

---

## 11. Regulatory Considerations & Compliance Disclaimer

OpenPlanet adheres to privacy-by-design and data minimization principles in alignment with international standards, including the EU General Data Protection Regulation (GDPR) and India's Digital Personal Data Protection Act, 2023 (DPDP Act).

> **Notice:** Publication of this documentation does not constitute a formal certification of statutory compliance or an automated guarantee of DPGA compliance. Full compliance depends upon production deployment parameters, hosting provider contracts, domain setup, and operational policies managed by the site operator.

---

## 12. Policy Revisions

Material changes to application data handling, caching mechanics, or external provider integrations will be reflected in this document with an updated revision date.
