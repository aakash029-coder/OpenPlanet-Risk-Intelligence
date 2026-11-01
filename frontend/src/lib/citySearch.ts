import { WORLD_CITIES, WorldCity } from './data/worldCities';

export interface CitySuggestion {
  id: string | number;
  name: string;
  country: string;
  country_code?: string;
  state?: string;
  latitude: number;
  longitude: number;
  lat?: number;
  lng?: number;
  display_name: string;
  population?: number;
  source?: 'local' | 'remote' | 'photon' | 'osm' | 'openmeteo';
  score?: number;
}

/**
 * Strips diacritics and normalizes a string for fast, robust accent-insensitive matching.
 * Examples: "São Paulo" -> "sao paulo", "München" -> "munchen", "Bogotá" -> "bogota".
 */
export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * In-memory LRU query cache for instant responses on backspace or retyping.
 */
const queryCache = new Map<string, CitySuggestion[]>();
const MAX_CACHE_SIZE = 120;

export function getCachedSuggestions(query: string): CitySuggestion[] | undefined {
  const key = normalizeText(query);
  return queryCache.get(key);
}

export function setCachedSuggestions(query: string, suggestions: CitySuggestion[]): void {
  const key = normalizeText(query);
  if (!key) return;
  if (queryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey) queryCache.delete(oldestKey);
  }
  queryCache.set(key, suggestions);
}

export function clearCitySearchCache(): void {
  queryCache.clear();
}

/**
 * Instant 0ms local city search with Google Maps-style hierarchical ranking:
 * 1. Exact match on city name (score ~100k + pop bonus)
 * 2. Exact match on alias (score ~90k + pop bonus)
 * 3. Prefix match on city name (score ~50k + pop bonus - length difference)
 * 4. Word boundary match on multi-word names (e.g. "Town" matches "Cape Town")
 * 5. Prefix match on alias
 * 6. Substring match inside city name
 * 7. Secondary country/state bonus if query contains comma (e.g. "Cairo, Egypt")
 */
export function searchLocalCities(rawQuery: string, limit = 8): CitySuggestion[] {
  const trimmed = rawQuery.trim();
  if (!trimmed) return [];

  const parts = trimmed.split(',').map((p) => normalizeText(p)).filter(Boolean);
  const primary = parts[0] || '';
  const secondary = parts[1] || '';

  if (!primary) return [];

  const matches: Array<{ score: number; city: WorldCity }> = [];

  for (const city of WORLD_CITIES) {
    const normName = normalizeText(city.name);
    const normCountry = normalizeText(city.country);
    const normState = city.state ? normalizeText(city.state) : '';
    const normAliases = (city.aliases || []).map((a) => normalizeText(a));

    let score = -1;

    // 1. Exact match on city name
    if (normName === primary) {
      score = 100000;
    }
    // 2. Exact match on alias
    else if (normAliases.includes(primary)) {
      score = 90000;
    }
    // 3. Name starts with query (Prefix match)
    else if (normName.startsWith(primary)) {
      // Prioritize shorter names when query matches prefix (e.g. "cai" -> "Cairo" before "Cairns" if closer)
      score = 50000 - (normName.length - primary.length) * 15;
    }
    // 4. Word boundary match on multi-word city names (e.g. 'Town' in 'Cape Town', 'York' in 'New York')
    else if (normName.split(/\s+/).some((w) => w.startsWith(primary))) {
      score = 35000;
    }
    // 5. Alias starts with query
    else if (normAliases.some((a) => a.startsWith(primary))) {
      score = 30000;
    }
    // 6. Substring match inside city name
    else if (primary.length >= 2 && normName.includes(primary)) {
      score = 15000;
    }
    // 7. State or Country match (only if query is 3+ chars)
    else if (primary.length >= 3 && (normState.startsWith(primary) || normCountry.startsWith(primary))) {
      score = 5000;
    }

    if (score < 0) continue;

    // Secondary query bonus (e.g. "Cairo, Egypt" or "New York, US")
    if (secondary) {
      if (
        normCountry.startsWith(secondary) ||
        normState.startsWith(secondary) ||
        city.country_code.toLowerCase() === secondary
      ) {
        score += 25000;
      }
    }

    // Population tie-breaker bonus (up to 20,000 pts)
    const popBonus = Math.min(20000, Math.floor((city.population || 0) / 1000));
    score += popBonus;

    matches.push({ score, city });
  }

  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, limit).map(({ score, city }) => {
    const partsList = [city.name, city.state, city.country].filter(Boolean);
    const display_name = partsList.join(', ');
    return {
      id: city.id,
      name: city.name,
      country: city.country,
      country_code: city.country_code,
      state: city.state,
      latitude: city.latitude,
      longitude: city.longitude,
      lat: city.latitude,
      lng: city.longitude,
      display_name,
      population: city.population,
      source: 'local',
      score,
    };
  });
}

/**
 * Deduplicates and merges remote suggestions with local ones.
 * Keeps local suggestions high in ranking and adds new distinct remote cities.
 */
export function mergeSuggestions(
  local: CitySuggestion[],
  remote: CitySuggestion[],
  limit = 8
): CitySuggestion[] {
  const seen = new Set<string>();
  const merged: CitySuggestion[] = [];

  for (const item of local) {
    const key = `${normalizeText(item.name)}|${normalizeText(item.country)}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  for (const item of remote) {
    const key = `${normalizeText(item.name)}|${normalizeText(item.country)}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
      if (merged.length >= limit) break;
    }
  }

  return merged.slice(0, limit);
}

/**
 * Fetches remote geocoding candidates with AbortSignal.
 * Fails gracefully and returns empty array on network failure or abort.
 */
export async function fetchRemoteGeocodeCandidates(
  query: string,
  signal?: AbortSignal
): Promise<CitySuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  try {
    const res = await fetch(`/api/geocode-search?q=${encodeURIComponent(trimmed)}`, {
      headers: { Accept: 'application/json' },
      signal,
    });

    if (!res.ok) return [];

    const data: {
      results?: Array<{
        id: string;
        name: string;
        display_name: string;
        country: string;
        country_code?: string;
        latitude: number;
        longitude: number;
        source?: string;
      }>;
    } = await res.json();

    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map((c, idx) => ({
      id: c.id || `remote-${idx}-${c.name}`,
      name: c.name,
      display_name: c.display_name || `${c.name}, ${c.country}`,
      country: c.country,
      country_code: c.country_code,
      latitude: c.latitude,
      longitude: c.longitude,
      lat: c.latitude,
      lng: c.longitude,
      source: (c.source as CitySuggestion['source']) || 'remote',
    }));
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return [];
    }
    return [];
  }
}
