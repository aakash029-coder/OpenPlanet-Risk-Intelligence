'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  withdrawAnalyticsConsent,
} from '@/components/AnalyticsConsent';

export default function PrivacyPage() {
  const [consentState, setConsentState] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<string>('');

  useEffect(() => {
    const syncState = () => {
      setConsentState(getAnalyticsConsent());
    };
    // Sync asynchronously after initial render to avoid cascading updates
    const t = setTimeout(syncState, 0);
    window.addEventListener('op_consent_change', syncState);
    return () => {
      clearTimeout(t);
      window.removeEventListener('op_consent_change', syncState);
    };
  }, []);

  const handleGrant = () => {
    setAnalyticsConsent(true);
    setFeedback('Analytics consent granted. Preferences saved.');
    setTimeout(() => setFeedback(''), 4000);
  };

  const handleWithdraw = () => {
    withdrawAnalyticsConsent();
    setFeedback('Analytics consent withdrawn and cookies cleared.');
    setTimeout(() => setFeedback(''), 4000);
  };

  return (
    <div className="min-h-screen font-sans" style={{ background: 'var(--canvas, #080c16)', color: 'var(--text, #f1f5f9)' }}>
      <main className="max-w-4xl mx-auto px-6 py-20">

        {/* Header */}
        <div className="mb-12 pb-8" style={{ borderBottom: '1px solid var(--hairline, rgba(255,255,255,0.08))' }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] mb-4" style={{ color: 'var(--muted, #94a3b8)' }}>
            Document Ref: OP-PRV-02 · Revision: Verified November 2026
          </p>
          <h1 className="font-sans text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            Privacy Policy & Data-Flow Architecture
          </h1>
          <p className="font-serif text-[0.95rem] leading-relaxed" style={{ color: 'var(--text-2, #cbd5e1)' }}>
            OpenPlanet is an open-source physical climate risk intelligence platform. The core climate engine
            can be accessed entirely without an account. This document outlines verified data-handling
            practices, server-side caching, external services, and user controls across the platform.
          </p>
        </div>

        {/* Interactive Consent Management Card */}
        <div className="mb-14 p-6 rounded-xl border border-white/[0.1] bg-white/[0.02] backdrop-blur-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <h2 className="font-mono text-xs uppercase tracking-[0.2em] font-semibold text-white">
                  Your Analytics Consent Settings
                </h2>
              </div>
              <p className="font-mono text-[11px] text-slate-400">
                Current status:{' '}
                <span className="font-semibold text-white">
                  {consentState === true
                    ? 'Granted (Google Analytics active if configured)'
                    : consentState === false
                    ? 'Denied (Analytics blocked, cookies cleared)'
                    : 'Not set (Analytics disabled by default)'}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={handleGrant}
                className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded transition-colors"
              >
                Accept Analytics
              </button>
              <button
                type="button"
                onClick={handleWithdraw}
                className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider bg-transparent hover:bg-white/10 border border-white/20 text-slate-300 rounded transition-colors"
              >
                Withdraw / Decline
              </button>
            </div>
          </div>
          {feedback && (
            <p className="font-mono text-[10px] text-emerald-400 animate-in fade-in duration-300">
              ✓ {feedback}
            </p>
          )}
          <p className="font-serif text-xs text-slate-400 leading-relaxed border-t border-white/5 pt-3">
            Withdrawing consent immediately sets Google Analytics tracking flags to disabled in memory and expires
            local tracking cookies (<code className="text-slate-300">_ga</code>, <code className="text-slate-300">_gid</code>).
            Note that third-party JavaScript libraries already loaded into memory during the active session cannot be
            un-executed by the browser without reloading the page, but all subsequent event collection is blocked.
          </p>
        </div>

        {/* Substantive Sections */}
        <div className="space-y-12 font-serif text-[0.9rem] leading-relaxed" style={{ color: 'var(--text-2, #cbd5e1)' }}>

          {/* Section 1 */}
          <section>
            <h2 className="font-sans font-semibold text-lg mb-3 flex items-center gap-3 text-white">
              <span className="font-mono text-xs text-cyan-400">1.0</span>
              Core Climate Risk Analysis & Location Processing
            </h2>
            <p className="mb-3">
              OpenPlanet allows users to explore physical climate risk projections, heat stress metrics,
              and adaptation scenarios without registration or authentication.
            </p>
            <p className="mb-3">
              To produce location-specific results, the engine accepts geographic coordinates (latitude and longitude)
              or location query strings (city names). These coordinates are processed on demand to query meteorological
              reanalysis grids and CMIP6 climate model projections.
            </p>
            <p className="mb-3">
              <strong>Identity Disassociation:</strong> Coordinates and location inputs are never linked to personal
              identities, user profiles, or authenticated accounts by the application code.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="font-sans font-semibold text-lg mb-3 flex items-center gap-3 text-white">
              <span className="font-mono text-xs text-cyan-400">2.0</span>
              Optional Authentication & Token Handling
            </h2>
            <p className="mb-3">
              User sign-in is completely optional and only active if the site operator explicitly configures OAuth or OIDC
              credentials (Google OAuth, Keycloak, Authentik, or generic OIDC).
            </p>
            <p className="mb-3">
              When authentication is enabled:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-300 mb-3">
              <li>Sessions are managed via NextAuth.js using an encrypted JSON Web Token (JWT) session cookie.</li>
              <li>No custom user database is created or maintained in this codebase.</li>
              <li><strong>Data Minimization:</strong> Upstream OAuth provider access tokens are deliberately excluded from JWT session payloads to prevent unnecessary credential exposure.</li>
              <li>Authentication is strictly prohibited from being a prerequisite for public climate risk analysis.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="font-sans font-semibold text-lg mb-3 flex items-center gap-3 text-white">
              <span className="font-mono text-xs text-cyan-400">3.0</span>
              Analytics, Cookies, and Persistent Consent Choices
            </h2>
            <p className="mb-3">
              Google Analytics may optionally be enabled by the deployment operator via environment variables
              (<code className="text-slate-300">NEXT_PUBLIC_GA_ID</code> or <code className="text-slate-300">NEXT_PUBLIC_GA_MEASUREMENT_ID</code>).
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-300 mb-3">
              <li><strong>Disabled by Default:</strong> No analytics scripts or tracking beacons are loaded unless explicit opt-in consent is recorded.</li>
              <li><strong>Persistent Choice:</strong> User consent state is stored in browser localStorage (<code className="text-slate-300">op_consent_analytics</code>).</li>
              <li><strong>Withdrawal at Any Time:</strong> Users can reopen settings via the interactive panel above, the &ldquo;Cookie Settings&rdquo; link in the footer, or the cookie banner, and withdraw consent instantly.</li>
              <li><strong>Cookie Cleanup:</strong> Withdrawing consent sets <code className="text-slate-300">window[&apos;ga-disable-&lt;ID&gt;&apos;] = true</code> and expires tracking cookies (<code className="text-slate-300">_ga</code>, <code className="text-slate-300">_gid</code>) across active domains.</li>
              <li><strong>Technical Limitation Disclosure:</strong> Deleting client cookies prevents subsequent tracking events; however, it does not retroactively retract information transmitted to Google servers prior to withdrawal.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="font-sans font-semibold text-lg mb-3 flex items-center gap-3 text-white">
              <span className="font-mono text-xs text-cyan-400">4.0</span>
              Server-Side Caching (Memory and Disk)
            </h2>
            <p className="mb-3">
              To minimize upstream API consumption, comply with rate limits, and ensure sub-second response times on public cloud tiers,
              OpenPlanet implements multi-tiered server-side caching:
            </p>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded">
                <strong className="text-white block font-mono text-[11px] mb-1">Transient In-Memory Caches:</strong>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>ERA5 Relative Humidity:</strong> Keyed by 2-decimal rounded coordinates (~1.1 km grid cell) with a 24-hour TTL.</li>
                  <li><strong>Historical Eras Cache:</strong> Thread-safe bounded LRU cache capped at 10,000 cells with a 7-day TTL.</li>
                  <li><strong>City Socioeconomic Cache:</strong> Bounded LRU cache capped at 1,000 cities with a 7-day TTL.</li>
                  <li><strong>Country Indicators Cache:</strong> Bounded LRU cache capped at 300 ISO3 country entries with a 30-day TTL.</li>
                </ul>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded">
                <strong className="text-white block font-mono text-[11px] mb-1">Persistent Disk Cache:</strong>
                <p className="mb-1">
                  Stored locally at <code className="text-slate-300">OPENPLANET_CACHE_DIR</code> (default <code className="text-slate-300">climate_engine/data/cache</code>)
                  with a hard cap of 5,000 JSON files governed by LRU modification-time eviction:
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>ERA5 Daily Bundles:</strong> 30-day TTL, keyed by SHA-1 digest of rounded coordinates.</li>
                  <li><strong>CMIP6 Projections:</strong> 30-day TTL, keyed by SHA-1 digest of model, scenario, and coordinates.</li>
                  <li><strong>World Bank CCKP Delta:</strong> 30-day TTL, keyed by ISO3 country and scenario.</li>
                  <li><strong>Copernicus DEM Elevation:</strong> 90-day TTL, keyed by coordinates.</li>
                </ul>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Disk and memory caches contain meteorological numbers, elevation metrics, and demographic indicators.
              They never store personal identities, email addresses, or user credentials.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="font-sans font-semibold text-lg mb-3 flex items-center gap-3 text-white">
              <span className="font-mono text-xs text-cyan-400">5.0</span>
              Comprehensive Third-Party Service Inventory
            </h2>
            <p className="mb-3">
              Depending on deployment configuration, OpenPlanet interfaces with external data sources and infrastructure:
            </p>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded">
                <strong className="text-cyan-400 block font-mono text-[11px] mb-1">Active Core Services:</strong>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Open-Meteo (<code className="text-slate-300">open-meteo.com</code>):</strong> Historical ERA5 reanalysis, CMIP6 climate model projections, Copernicus DEM elevation, and geocoding. Requests pass coordinates and query strings.</li>
                  <li><strong>NASA POWER (<code className="text-slate-300">power.larc.nasa.gov</code>):</strong> Solar/meteorological reanalysis used as a high-availability fallback tier.</li>
                  <li><strong>Photon (<code className="text-slate-300">photon.komoot.io</code>):</strong> OpenStreetMap-derived geocoding autocomplete.</li>
                  <li><strong>Nominatim / OpenStreetMap (<code className="text-slate-300">openstreetmap.org</code>):</strong> City administrative boundary extraction and spatial mesh generation.</li>
                  <li><strong>OpenTopoData (<code className="text-slate-300">opentopodata.org</code>):</strong> SRTM 30m digital elevation model fallback.</li>
                  <li><strong>UN Population Division API (<code className="text-slate-300">population.un.org</code>):</strong> Country-level crude death rates (Indicator 59) for epidemiological baseline calculations.</li>
                  <li><strong>World Bank CCKP (<code className="text-slate-300">cckpapi.worldbank.org</code>):</strong> Country-level CMIP6 temperature anomaly fallback.</li>
                  <li><strong>CARTO / MapLibre:</strong> Base map vector and raster styling tiles.</li>
                </ul>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded">
                <strong className="text-amber-300 block font-mono text-[11px] mb-1">Optional / Configurable Integrations:</strong>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Weatherstack (<code className="text-slate-300">weatherstack.com</code>):</strong> Commercial historical weather fallback (inactive unless <code className="text-slate-300">WEATHERSTACK_API_KEY</code> configured).</li>
                  <li><strong>Meteostat / RapidAPI (<code className="text-slate-300">rapidapi.com</code>):</strong> Historical weather fallback (inactive unless <code className="text-slate-300">METEOSTAT_API_KEY</code> configured).</li>
                  <li><strong>Visual Crossing (<code className="text-slate-300">visualcrossing.com</code>):</strong> Tertiary weather fallback (inactive unless <code className="text-slate-300">VISUAL_CROSSING_API_KEY</code> configured).</li>
                  <li><strong>Groq / OpenAI-compatible LLM:</strong> Generates strategic plain-language summaries from aggregate climate numbers (no personal user data sent; disabled if unconfigured).</li>
                  <li><strong>Google Analytics:</strong> Web analytics; loaded strictly upon explicit opt-in consent.</li>
                  <li><strong>NextAuth Identity Providers:</strong> Google, Keycloak, Authentik, or generic OIDC when enabled by operator.</li>
                  <li><strong>Contact Delivery:</strong> Webhook (<code className="text-slate-300">CONTACT_WEBHOOK_URL</code>), Resend API, or Formspree.</li>
                </ul>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded">
                <strong className="text-slate-200 block font-mono text-[11px] mb-1">Hosting Platforms:</strong>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Hugging Face Spaces:</strong> Hosts the containerized FastAPI Python climate engine.</li>
                  <li><strong>Vercel (or alternative Next.js host):</strong> Hosts the Next.js frontend and edge API routes.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="font-sans font-semibold text-lg mb-3 flex items-center gap-3 text-white">
              <span className="font-mono text-xs text-cyan-400">6.0</span>
              Application Logging, Redaction, and Retention
            </h2>
            <p className="mb-3">
              Application logging is restricted to operational diagnostics, rate-limiting enforcement, and error monitoring:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-300 mb-3">
              <li><strong>Coordinate Coarsening:</strong> Coordinates logged by backend engines are coarsened to 2 decimal places (~1.1 km) to avoid recording micro-level pinpoint coordinates.</li>
              <li><strong>Zero Credential Logging:</strong> API keys, bearer tokens, passwords, and session secrets are completely excluded from log entries. Invalid key attempts log only key length.</li>
              <li><strong>Distributed Tracing:</strong> Requests carry a unique UUIDv4 <code className="text-slate-300">X-Request-ID</code> header for diagnostic tracing without exposing internal state.</li>
              <li><strong>Public Error Masking:</strong> In production mode, public 500 error responses return a generic message referencing the Request ID, avoiding internal stack trace exposure.</li>
              <li><strong>Hosting Retention Limitation:</strong> Underlying access logs (client IP, HTTP headers, timestamps) are generated by hosting platforms (Hugging Face Spaces, Vercel). Their exact retention duration depends on operator hosting agreements (typically 1 hour to 1 day on standard Vercel tiers, and ephemeral container runtime on Hugging Face Spaces) and is not determined by application source code.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="font-sans font-semibold text-lg mb-3 flex items-center gap-3 text-white">
              <span className="font-mono text-xs text-cyan-400">7.0</span>
              Contact Form & Secure Privacy Requests
            </h2>
            <p className="mb-3">
              Users may submit feedback, inquiries, or privacy requests through the support interface (<Link href="/support" className="text-cyan-400 underline">/support</Link>).
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-300 mb-3">
              <li><strong>Input Validation:</strong> Strict server-side validation enforces character limits on name (100), email (254), organization (100), category (50), and message (5000), along with a 64KB maximum payload ceiling.</li>
              <li><strong>Abuse Protection:</strong> Submissions are rate-limited per client IP (maximum 5 requests per 10-minute window).</li>
              <li><strong>No Internal Database Storage:</strong> Contact submissions are never written to a local database or persistent disk log in this repository.</li>
              <li><strong>Delivery Gateways:</strong> Valid messages are forwarded directly to the operator&apos;s configured webhook, Resend email, or Formspree endpoint. If no delivery service is configured, the endpoint returns HTTP 503 with maintainer contact email <a href="mailto:aakash@openplanetrisk.com" className="text-cyan-400 underline">aakash@openplanetrisk.com</a> without storing data.</li>
              <li><strong>Privacy Inquiries:</strong> To raise a data inquiry or deletion request, select category <em>&ldquo;Privacy Request&rdquo;</em> in the contact form or email project maintainers directly at <a href="mailto:aakash@openplanetrisk.com" className="text-cyan-400 underline">aakash@openplanetrisk.com</a>. All privacy requests are handled manually. <strong>Do not post personal information, email addresses, or coordinates in public GitHub issues</strong>, as public issues are permanently visible to the web.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="font-sans font-semibold text-lg mb-3 flex items-center gap-3 text-white">
              <span className="font-mono text-xs text-cyan-400">8.0</span>
              Browser Storage Inventory
            </h2>
            <ul className="space-y-2 pl-4 text-xs text-slate-300 border-l border-white/10">
              <li>
                <strong className="text-white">localStorage:</strong>{' '}
                <code className="text-slate-300">op_consent_analytics</code> (analytics consent flag),{' '}
                <code className="text-slate-300">op_cookies_v1</code> & <code className="text-slate-300">op_consent</code> (compatibility flags),{' '}
                <code className="text-slate-300">op_sync_state</code> (UI scenario preferences, non-PII).
              </li>
              <li>
                <strong className="text-white">sessionStorage:</strong>{' '}
                <code className="text-slate-300">hasSeenDesktopWarning</code> (UI dismissal flag).
              </li>
              <li>
                <strong className="text-white">Cookies:</strong>{' '}
                NextAuth session cookie (only if sign-in is configured and used); Google Analytics cookies (<code className="text-slate-300">_ga</code>, <code className="text-slate-300">_gid</code>) only after explicit opt-in.
              </li>
            </ul>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="font-sans font-semibold text-lg mb-3 flex items-center gap-3 text-white">
              <span className="font-mono text-xs text-cyan-400">9.0</span>
              Data Retention, Deletion, and Privacy Rights
            </h2>
            <p className="mb-3">
              Because OpenPlanet does not operate a user registration database or store query history, data retention is minimized:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-300 mb-3">
              <li><strong>Browser-side data:</strong> Can be removed instantly at any time by clearing browser cookies and localStorage.</li>
              <li><strong>Server caches:</strong> Expire automatically via TTL (24 hours to 90 days) and LRU capacity bounds. These caches store climate numbers against coordinates and do not link to user identities.</li>
              <li><strong>External service retention:</strong> Data forwarded to third-party providers (Open-Meteo, NASA, webhook recipients, analytics) is governed by their respective retention policies.</li>
              <li><strong>Automated Deletion Limitation:</strong> There is no automated account deletion API in this repository because no user account records or profile tables are maintained.</li>
            </ul>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="font-sans font-semibold text-lg mb-3 flex items-center gap-3 text-white">
              <span className="font-mono text-xs text-cyan-400">10.0</span>
              Security Architecture
            </h2>
            <p className="mb-3">
              The application incorporates layered security controls:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-300 mb-3">
              <li><strong>Security Headers:</strong> Strict-Transport-Security (HSTS), X-Content-Type-Options (nosniff), X-Frame-Options (DENY), Referrer-Policy (strict-origin-when-cross-origin), and Permissions-Policy.</li>
              <li><strong>CORS Hardening:</strong> Configurable origin allowlists via environment settings.</li>
              <li><strong>API Rate Limiting:</strong> SlowAPI limits request rates on all engine endpoints; client IP rate limiting protects the contact gateway.</li>
              <li><strong>Input Validation:</strong> Pydantic v2 schemas validate all backend payloads; Next.js routes validate request types and sizes.</li>
            </ul>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="font-sans font-semibold text-lg mb-3 flex items-center gap-3 text-white">
              <span className="font-mono text-xs text-cyan-400">11.0</span>
              Regulatory Considerations & Honest Limitations
            </h2>
            <p className="mb-3">
              OpenPlanet is engineered according to privacy-by-design principles (data minimization, storage limitation, transparency).
              Architectural decisions reference the European Union General Data Protection Regulation (GDPR) and India&apos;s
              Digital Personal Data Protection Act, 2023 (DPDP Act).
            </p>
            <p className="mb-3 text-amber-200/90 bg-amber-500/10 border border-amber-500/20 p-4 rounded text-xs leading-relaxed">
              <strong>Compliance Disclaimer:</strong> Publishing this open-source privacy policy does not constitute legal certification or guaranteed statutory compliance.
              Final legal compliance is the sole responsibility of the deployment operator, based on their production infrastructure,
              custom domain configuration, third-party provider agreements, and local regulatory jurisdiction.
            </p>
          </section>

        </div>

        {/* Footer info */}
        <div className="mt-16 pt-8 border-t border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400">
            OpenPlanet Climate Intelligence Engine · Open Source
          </p>
          <div className="flex items-center gap-4">
            <Link href="/support" className="font-mono text-[9px] uppercase tracking-wider text-cyan-400 hover:underline">
              Contact Maintainers
            </Link>
            <Link href="/dashboard" className="font-mono text-[9px] uppercase tracking-wider text-slate-400 hover:text-white">
              Launch Dashboard
            </Link>
          </div>
        </div>

      </main>
    </div>
  );
}
