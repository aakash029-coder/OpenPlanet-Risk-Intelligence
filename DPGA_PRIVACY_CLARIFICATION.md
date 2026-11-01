# Digital Public Goods Alliance (DPGA) Clarification Package: Privacy, Data Protection, and Security

**Project:** OpenPlanet Climate Risk Intelligence Engine  
**Repository:** `aakash029-coder/openplanet-climate` (Branch: `main`)  
**Deployment Context:** Hugging Face Space (`albus2903/openplanet-engine`) & Next.js Web Application  
**Document Reference:** `DPGA-CLARIF-2026-01`  
**Status:** CONDITIONALLY READY (Pending Final Deployment-Owner Confirmations)  

---

## 1. Executive Summary

This clarification package provides an evidence-based, verifiable audit and remediation report addressing all privacy, caching, logging, analytics consent, and third-party data-handling inquiries for the OpenPlanet submission to the Digital Public Goods Alliance (DPGA).

Following a code-level architectural review, concrete remediations were implemented directly in the repository working tree:
- **Consistent Privacy Documentation:** Synchronized the root [`PRIVACY.md`](file:///Users/aakash/openplanet-climate/PRIVACY.md) and web application [`frontend/src/app/privacy/page.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/app/privacy/page.tsx) with accurate disclosures of disk caches, transient in-memory caches, logs, and external providers.
- **Persistent Analytics Consent & Withdrawal:** Overhauled Google Analytics gating to ensure scripts never load prior to opt-in consent, provided persistent consent withdrawal mechanisms via the footer, cookie banner, and an interactive `/privacy` preference panel, disabled tracking flags in memory upon withdrawal (`ga-disable`), and expired client tracking cookies.
- **Server-Side Cache Governance:** Documented and verified TTL limits and LRU capacity bounds across in-memory stores (24h to 30d) and persistent disk caches (30d to 90d, max 5,000 files).
- **Log Coordinate & Key Redaction:** Coarsened logged coordinates to 2 decimal places (~1.1 km grid resolution) to eliminate micro-location tracking, masked raw user input strings, and eliminated API key prefix leakage in security logs.
- **Hardened Contact Gateway:** Added 64KB request body limits, client-IP sliding-window rate limiting (max 5 requests / 10 minutes), input sanitization, category allowlisting, and established a dedicated "Privacy Request" category while advising users against posting PII to public GitHub issues.
- **Token Minimization:** Removed upstream OAuth provider access tokens from NextAuth JWT session objects, restricting session data strictly to essential application state.

All 422 Python pytest suite tests, 12 Node.js contact/consent unit tests, TypeScript type checks (`npx tsc --noEmit`), and the Next.js production build (`next build`) pass with 0 errors.

---

## 2. Reviewer Concern → Clarification → Evidence

| Reviewer Concern / Topic | Clarification | Evidence in Repository | Verification Status | Remaining Limitation / Owner Action |
|---|---|---|---|---|
| **Personal Data & Location Processing** | OpenPlanet does not link query coordinates or city names to personal identities or user accounts. Coordinates are processed transiently on demand for meteorological reanalysis and CMIP6 climate model grids. | [`climate_engine/api/routers/climate.py`](file:///Users/aakash/openplanet-climate/climate_engine/api/routers/climate.py#L55-L70)<br>[`climate_engine/api/routers/predict.py`](file:///Users/aakash/openplanet-climate/climate_engine/api/routers/predict.py#L80-L127) | **VERIFIED IN CODE** | None in codebase. |
| **Core Functionality & Authentication** | Authentication is completely optional and inactive by default. All core climate risk projections, maps, and reports are publicly accessible without an account. | [`frontend/src/app/api/auth/[...nextauth]/route.ts`](file:///Users/aakash/openplanet-climate/frontend/src/app/api/auth/[...nextauth]/route.ts#L6-L45)<br>[`frontend/src/app/dashboard/page.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/app/dashboard/page.tsx) | **VERIFIED IN CODE** | Owner must confirm whether OAuth credentials are populated in production. |
| **Third-Party Data Providers** | Third-party services are categorized into Active Core (Open-Meteo, NASA POWER, Photon, Nominatim, OpenTopoData, UN Population API, World Bank CCKP, CARTO) and Optional/Configurable (Weatherstack, Meteostat/RapidAPI, Visual Crossing, Groq LLM, Google Analytics). Inactive integrations make zero outbound calls. | [`climate_engine/services/historical_service.py`](file:///Users/aakash/openplanet-climate/climate_engine/services/historical_service.py#L178-L300)<br>[`climate_engine/services/socioeconomic/worldbank.py`](file:///Users/aakash/openplanet-climate/climate_engine/services/socioeconomic/worldbank.py#L126-L149)<br>[`climate_engine/services/cmip6_service.py`](file:///Users/aakash/openplanet-climate/climate_engine/services/cmip6_service.py#L685-L740) | **VERIFIED IN CODE** | Production API key provisioning depends on deployment environment variables. |
| **Browser Storage & Analytics Consent** | Google Analytics is disabled by default. Scripts are only loaded if `NEXT_PUBLIC_GA_ID` is set AND explicit opt-in consent (`op_consent_analytics = 'granted'`) is recorded in localStorage. | [`frontend/src/components/AnalyticsConsent.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/components/AnalyticsConsent.tsx#L88-L112)<br>[`frontend/tests/consent_and_contact.test.mjs`](file:///Users/aakash/openplanet-climate/frontend/tests/consent_and_contact.test.mjs#L23-L41) | **VERIFIED IN CODE** | None. Tested via Node.js test runner. |
| **Consent Withdrawal** | Users can withdraw consent at any time via the `/privacy` panel, the footer link, or the cookie banner. Withdrawal updates localStorage to `denied`, sets `window['ga-disable-<ID>'] = true`, and expires `_ga*` cookies across all domains. | [`frontend/src/components/AnalyticsConsent.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/components/AnalyticsConsent.tsx#L55-L84)<br>[`frontend/src/components/CookieBanner.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/components/CookieBanner.tsx#L50-L65)<br>[`frontend/src/components/SiteFooter.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/components/SiteFooter.tsx#L135-L172) | **VERIFIED IN CODE** | Technical limitation: third-party scripts already in browser memory cannot be retroactively un-downloaded during an active tab session without reload. |
| **Server-Side Caching (Memory & Disk)** | In-memory caches have finite TTLs (24h to 30d) and bounded sizes (300 to 10,000 entries). Disk cache (`OPENPLANET_CACHE_DIR`) enforces a 5,000 file cap via LRU modification-time eviction. Cache payloads store weather arrays and elevation numbers, never user PII. | [`climate_engine/services/disk_cache.py`](file:///Users/aakash/openplanet-climate/climate_engine/services/disk_cache.py#L26-L87)<br>[`climate_engine/services/historical_service.py`](file:///Users/aakash/openplanet-climate/climate_engine/services/historical_service.py#L29-L63)<br>[`tests/test_privacy_security.py`](file:///Users/aakash/openplanet-climate/tests/test_privacy_security.py#L19-L88) | **VERIFIED IN CODE** | Cache flush is automatic upon eviction or volume recreation. Owner can wipe directory if needed. |
| **Application Logging & Retention** | Logged coordinates are coarsened to 2 decimal places (~1.1 km). API keys are never logged (only string length). Public 500 error responses in production return a sanitized reference with `request_id`, suppressing stack traces. | [`climate_engine/api/routers/climate.py`](file:///Users/aakash/openplanet-climate/climate_engine/api/routers/climate.py#L55-L66)<br>[`climate_engine/api/security.py`](file:///Users/aakash/openplanet-climate/climate_engine/api/security.py#L104-L113)<br>[`climate_engine/api/main.py`](file:///Users/aakash/openplanet-climate/climate_engine/api/main.py#L114-L138) | **VERIFIED IN CODE** | Host infrastructure access log retention (Hugging Face Spaces, Vercel) requires owner verification. |
| **Contact Form & Privacy Requests** | Contact submissions enforce a 64KB body ceiling, IP rate limiting (5 req / 10 min), and strict length limits. No database storage exists in the codebase; data is forwarded to configured webhook/Resend/Formspree or returns 503. Privacy requests are routed via category "Privacy Request". | [`frontend/src/app/api/contact/route.ts`](file:///Users/aakash/openplanet-climate/frontend/src/app/api/contact/route.ts#L4-L140)<br>[`frontend/src/app/support/page.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/app/support/page.tsx#L48-L75)<br>[`frontend/tests/consent_and_contact.test.mjs`](file:///Users/aakash/openplanet-climate/frontend/tests/consent_and_contact.test.mjs#L68-L150) | **VERIFIED IN CODE** | Owner must configure at least one delivery destination (`RESEND_API_KEY` or `CONTACT_WEBHOOK_URL`) for production. |
| **Authentication / Session Data** | NextAuth uses JWT session cookies. External OAuth provider access tokens are excluded from JWT tokens. No user database is maintained. | [`frontend/src/app/api/auth/[...nextauth]/route.ts`](file:///Users/aakash/openplanet-climate/frontend/src/app/api/auth/[...nextauth]/route.ts#L68-L80) | **VERIFIED IN CODE** | None. |
| **Security Controls** | Layered defenses implemented: SlowAPI rate limiting, Next.js IP rate limiting, OWASP security headers (HSTS in production, CSP, X-Frame-Options: DENY, nosniff, Referrer-Policy), CORS allowlists, and Pydantic validation. | [`climate_engine/api/security.py`](file:///Users/aakash/openplanet-climate/climate_engine/api/security.py#L35-L50)<br>[`tests/test_privacy_security.py`](file:///Users/aakash/openplanet-climate/tests/test_privacy_security.py#L91-L115) | **VERIFIED IN CODE** | Production domain SSL/TLS certificate managed by host. |
| **Data Deletion & Retention** | Browser data can be cleared immediately by users. Server caches auto-expire or evict without linking to user identities. The codebase does not maintain user account tables, so no automated account deletion API is applicable. | [`PRIVACY.md`](file:///Users/aakash/openplanet-climate/PRIVACY.md#L134-L140)<br>[`frontend/src/app/privacy/page.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/app/privacy/page.tsx#L320-L334) | **VERIFIED IN CODE** | Deletion of forwarded webhook/email data is governed by external provider retention policies. |
| **Credential Hygiene & History** | Local `.env` and `hf_space/secrets/` are ignored by git (`.gitignore`). Historical commit inspection identified a legacy `gee-service-account.json` added in commit `2a47f779` and deleted in `afa7221f`. Exposure cannot be ruled out from git history. | [`.gitignore`](file:///Users/aakash/openplanet-climate/.gitignore#L14-L24)<br>Git commit `2a47f779fb1a6c4cc69f9da1a49c247d87aec5e8` | **OWNER CONFIRMATION REQUIRED** | Project owner MUST revoke/rotate this historical Google Earth Engine service account key in the Google Cloud Console immediately if not already completed. |

---

## 3. Implemented Changes

The following safe, necessary code and documentation improvements have been implemented and verified in the repository:

### 3.1 Privacy Documentation Consistency
- **File:** [`PRIVACY.md`](file:///Users/aakash/openplanet-climate/PRIVACY.md)  
  **Changes:** Completely overhauled to OP-PRV-02 standard. Disclosed server-side memory caches (TTLs: 24h to 30d), disk caches (30d to 90d, 5000 max files), full 3-tier external service inventory, logging coarsening, contact form rate-limiting, and clear instructions against posting PII in public GitHub issues.
- **File:** [`frontend/src/app/privacy/page.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/app/privacy/page.tsx)  
  **Changes:** Re-architected into an interactive policy dashboard featuring a live consent management card (status display, Grant and Withdraw buttons), identical 11-section substantive alignment with `PRIVACY.md`, and direct navigation links to `/support`.

### 3.2 Analytics Consent & Withdrawal Mechanics
- **File:** [`frontend/src/components/AnalyticsConsent.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/components/AnalyticsConsent.tsx)  
  **Changes:** Added `getAnalyticsConsent()`, `setAnalyticsConsent()`, `withdrawAnalyticsConsent()`, and `clearAnalyticsCookies()`. Implemented active `window['ga-disable-<ID>'] = true` enforcement upon withdrawal, cross-domain cookie expiration for `_ga*`, and custom event synchronization (`op_consent_change`).
- **File:** [`frontend/src/components/CookieBanner.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/components/CookieBanner.tsx)  
  **Changes:** Upgraded banner into an accessible dialog (`role="dialog"`, `aria-label`). Added listener for `op_open_consent_settings` to allow reopening settings anytime, displaying current decision state, and providing clear "Decline" / "Withdraw Consent" options.
- **File:** [`frontend/src/components/SiteFooter.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/components/SiteFooter.tsx)  
  **Changes:** Added interactive "Cookie Settings" and "Cookie Preferences" triggers in the Legal navigation column and bottom status bar, allowing users on any page to reopen consent controls.

### 3.3 Contact Gateway & Privacy Inquiries Hardening
- **File:** [`frontend/src/app/api/contact/route.ts`](file:///Users/aakash/openplanet-climate/frontend/src/app/api/contact/route.ts)  
  **Changes:** Enforced 64KB maximum body ceiling (`MAX_BODY_BYTES`), client-IP sliding window rate limiting (max 5 requests per 10 minutes), field length restrictions (name: 100, email: 254, organization: 100, category: 50, message: 5000), RFC-compliant email regex format validation, category allowlisting, and zero message body logging.
- **File:** [`frontend/src/app/support/page.tsx`](file:///Users/aakash/openplanet-climate/frontend/src/app/support/page.tsx)  
  **Changes:** Added "Privacy Request" category option. Enforced same-origin endpoint routing for `NEXT_PUBLIC_CONTACT_ENDPOINT` to prevent arbitrary exfiltration. Added clear guidance instructing users to submit data inquiries securely through the form rather than public GitHub issues.

### 3.4 Token Minimization & Lint Hygiene
- **File:** [`frontend/src/app/api/auth/[...nextauth]/route.ts`](file:///Users/aakash/openplanet-climate/frontend/src/app/api/auth/[...nextauth]/route.ts)  
  **Changes:** Removed copying of `account.access_token` into client session JWTs. Fixed fatal ESLint `no-require-imports` error by using top-level `KeycloakProvider` import. Configured Google OAuth default `access_type: "online"`.
- **File:** [`frontend/package.json`](file:///Users/aakash/openplanet-climate/frontend/package.json)  
  **Changes:** Added `"test": "node --test tests/**/*.test.mjs"`.

### 3.5 Privacy-Preserving Logging & Redaction
- **File:** [`climate_engine/api/security.py`](file:///Users/aakash/openplanet-climate/climate_engine/api/security.py) (lines 104–112)  
  **Changes:** Removed logging of API key prefixes (`api_key[:6] + "..."`); logs only key length (`key_len=%d`).
- **File:** [`climate_engine/api/routers/climate.py`](file:///Users/aakash/openplanet-climate/climate_engine/api/routers/climate.py) (lines 55–66)  
  **Changes:** Coarsened logged latitude and longitude from 4 decimal places (~11m pinpoint) to 2 decimal places (`%.2f`, ~1.1km grid cell), and removed raw user `location_hint` logging.
- **File:** [`climate_engine/api/routers/predict.py`](file:///Users/aakash/openplanet-climate/climate_engine/api/routers/predict.py) (lines 120–139)  
  **Changes:** Coarsened geocoding and DEM resolution log coordinates to 2 decimal places.
- **File:** [`climate_engine/api/routers/asi.py`](file:///Users/aakash/openplanet-climate/climate_engine/api/routers/asi.py) (lines 58–67, 193)  
  **Changes:** Coarsened logged coordinates to 2 decimals and masked raw incoming text (`text_len=%d`) instead of printing full user message strings.

### 3.6 Automated Verification Suites
- **File:** [`tests/test_privacy_security.py`](file:///Users/aakash/openplanet-climate/tests/test_privacy_security.py)  
  **Coverage:** 7 automated pytest tests covering disk cache roundtrips, TTL expiry, LRU eviction under file caps, in-memory bounded cache sizing, BoundedTTLCache expiration, OWASP security headers, HSTS in production, and API key log redaction.
- **File:** [`frontend/tests/consent_and_contact.test.mjs`](file:///Users/aakash/openplanet-climate/frontend/tests/consent_and_contact.test.mjs)  
  **Coverage:** 12 automated unit tests covering initial visit consent nullability, granted state persistence, denied state persistence, `ga-disable` flag setting on withdrawal, `_ga*` cookie regex cleanup, contact input validation, oversized field rejection, category allowlisting, and sliding window rate limiting.

### 3.7 CI Pipeline & Environment Documentation
- **File:** [`.github/workflows/main.yml`](file:///Users/aakash/openplanet-climate/.github/workflows/main.yml)  
  **Changes:** Replaced placeholder echo step with a real GitHub Actions CI pipeline executing both backend pytest suite (`pytest tests/`) and frontend checks (`npm test`, `npx tsc --noEmit`, `npm run build`) on push/PR.
- **File:** [`.env.example`](file:///Users/aakash/openplanet-climate/.env.example)  
  **Changes:** Created a clean, comprehensive environment reference at the repository root documenting all backend, caching, optional weather tiers, LLM analysis, NextAuth, and contact gateway variables with zero secrets.

---

## 4. Remaining Limitations

The following items cannot be fully verified from repository source code alone and represent operational boundaries:
1. **Hosting Platform Access Log Retention:** Hugging Face Spaces and Vercel retain edge web server access logs (client IP, request timestamp, HTTP headers). The duration of log retention is determined by the deployment owner's hosting tier agreements and platform settings, not by code in this repository.
2. **Third-Party Provider Retention Policies:** Data transmitted to external APIs (Open-Meteo, NASA POWER, UN Population Division, World Bank, and email delivery providers) is subject to the independent data-retention and privacy policies of those external organizations.
3. **Contact Delivery Secret Provisioning:** In local or default environments, if `RESEND_API_KEY`, `CONTACT_WEBHOOK_URL`, and `CONTACT_FORMSPREE_ENDPOINT` are unset, the contact form returns HTTP 503. The project owner must configure at least one destination in production.
4. **Historical Credential in Git History:** An Earth Engine service account key existed in legacy commit `2a47f779` prior to deletion in `afa7221f`. Even though it is absent from the working tree and `.gitignore` prevents future secret commits, git history retains the commit. The owner must confirm revocation in Google Cloud Console.
5. **Live HTTPS/TLS Enforcement & Domain Certificates:** While code emits `Strict-Transport-Security` headers in production mode, SSL/TLS certificate installation, cipher suites, and automatic HTTP-to-HTTPS redirects are handled by the edge host/DNS provider and must be verified on the live production URL.

---

## 5. Owner Actions Before Submission

Prior to final submission of this clarification package to the DPGA reviewer, the project owner should complete the following verification checklist:

- [ ] **1. Revoke / Rotate Historical GEE Key:** Verify in the Google Cloud Console that the legacy service account key associated with commit `2a47f779` has been revoked/deleted.
- [ ] **2. Verify Production Environment Variables:** Confirm that secrets in the Hugging Face Space settings (`HF_TOKEN`, `GROQ_API_KEY`, `API_KEYS`) and Vercel deployment are secure and not exposed in public repositories.
- [ ] **3. Configure Contact Delivery:** Ensure either `RESEND_API_KEY` + `CONTACT_TO_EMAIL` or `CONTACT_WEBHOOK_URL` is set in production so that users submitting privacy requests via `/support` receive a response.
- [ ] **4. Check Hosting Log Retention Periods:** Confirm the log retention window on Hugging Face Spaces (typically 7–30 days for ephemeral container logs) and Vercel (typically 1–7 days on standard tiers) to accurately inform users upon request.
- [ ] **5. Review Domain & HTTPS Configuration:** Ensure that the production custom domain enforces TLS 1.3 / HTTPS with automatic redirection.

---

## 6. Suggested Reviewer Response (Draft for Owner Review)

*The project owner may adapt and send the following concise, factual statement to the DPGA reviewer once operational confirmations are complete:*

> **Subject:** Clarification Regarding Privacy, Data Handling, and Security for OpenPlanet
>
> Dear DPGA Review Team,
>
> Thank you for your thorough review and constructive feedback regarding the data protection and privacy architecture of the OpenPlanet Climate Risk Intelligence Engine (`aakash029-coder/openplanet-climate`).
>
> In response to your inquiries, we have performed an architectural audit, implemented substantive code and documentation updates, and added automated test verification. Specifically:
>
> 1. **Public, Non-Authenticated Core Functionality:** Core physical climate projections, historical baselines, and adaptation modeling are completely accessible without registration or user identification. Query coordinates are processed on demand and are never linked to personal identities.
> 2. **Persistent Analytics Consent & Immediate Withdrawal:** Google Analytics is disabled by default. It loads strictly upon explicit opt-in consent. Users can change or withdraw consent at any time via the persistent Cookie Settings link in the footer or the `/privacy` dashboard. Withdrawing consent sets `window['ga-disable-<ID>'] = true` to immediately cease event collection and expires tracking cookies across domains.
> 3. **Transparent Cache & Log Management:** All server-side caches have been audited and documented: in-memory caches have bounded TTLs (24h to 30d) and capacity limits, while persistent disk caches enforce a 5,000 file cap via LRU modification-time eviction. Backend logging coarsens coordinates to 2 decimal places (~1.1 km) to avoid micro-location recording, and API keys are completely redacted from logs.
> 4. **Secure Privacy Request Gateway:** The support interface at `/support` now features a dedicated "Privacy Request" category, protected by a 64KB request ceiling, server-side field length validation, and sliding-window rate limiting. We explicitly advise users against submitting personal information to public GitHub issues.
> 5. **Data Minimization in Sessions:** Upstream OAuth access tokens have been removed from client session JWT objects, retaining only minimal identity information.
> 6. **Comprehensive Policy Alignment:** Both the repository root `PRIVACY.md` and website `/privacy` page have been updated to revision OP-PRV-02 with identical disclosures of our third-party provider inventory, cache lifecycles, and security controls.
>
> All 422 engine test cases, 12 consent/contact unit tests, TypeScript type checks, and production builds pass cleanly in the repository test suite.
>
> A detailed evidence table and technical breakdown are available in `DPGA_PRIVACY_CLARIFICATION.md` in our repository root.
>
> Sincerely,  
> The OpenPlanet Maintainers  
> [https://github.com/aakash029-coder/openplanet-climate](https://github.com/aakash029-coder/openplanet-climate)

---
*End of DPGA Privacy Clarification Document.*

