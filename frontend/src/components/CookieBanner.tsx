'use client';
import React, { useState, useEffect } from 'react';
import { setAnalyticsConsent } from './AnalyticsConsent';

const STORAGE_KEY = 'op_cookies_v1';
const LEGACY_KEY = 'op_consent';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(STORAGE_KEY) && !localStorage.getItem(LEGACY_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    localStorage.setItem(LEGACY_KEY, 'accepted');
    setAnalyticsConsent(true);
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, 'declined');
    localStorage.setItem(LEGACY_KEY, 'declined');
    setAnalyticsConsent(false);
    setVisible(false);
  };

  const dismiss = () => decline();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9000] border-t border-white/[0.05] px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      style={{ background: 'var(--panel)' }}
    >
      <p className="font-mono text-[9px] text-slate-400 leading-relaxed max-w-2xl uppercase tracking-wide">
        OpenPlanet uses <span className="text-white">localStorage only</span> for essential session state.
        Analytics (if configured) are <span className="text-white">disabled by default</span> and only loaded with explicit consent.
        Climate data © Copernicus C3S. Open-source educational instrument — not financial advice.{' '}
        <a href="/privacy" className="text-white underline underline-offset-2">Privacy Policy</a>
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={decline}
          className="px-4 py-2 bg-transparent border border-white/[0.09] text-[9px] font-mono text-slate-400 uppercase tracking-[0.2em] hover:text-white hover:border-white/20 transition-colors"
        >
          Decline
        </button>
        <button
          onClick={accept}
          className="px-6 py-2 bg-white/[0.04] border border-white/[0.09] text-[9px] font-mono text-slate-300 uppercase tracking-[0.2em] hover:text-white hover:border-white/20 transition-colors"
        >
          Accept Analytics
        </button>
      </div>
    </div>
  );
}
