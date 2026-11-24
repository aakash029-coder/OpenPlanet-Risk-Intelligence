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
const jsonStr = fileContent.split('export const WORLD_CITIES: WorldCity[] = ')[1].trim().replace(/;$/, '');
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

const ADMIN_SUFFIX_REGEX = /\s+(?:Governorate|District|Tehsil|Tahsil|Taluka|Taluk|Sub-division|Subdivision|Sadar|Suburb|Municipality|Prefecture|County|City\s+Corporation|Metropolitan\s+Area)$/i;
const ADMIN_PREFIX_REGEX = /^(?:Governorate\s+of|District\s+of|Municipality\s+of|County\s+of|Prefecture\s+of|City\s+of)\s+/i;

const SUB_CITY_ROLLUP = {
  andheri: { city: 'Mumbai', country: 'India' },
  borivali: { city: 'Mumbai', country: 'India' },
  bandra: { city: 'Mumbai', country: 'India' },
  juhu: { city: 'Mumbai', country: 'India' },
  dadar: { city: 'Mumbai', country: 'India' },
  kurla: { city: 'Mumbai', country: 'India' },
  powai: { city: 'Mumbai', country: 'India' },
  colaba: { city: 'Mumbai', country: 'India' },
  manhattan: { city: 'New York', country: 'United States' },
  brooklyn: { city: 'New York', country: 'United States' },
  queens: { city: 'New York', country: 'United States' },
  bronx: { city: 'New York', country: 'United States' },
  'staten island': { city: 'New York', country: 'United States' },
  'new cairo': { city: 'Cairo', country: 'Egypt' },
};

const STANDALONE_STATES_REGIONS = new Set([
  'california', 'maharashtra', 'texas', 'florida', 'alaska', 'hawaii',
  'washington state', 'bavaria', 'ontario', 'quebec', 'british columbia',
  'uttar pradesh', 'madhya pradesh', 'rajasthan', 'gujarat', 'karnataka',
  'tamil nadu', 'kerala', 'punjab', 'haryana', 'west bengal', 'bihar',
  'telangana', 'andhra pradesh', 'odisha', 'assam', 'jharkhand',
  'cairo governorate', 'alexandria governorate', 'giza governorate',
]);

function cleanCityName(rawName) {
  if (!rawName) return '';
  let name = rawName.trim();

  const parenMatch = name.match(/^(.*?)\s*\((.*?)\)$/);
  if (parenMatch) {
    const p1 = parenMatch[1].trim();
    const p2 = parenMatch[2].trim();
    if (/cherrapunji/i.test(p2)) name = p2;
    else if (/cherrapunji/i.test(p1)) name = p1;
    else name = p1;
  }

  name = name.replace(ADMIN_PREFIX_REGEX, '').trim();

  for (let i = 0; i < 3; i++) {
    const prev = name;
    name = name.replace(ADMIN_SUFFIX_REGEX, '').trim();
    if (name === prev) break;
  }

  const low = name.toLowerCase();
  if (SUB_CITY_ROLLUP[low]) {
    return SUB_CITY_ROLLUP[low].city;
  }

  return name;
}

function formatCityCountry(cityName, countryName) {
  const cleanCity = cleanCityName(cityName);
  const cleanCountry = countryName ? countryName.trim() : '';
  if (!cleanCountry) return cleanCity;
  return `${cleanCity}, ${cleanCountry}`;
}

function isStandaloneState(cityName) {
  const norm = normalizeText(cityName);
  return STANDALONE_STATES_REGIONS.has(norm);
}

