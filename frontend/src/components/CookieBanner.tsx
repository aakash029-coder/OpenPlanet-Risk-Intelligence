'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  setAnalyticsConsent,
  withdrawAnalyticsConsent,
  getAnalyticsConsent,
  STORAGE_KEY_V1,
  LEGACY_KEY,
} from './AnalyticsConsent';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [currentConsent, setCurrentConsent] = useState<boolean | null>(null);

  const checkConsent = useCallback(() => {
    if (typeof window === 'undefined') return;
    const consent = getAnalyticsConsent();
    setCurrentConsent(consent);

    const hasStoredChoice =
      localStorage.getItem(STORAGE_KEY_V1) || localStorage.getItem(LEGACY_KEY);

    if (consent === null && !hasStoredChoice) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    checkConsent();

    const openHandler = () => {
      setCurrentConsent(getAnalyticsConsent());
      setVisible(true);
    };

    const consentChangeHandler = () => {
      setCurrentConsent(getAnalyticsConsent());
    };

    window.addEventListener('op_open_consent_settings', openHandler);
    window.addEventListener('op_consent_change', consentChangeHandler);

    return () => {
      window.removeEventListener('op_open_consent_settings', openHandler);
      window.removeEventListener('op_consent_change', consentChangeHandler);
    };
  }, [checkConsent]);

  if (!visible) return null;

  const accept = () => {
    setAnalyticsConsent(true);
    setVisible(false);
  };

  const decline = () => {
    withdrawAnalyticsConsent();
    setVisible(false);
  };

  const close = () => {
    // If user hasn't made a choice yet, treat close as decline for privacy-by-default
    if (currentConsent === null) {
      decline();
    } else {
      setVisible(false);
    }
  };

  return (
    <aside
      role="dialog"
      aria-label="Cookie & Analytics Consent"
      className="fixed bottom-0 left-0 right-0 z-[9000] border-t border-white/[0.08] px-5 py-4 shadow-2xl backdrop-blur-md"
      style={{ background: 'var(--panel, rgba(10, 15, 29, 0.96))' }}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 animate-pulse" />
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white font-semibold">
              Privacy & Analytics Choice
            </h2>
            {currentConsent !== null && (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded border border-white/10 text-slate-400">
                Current: {currentConsent ? 'Analytics Granted' : 'Analytics Declined'}
              </span>
            )}
          </div>
          <p className="font-mono text-[9px] text-slate-400 leading-relaxed uppercase tracking-wide">
            OpenPlanet uses <span className="text-white">localStorage only</span> for essential session preferences.
            Analytics (Google Analytics) are <span className="text-white">disabled by default</span> and only loaded with your explicit consent.
            You can change or withdraw your choice at any time. Climate data © Copernicus C3S.{' '}
            <a href="/privacy" className="text-white underline underline-offset-2 hover:text-amber-200 transition-colors">
              Read Privacy Policy
            </a>
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={decline}
            className="px-4 py-2 bg-transparent border border-white/[0.12] text-[9px] font-mono text-slate-300 uppercase tracking-[0.2em] hover:text-white hover:border-white/30 transition-colors rounded"
          >
            {currentConsent === true ? 'Withdraw Consent' : 'Decline'}
          </button>
          <button
            type="button"
            onClick={accept}
            className="px-5 py-2 bg-white/[0.08] border border-white/[0.2] text-[9px] font-mono text-white uppercase tracking-[0.2em] hover:bg-white/[0.15] hover:border-white/40 transition-colors rounded"
          >
            {currentConsent === true ? 'Keep Granted' : 'Accept Analytics'}
          </button>
          {currentConsent !== null && (
            <button
              type="button"
              onClick={close}
              aria-label="Close consent settings"
              className="px-3 py-2 text-slate-400 hover:text-white text-[11px] font-mono border border-transparent hover:border-white/10 transition-colors rounded"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
