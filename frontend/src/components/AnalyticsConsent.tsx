'use client';

import { useEffect, useState } from 'react';
import { GoogleAnalytics } from '@next/third-parties/google';

export const CONSENT_KEY = 'op_consent_analytics';
export const STORAGE_KEY_V1 = 'op_cookies_v1';
export const LEGACY_KEY = 'op_consent';

export function getAnalyticsConsent(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    if (v === 'granted') return true;
    if (v === 'denied') return false;
  } catch {
    // Storage access restricted (e.g. strict sandboxing)
  }
  return null;
}

export function clearAnalyticsCookies() {
  if (typeof document === 'undefined') return;
  try {
    const cookies = document.cookie.split(';');
    const domains = [
      window.location.hostname,
      '.' + window.location.hostname,
      ...window.location.hostname.split('.').slice(1).map((_, i, arr) => '.' + arr.slice(i).join('.')),
    ];

    for (const cookie of cookies) {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      if (/^_ga|_gid|_gat/.test(name)) {
        for (const path of ['/', '/dashboard', '/support', '/privacy']) {
          // Clear for default domain
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path};`;
          // Clear for explicit domains
          for (const d of domains) {
            if (d) {
              document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; domain=${d};`;
            }
          }
        }
      }
    }
  } catch {
    // Best-effort cleanup
  }
}

export function setAnalyticsConsent(granted: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
    window.localStorage.setItem(STORAGE_KEY_V1, granted ? 'accepted' : 'declined');
    window.localStorage.setItem(LEGACY_KEY, granted ? 'accepted' : 'declined');
  } catch {
    // LocalStorage write failed
  }

  const gaId = process.env.NEXT_PUBLIC_GA_ID || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  if (!granted) {
    // Disable Google Analytics tracking in memory
    if (gaId && typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>)[`ga-disable-${gaId}`] = true;
    }
    clearAnalyticsCookies();
  } else if (gaId && typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>)[`ga-disable-${gaId}`] = false;
  }

  // Dispatch event so all components react
  window.dispatchEvent(new Event('op_consent_change'));
}

export function withdrawAnalyticsConsent() {
  setAnalyticsConsent(false);
}

export function openConsentSettings() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('op_open_consent_settings'));
}

export default function AnalyticsConsent() {
  const [consented, setConsented] = useState<boolean | null>(null);
  const gaId = process.env.NEXT_PUBLIC_GA_ID || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  useEffect(() => {
    setConsented(getAnalyticsConsent());
    const handler = () => {
      const c = getAnalyticsConsent();
      setConsented(c);
      if (c === false && gaId) {
        (window as unknown as Record<string, unknown>)[`ga-disable-${gaId}`] = true;
        clearAnalyticsCookies();
      }
    };
    window.addEventListener('op_consent_change', handler);
    return () => window.removeEventListener('op_consent_change', handler);
  }, [gaId]);

  // Only load analytics if GA ID is configured AND user has explicitly consented
  if (!gaId || consented !== true) {
    return null;
  }

  return <GoogleAnalytics gaId={gaId} />;
}
