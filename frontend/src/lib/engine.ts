/**
 * Server-side helper for resolving the Python climate engine base URL.
 * Reads ENGINE_URL from server environment variables (never exposed to the client),
 * defaults to http://localhost:7860 for local/self-hosted deployments, and strips
 * any trailing slashes.
 */
export function getEngineBaseUrl(): string {
  const raw = process.env.ENGINE_URL?.trim();
  const base = raw && raw.length > 0 ? raw : 'http://localhost:7860';
  return base.replace(/\/+$/, '');
}

