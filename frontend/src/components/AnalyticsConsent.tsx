'use client';

import { useEffect, useState } from 'react';
import { GoogleAnalytics } from '@next/third-parties/google';

const CONSENT_KEY = 'op_consent_analytics';

function getConsent(): boolean | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(CONSENT_KEY);
  if (v === 'granted') return true;
  if (v === 'denied') return false;
  return null;
}

export function setAnalyticsConsent(granted: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
  // Dispatch event so components can react
  window.dispatchEvent(new Event('op_consent_change'));
}

export default function AnalyticsConsent() {
  const [consented, setConsented] = useState<boolean | null>(null);
  const gaId = process.env.NEXT_PUBLIC_GA_ID || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  useEffect(() => {
    setConsented(getConsent());
    const handler = () => setConsented(getConsent());
    window.addEventListener('op_consent_change', handler);
    return () => window.removeEventListener('op_consent_change', handler);
  }, []);

  // Only load analytics if GA ID is configured AND user has consented
  if (!gaId || consented !== true) {
    return null;
  }

  return <GoogleAnalytics gaId={gaId} />;
}
