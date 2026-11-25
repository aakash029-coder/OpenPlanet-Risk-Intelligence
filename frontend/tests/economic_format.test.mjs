import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read formatEconomicRange implementation directly from ClimateDataContext.tsx
const contextPath = path.resolve(__dirname, '../src/context/ClimateDataContext.tsx');
const fileContent = fs.readFileSync(contextPath, 'utf-8');

// Extract and strip TypeScript annotations for Node test runner
const fnMatch = fileContent.match(/export function formatEconomicRange[\s\S]*?\n\}/);
if (!fnMatch) {
  throw new Error('formatEconomicRange not found in ClimateDataContext.tsx');
}

const jsCode = fnMatch[0]
  .replace('export function formatEconomicRange(usd: number): string', 'function formatEconomicRange(usd)')
  .replace('(v: number)', '(v)');

const formatEconomicRange = new Function(`${jsCode}; return formatEconomicRange;`)();

test('formatEconomicRange - values below $1M formatted in thousands ($161K – $189K)', () => {
  // User example: $175,000 -> low: $161,000 ($161K), high: $189,000 ($189K)
  assert.equal(formatEconomicRange(175000), '$161K – $189K');

  // La Paz cold anomaly floor (~$170,595)
  // low: 156947.4 -> $157K, high: 184242.6 -> $184K
  assert.equal(formatEconomicRange(170595), '$157K – $184K');

  // $500,000 -> low: $460K, high: $540K
  assert.equal(formatEconomicRange(500000), '$460K – $540K');
});

test('formatEconomicRange - boundary crossing ($874K – $1M)', () => {
  // $950,000 -> low: 874000 ($874K), high: 1026000 ($1M)
  assert.equal(formatEconomicRange(950000), '$874K – $1M');
});

test('formatEconomicRange - values above $1M remain unchanged in millions ($M) and billions ($B)', () => {
  // $2.4M (Quito) -> low: $2M, high: $3M
  assert.equal(formatEconomicRange(2433659), '$2M – $3M');

  // $60M (Bogota) -> low: $55M, high: $65M
  assert.equal(formatEconomicRange(60000000), '$55M – $65M');

  // $4.94B (Singapore) -> low: $4.5B, high: $5.3B
  assert.equal(formatEconomicRange(4944243439), '$4.5B – $5.3B');
});

test('formatEconomicRange - handles zero gracefully', () => {
  assert.equal(formatEconomicRange(0), '$0 – $0');
});
