export const metadata = {
  title: 'Privacy Policy — OpenPlanet',
  description: 'Data handling practices for OpenPlanet Climate Risk Intelligence Platform.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen font-sans" style={{ background: 'var(--canvas)', color: 'var(--text)' }}>
      <main className="max-w-3xl mx-auto px-6 py-24">

        {/* Header */}
        <div className="mb-12 pb-8" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] mb-4" style={{ color: 'var(--muted)' }}>
            Document Ref: OP-PRV-01 · Last updated: October 29, 2026
          </p>
          <h1 className="font-sans text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            Privacy Policy
          </h1>
          <p className="font-serif text-[0.9rem] leading-relaxed" style={{ color: 'var(--text-2)' }}>
            OpenPlanet is an open-source climate risk intelligence platform. The core analysis can be used without an account.
            This policy describes how the application behaves in its current implementation, including optional integrations.
          </p>
        </div>

        <div className="space-y-10 font-serif text-[0.875rem] leading-relaxed" style={{ color: 'var(--text-2)' }}>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>1.0</span>
              Core Climate Risk Analysis
            </h2>
            <p className="mb-3">
              Searching for a location and viewing projections does not require an account. The analysis uses geographic
              coordinates (latitude/longitude) to generate results. These coordinates are not automatically linked to an
              authenticated identity by the application. Location data may be sent to external services used by the deployment
              (e.g., data APIs/proxies), and those services may receive technical information such as IP addresses.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>2.0</span>
              Authentication (Optional)
            </h2>
            <p className="mb-3">
              Sign-in is optional and only enabled if the site operator configures providers. OpenPlanet uses NextAuth.js
              with a JWT session strategy. If you sign in with Google, Keycloak, Authentik, or a configured OIDC provider,
              the application may receive your name and email address from that provider as authorized. Sessions are
              managed by NextAuth (typically via HTTP(S) cookies for JWT sessions); this codebase does not maintain a
              custom user database.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>3.0</span>
              Analytics and Consent
            </h2>
            <p className="mb-3">
              Google Analytics may be enabled by the site operator via <code>NEXT_PUBLIC_GA_ID</code> or{' '}
              <code>NEXT_PUBLIC_GA_MEASUREMENT_ID</code>. Analytics is disabled by default and only loads after explicit
              consent via the consent banner. If you decline, it is not loaded. Consent is stored in{' '}
              <code>localStorage</code> (<code>op_consent_analytics</code>, <code>op_cookies_v1</code>,{' '}
              <code>op_consent</code>). Analytics can be disabled entirely by not configuring a GA ID.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>4.0</span>
              Contact Form
            </h2>
            <p className="mb-3">
              Submitting the contact form sends name, email, organization (optional), category, and message to{' '}
              <code>/api/contact</code>. The backend validates input but does not store submissions in a custom database
              or file in this codebase. It forwards to a configured provider in order: webhook, Resend, or Formspree.
              If none are configured, the endpoint returns 503 and the submission is not delivered by the application.
              Data sent to external providers is subject to their policies.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>5.0</span>
              Local Storage, Session Storage, and Cookies
            </h2>
            <ul className="space-y-2 pl-4" style={{ borderLeft: '1px solid var(--hairline)' }}>
              <li className="pl-4">
                <strong style={{ color: 'var(--text)' }}>localStorage:</strong> <code>op_consent_analytics</code>,{' '}
                <code>op_cookies_v1</code>, <code>op_consent</code> (consent), and <code>op_sync_state</code>{' '}
                (UI/scenario preferences).
              </li>
              <li className="pl-4">
                <strong style={{ color: 'var(--text)' }}>sessionStorage:</strong> <code>hasSeenDesktopWarning</code> (UI flag).
              </li>
              <li className="pl-4">
                <strong style={{ color: 'var(--text)' }}>Cookies:</strong> Authentication cookies may be set by NextAuth.js
                when sign-in is enabled; no custom application tracking cookies are implemented in this codebase.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>6.0</span>
              Third-Party Services
            </h2>
            <p>
              Depending on configuration, the deployment may communicate with authentication providers (Google/Keycloak/Authentik/OIDC),
              Google Analytics (consent-gated), mapping services, climate/data APIs (Open-Meteo/NASA/HF Space proxies),
              geocoding (Photon), fonts (next/font), and contact delivery providers (webhook/Resend/Formspree). These services
              may receive technical information such as IP addresses. Their handling is governed by their respective policies.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>7.0</span>
              Retention and Deletion
            </h2>
            <p>
              This application does not implement persistent storage of contact submissions or user profiles in a custom
              database. Browser storage holds preferences/consent only. When data is forwarded to external providers,
              retention and deletion are governed by those providers and the operator&apos;s configuration. No automated
              deletion mechanism is implemented in this codebase.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>8.0</span>
              User Rights and Contact
            </h2>
            <p>
              To raise privacy requests, contact the maintainers via the project&apos;s official GitHub repository:{' '}
              <a href="https://github.com/aakash029-coder/openplanet-climate" style={{ textDecoration: 'underline' }}>
                https://github.com/aakash029-coder/openplanet-climate
              </a>
              . Please avoid including passwords or tokens in public issues. Fulfillment depends on what data is held
              (browser-local data or data held by configured external providers).
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-base mb-3 flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>9.0</span>
              Legal Considerations
            </h2>
            <p>
              OpenPlanet aims to follow privacy-by-design principles (data minimization, transparency, configurability).
              Considerations include India&apos;s DPDP Act, 2023 and the EU GDPR where applicable, but publishing this policy
              does not establish legal compliance. Compliance depends on implementation, deployment configuration, and
              applicable obligations.
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8" style={{ borderTop: '1px solid var(--hairline)' }}>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
            OpenPlanet is an open-source project. All projections are for informational and research purposes.
          </p>
        </div>

      </main>
    </div>
  );
}