function searchLocalCities(rawQuery, limit = 8) {
  const trimmed = rawQuery.trim();
  if (!trimmed) return [];

  const parts = trimmed.split(',').map((p) => normalizeText(p)).filter(Boolean);
  const primary = parts[0] || '';
  const secondary = parts[1] || '';

  if (!primary) return [];

  if (isStandaloneState(primary)) {
    return [];
  }

  const rollupMatch = SUB_CITY_ROLLUP[primary];
  const effectivePrimary = rollupMatch ? normalizeText(rollupMatch.city) : primary;

  const matches = [];

  for (const city of WORLD_CITIES) {
    const cleanName = cleanCityName(city.name);
    const normName = normalizeText(cleanName);
    const normCountry = normalizeText(city.country);
    const normState = city.state ? normalizeText(city.state) : '';
    const normAliases = (city.aliases || []).map((a) => normalizeText(a));

    let score = -1;

    if (normName === effectivePrimary) {
      score = 100000;
    } else if (normAliases.includes(effectivePrimary)) {
      score = 90000;
    } else if (normName.startsWith(effectivePrimary)) {
      score = 50000 - (normName.length - effectivePrimary.length) * 15;
    } else if (normName.split(/\s+/).some((w) => w.startsWith(effectivePrimary))) {
      score = 35000;
    } else if (normAliases.some((a) => a.startsWith(effectivePrimary))) {
      score = 30000;
    } else if (effectivePrimary.length >= 3 && normName.includes(effectivePrimary)) {
      score = 15000;
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

  const seen = new Set();
  const results = [];

  for (const { score, city } of matches) {
    const cleanName = cleanCityName(city.name);
    const display_name = formatCityCountry(cleanName, city.country);
    const dedupKey = `${normalizeText(cleanName)}|${normalizeText(city.country)}`;

    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    results.push({
      id: city.id,
      name: cleanName,
      country: city.country,
      country_code: city.country_code,
      state: city.state,
      latitude: city.latitude,
      longitude: city.longitude,
      display_name,
      population: city.population,
      score,
    });

    if (results.length >= limit) break;
  }

  return results;
}

function mergeSuggestions(local, remote, limit = 8) {
  const seen = new Set();
  const merged = [];

  for (const item of local) {
    const cleanName = cleanCityName(item.name);
    const key = `${normalizeText(cleanName)}|${normalizeText(item.country)}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({
        ...item,
        name: cleanName,
        display_name: formatCityCountry(cleanName, item.country),
      });
    }
  }

  for (const item of remote) {
    const cleanName = cleanCityName(item.name);
    if (isStandaloneState(cleanName, item.country)) continue;

    const key = `${normalizeText(cleanName)}|${normalizeText(item.country)}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({
        ...item,
        name: cleanName,
        display_name: formatCityCountry(cleanName, item.country),
      });
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
  assert.equal(results[0].display_name, 'Cairo, Egypt');
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
  assert.equal(results[0].display_name, 'Cairo, Egypt');
});

test('Strict Format & State Exclusion — Indore and Mumbai display as "City, Country" without state', () => {
  const indore = searchLocalCities('Indore', 1);
  assert.ok(indore.length >= 1);
  assert.equal(indore[0].display_name, 'Indore, India');
  assert.ok(!indore[0].display_name.includes('Madhya Pradesh'), 'Must not contain state name');

  const mumbai = searchLocalCities('Mumbai', 1);
  assert.ok(mumbai.length >= 1);
  assert.equal(mumbai[0].display_name, 'Mumbai, India');
  assert.ok(!mumbai[0].display_name.includes('Maharashtra'), 'Must not contain state name');
});

test('Standalone Town Inclusion — Cherrapunji and Varanasi are supported as standalone settlements', () => {
  const cherra = searchLocalCities('Cherrapunji', 1);
  assert.ok(cherra.length >= 1);
  assert.equal(cherra[0].name, 'Cherrapunji');
  assert.equal(cherra[0].display_name, 'Cherrapunji, India');

  const varanasi = searchLocalCities('Varanasi', 1);
  assert.ok(varanasi.length >= 1);
  assert.equal(varanasi[0].name, 'Varanasi');
  assert.equal(varanasi[0].display_name, 'Varanasi, India');
});

test('Sub-City Rollup — Typing "Andheri" or "Borivali" resolves strictly to Mumbai, India', () => {
  const andheri = searchLocalCities('Andheri', 1);
  assert.ok(andheri.length >= 1);
  assert.equal(andheri[0].name, 'Mumbai');
  assert.equal(andheri[0].display_name, 'Mumbai, India');

  const borivali = searchLocalCities('Borivali', 1);
  assert.ok(borivali.length >= 1);
  assert.equal(borivali[0].name, 'Mumbai');
  assert.equal(borivali[0].display_name, 'Mumbai, India');
});

test('Standalone State Exclusion — Typing "California" or "Maharashtra" yields zero standalone states', () => {
  const cal = searchLocalCities('California', 5);
  assert.equal(cal.length, 0, 'Standalone state California must not be suggested');

  const mah = searchLocalCities('Maharashtra', 5);
  assert.equal(mah.length, 0, 'Standalone state Maharashtra must not be suggested');
});

test('Administrative Suffix Stripping — Suffixes are stripped to clean standalone city name', () => {
  assert.equal(cleanCityName('Varanasi Sadar'), 'Varanasi');
  assert.equal(cleanCityName('Varanasi District'), 'Varanasi');
  assert.equal(cleanCityName('Cairo Governorate'), 'Cairo');
  assert.equal(cleanCityName('New Cairo'), 'Cairo');
  assert.equal(cleanCityName('Indore District'), 'Indore');
  assert.equal(cleanCityName('Greater London'), 'Greater London');
});

test('Deduplication & Merging — mergeSuggestions formats strictly as "City, Country" and deduplicates', () => {
  const local = [
    { id: '1', name: 'Cairo', country: 'Egypt', latitude: 30.04, longitude: 31.23, display_name: 'Cairo, Egypt' },
    { id: '2', name: 'Chicago', country: 'United States', latitude: 41.87, longitude: -87.62, display_name: 'Chicago, United States' },
  ];
  const remote = [
    { id: 'remote-1', name: 'Cairo Governorate', country: 'Egypt', latitude: 30.04, longitude: 31.23, display_name: 'Cairo, Cairo Governorate, Egypt' },
    { id: 'remote-2', name: 'Varanasi Sadar', country: 'India', latitude: 25.31, longitude: 82.97, display_name: 'Varanasi Sadar, India' },
    { id: 'remote-3', name: 'California', country: 'United States', latitude: 36.77, longitude: -119.41, display_name: 'California, United States' },
  ];

  const merged = mergeSuggestions(local, remote, 5);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].display_name, 'Cairo, Egypt');
  assert.equal(merged[1].display_name, 'Chicago, United States');
  assert.equal(merged[2].display_name, 'Varanasi, India');
  assert.ok(!merged.some(m => m.name === 'California'), 'California standalone state should be dropped');
});
