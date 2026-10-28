# Privacy Policy — OpenPlanet

**Last updated: October 29, 2026**

## 1. Core Climate Risk Analysis

OpenPlanet allows users to explore climate risks and projections without creating an account. The core analysis uses geographic coordinates (such as latitude and longitude) to generate location-specific results. No name, email address, or other identifying information is required to use the core analysis.

Coordinates are processed to produce the requested outputs. The application does not automatically link coordinates to an authenticated identity in the codebase. However, location data may be processed by external services that the deployment uses (see Section 6), and those services may receive technical information such as IP addresses as part of normal network communication.

## 2. Authentication (Optional)

Sign-in is optional and only available if the site operator has configured authentication providers. If enabled, OpenPlanet uses [NextAuth.js](https://next-auth.js.org/) with a JWT session strategy.

When a user signs in with Google, Keycloak, Authentik, or a configured generic OIDC provider, the application receives the profile information that the provider returns and authorizes (typically including name and email address, depending on provider scopes/configuration). This information is used to maintain the authenticated session. The application does **not** maintain a custom user database in this repository — session state is managed by NextAuth. With the JWT strategy, session information is typically stored in an HTTP(S) session cookie managed by NextAuth; no custom cookie schema for user profiles is implemented in the application code.

Authentication is not required for the core climate risk analysis.

## 3. Analytics and Cookies

Google Analytics may be enabled by the site operator via environment variables (`NEXT_PUBLIC_GA_ID` or `NEXT_PUBLIC_GA_MEASUREMENT_ID`). 

**Consent gating (as implemented):**
- Analytics is **disabled by default**. 
- The consent banner allows users to Accept Analytics or Decline. 
- The `AnalyticsConsent` component only loads `@next/third-parties/google`'s `GoogleAnalytics` if a GA measurement ID is configured **and** the user has explicitly granted consent (`localStorage` key `op_consent_analytics` set to `granted`). 
- If consent is declined or not yet given, analytics is not loaded. 
- Consent choices are stored in the browser (`localStorage`: `op_consent_analytics`, `op_cookies_v1`, `op_consent` for compatibility). The banner can be dismissed/declined, which prevents analytics from loading.

Analytics can be completely disabled by the site operator (by not configuring a GA ID) regardless of consent.

## 4. Contact Form

If a user submits the contact form on the Support page, the following fields may be collected: name, email address, organization (optional), category, and message. The form posts JSON to the backend proxy at `/api/contact` (or to `NEXT_PUBLIC_CONTACT_ENDPOINT` if configured).

**As implemented:**
- The backend endpoint (`frontend/src/app/api/contact/route.ts`) validates required fields, email format, and message length (max 5000 characters). It does **not** write submissions to a database or file in this codebase.
- Delivery is attempted in order: a configured webhook (`CONTACT_WEBHOOK_URL`), then Resend (`RESEND_API_KEY` + `CONTACT_TO_EMAIL`), then Formspree (`CONTACT_FORMSPREE_ENDPOINT` or `FORMSPREE_ENDPOINT`). 
- If no delivery provider is configured, the endpoint returns `503 Service Unavailable` with an error indicating contact delivery is not configured. Submissions are forwarded to external providers when configured; retention of those submissions is governed by the policies of those external providers, not by this application code.
- Contact information is used for communication and support. It is not sold to third parties by this application.

## 5. Local Storage, Session Storage, and Cookies

The application uses browser storage as follows (as implemented):

**localStorage:**
- `op_consent_analytics` — analytics consent state (`granted`/`denied`)
- `op_cookies_v1`, `op_consent` — consent/banner state (legacy compatibility)
- `op_sync_state` — UI/state preferences (e.g., scenario/controls) used to synchronize views; contains application state, not authentication credentials

**sessionStorage:**
- `hasSeenDesktopWarning` — UI flag for the dashboard

**Cookies:**
- Authentication-related cookies may be set by NextAuth.js when authentication is enabled (managed by the NextAuth library according to its configuration). No custom application cookies for tracking are set by the code reviewed.

Users can clear browser storage through their settings; doing so may reset preferences and consent choices.

## 6. Third-Party Services

Depending on deployment configuration, OpenPlanet may communicate with external services:

- **Authentication:** Google OAuth, Keycloak, Authentik, or generic OIDC (via NextAuth) — may receive authentication requests and profile information as configured.
- **Analytics:** Google Analytics (via `@next/third-parties`, consent-gated) — may receive technical information if enabled and consented.
- **Mapping:** MapLibre/Mapbox/Deck.gl with configurable map style (`NEXT_PUBLIC_MAP_STYLE_URL`, defaults to CARTO); map tile providers may receive requests/IP addresses.
- **Climate/data APIs:** Open-Meteo (via server-side tunnel/proxy), NASA POWER (via tunnel), Hugging Face Space (`albus2903-openplanet-engine.hf.space`) via proxy, and other sources as configured.
- **Geocoding:** Photon (via tunnel allowlist) in some flows.
- **Fonts:** Google Fonts via `next/font/google` (loaded at build time in typical Next.js setups).
- **Contact delivery:** Webhook, Resend, or Formspree (when configured).

These services may receive technical information (including IP addresses) as part of normal network communication. Their handling is governed by their respective privacy policies. OpenPlanet aims to keep integrations configurable to support alternative or self-hosted options where possible.

## 7. Data Retention and Deletion

- **Application-managed storage:** This codebase does not implement persistent storage of contact form submissions, user profiles, or query history in a custom database. Preferences and consent are stored locally in the user's browser.
- **Authentication sessions:** Session lifetimes are determined by NextAuth configuration and provider settings; no custom retention/deletion logic for user data is implemented in this repository.
- **External providers:** When data is forwarded to webhooks, Resend, Formspree, analytics providers, or other third parties, retention and deletion are governed by those providers' policies and the operator's configuration. This application cannot guarantee deletion of data held by external services.
- **No implemented deletion mechanism:** There is no code path in this repository that deletes user data from external systems or provides an automated deletion API.

## 8. Your Privacy Rights

Depending on your location and applicable law, you may have rights regarding your personal data. To raise a privacy request, contact the OpenPlanet maintainers through the project's official GitHub repository:

**https://github.com/aakash029-coder/openplanet-climate**

Please avoid including passwords, authentication tokens, or other sensitive information in public issues. Requests will be reviewed in accordance with applicable legal requirements and the data this project actually holds. The ability to fulfill requests depends on what data is stored (which may be limited to browser-local data or data held by configured external providers).

## 9. Privacy and Legal Considerations

OpenPlanet aims to follow privacy-by-design principles (data minimization, transparency, configurability). The project considers applicable privacy requirements such as India's Digital Personal Data Protection Act, 2023 and the EU General Data Protection Regulation (GDPR) where relevant. However, **publishing this policy does not, by itself, establish legal compliance** — actual compliance depends on the implementation, deployment configuration, data handling practices, and applicable legal obligations of the operator.

## 10. Changes to This Policy

This policy may be updated when functionality, integrations, or data handling practices change. The latest version will be published in this repository with an updated revision date.
