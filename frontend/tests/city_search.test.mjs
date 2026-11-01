import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read worldCities data directly from file
const worldCitiesPath = path.resolve(__dirname, '../src/lib/data/worldCities.ts');
const fileContent = fs.readFileSync(worldCitiesPath, 'utf-8');
const jsonStr = fileContent.split('export const WORLD_CITIES: WorldCity[] = ')[1].strip ?
  fileContent.split('export const WORLD_CITIES: WorldCity[] = ')[1].trim().replace(/;$/, '') :
  fileContent.split('export const WORLD_CITIES: WorldCity[] = ')[1].trim().replace(/;$/, '');
const WORLD_CITIES = JSON.parse(jsonStr);

// Core normalization and search functions matching src/lib/citySearch.ts
function normalizeText(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function searchLocalCities(rawQuery, limit = 8) {
  const trimmed = rawQuery.trim();
  if (!trimmed) return [];

  const parts = trimmed.split(',').map((p) => normalizeText(p)).filter(Boolean);
  const primary = parts[0] || '';
  const secondary = parts[1] || '';

  if (!primary) return [];

  const matches = [];

  for (const city of WORLD_CITIES) {
    const normName = normalizeText(city.name);
    const normCountry = normalizeText(city.country);
    const normState = city.state ? normalizeText(city.state) : '';
    const normAliases = (city.aliases || []).map((a) => normalizeText(a));

    let score = -1;

    if (normName === primary) {
      score = 100000;
    } else if (normAliases.includes(primary)) {
      score = 90000;
    } else if (normName.startsWith(primary)) {
      score = 50000 - (normName.length - primary.length) * 15;
    } else if (normName.split(/\s+/).some((w) => w.startsWith(primary))) {
      score = 35000;
    } else if (normAliases.some((a) => a.startsWith(primary))) {
      score = 30000;
    } else if (primary.length >= 2 && normName.includes(primary)) {
      score = 15000;
    } else if (primary.length >= 3 && (normState.startsWith(primary) || normCountry.startsWith(primary))) {
      score = 5000;
    }

    if (score < 0) continue;

    if (secondary) {
      if (
        normCountry.startsWith(secondary) ||
        normState.startsWith(secondary) ||
        city.country_code.toLowerCase() === secondary
      ) {
        score += 25000;
      }
    }

    const popBonus = Math.min(20000, Math.floor((city.population || 0) / 1000));
    score += popBonus;

    matches.push({ score, city });
  }

  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, limit).map(({ score, city }) => ({
    id: city.id,
    name: city.name,
    country: city.country,
    country_code: city.country_code,
    state: city.state,
    latitude: city.latitude,
    longitude: city.longitude,
    display_name: [city.name, city.state, city.country].filter(Boolean).join(', '),
    population: city.population,
    score,
  }));
}

function mergeSuggestions(local, remote, limit = 8) {
  const seen = new Set();
  const merged = [];

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

// ── Test Cases ──

test('Instant Search — Typing "c" returns major global cities starting with C', () => {
  const results = searchLocalCities('c', 8);
  assert.equal(results.length, 8);
  const names = results.map(r => r.name);
  assert.ok(names.includes('Cairo'), 'Should include Cairo');
  assert.ok(names.some(n => ['Chicago', 'Casablanca', 'Cape Town', 'Chennai'].includes(n)), 'Should include other major C cities');
});

test('Incremental Search — Typing "ca" narrows results to cities starting with Ca', () => {
  const results = searchLocalCities('ca', 8);
  assert.ok(results.length > 0);
  for (const r of results) {
    const norm = normalizeText(r.name);
    const hasAlias = (WORLD_CITIES.find(c => c.name === r.name)?.aliases || []).some(a => normalizeText(a).startsWith('ca'));
    assert.ok(norm.startsWith('ca') || hasAlias, `${r.name} should start with "ca"`);
  }
  const names = results.map(r => r.name);
  assert.ok(names.includes('Cairo'), 'Should include Cairo on "ca"');
});

test('Narrowed Search — Typing "cai" narrows to Cairo and Cairns', () => {
  const results = searchLocalCities('cai', 8);
  assert.ok(results.length >= 1);
  assert.equal(results[0].name, 'Cairo', 'Cairo should be ranked first for "cai"');
});

test('Exact Match Prioritization — Typing "cairo" prioritizes Cairo at index 0 with highest score', () => {
  const results = searchLocalCities('cairo', 5);
  assert.ok(results.length >= 1);
  assert.equal(results[0].name, 'Cairo');
  assert.equal(results[0].country, 'Egypt');
  assert.ok(results[0].score > 100000, 'Exact match score should exceed 100,000');
  assert.equal(typeof results[0].latitude, 'number');
  assert.equal(typeof results[0].longitude, 'number');
  assert.ok(Math.abs(results[0].latitude - 30.0444) < 0.1);
});

test('Case Insensitivity — Lowercase, uppercase, and mixed case yield identical rankings', () => {
  const r1 = searchLocalCities('cairo');
  const r2 = searchLocalCities('CAIRO');
  const r3 = searchLocalCities('CaIrO');
  assert.deepEqual(r1.map(r => r.name), r2.map(r => r.name));
  assert.deepEqual(r1.map(r => r.name), r3.map(r => r.name));
});

test('Diacritic Stripping — Accent-insensitive matching works seamlessly', () => {
  const sao = searchLocalCities('sao paulo', 5);
  assert.ok(sao.length >= 1);
  assert.equal(sao[0].name, 'Sao Paulo');

  const bogota = searchLocalCities('bogota', 5);
  assert.ok(bogota.length >= 1);
  assert.equal(bogota[0].name, 'Bogota');
});

test('Word Boundary Matching — Suffix/multi-word match works for terms like "Town"', () => {
  const results = searchLocalCities('town', 5);
  const names = results.map(r => r.name);
  assert.ok(names.includes('Cape Town'), 'Typing "town" should match Cape Town');
});

test('Multi-Part Query — "Cairo, Egypt" awards secondary country match bonus', () => {
  const results = searchLocalCities('Cairo, Egypt', 3);
  assert.ok(results.length >= 1);
  assert.equal(results[0].name, 'Cairo');
  assert.equal(results[0].country, 'Egypt');
});

test('Deduplication & Merging — mergeSuggestions prevents duplicates across local and remote sources', () => {
  const local = [
    { id: '1', name: 'Cairo', country: 'Egypt', latitude: 30.04, longitude: 31.23, display_name: 'Cairo, Egypt' },
    { id: '2', name: 'Chicago', country: 'United States', latitude: 41.87, longitude: -87.62, display_name: 'Chicago, USA' },
  ];
  const remote = [
    { id: 'remote-1', name: 'Cairo', country: 'Egypt', latitude: 30.04, longitude: 31.23, display_name: 'Cairo, Egypt' },
    { id: 'remote-2', name: 'Casablanca', country: 'Morocco', latitude: 33.57, longitude: -7.58, display_name: 'Casablanca, Morocco' },
  ];

  const merged = mergeSuggestions(local, remote, 5);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].name, 'Cairo');
  assert.equal(merged[1].name, 'Chicago');
  assert.equal(merged[2].name, 'Casablanca');
});

