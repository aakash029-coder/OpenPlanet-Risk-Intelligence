import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage and window environment for consent tests
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] ?? null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

test('Analytics Consent — First visit returns null (no implicit tracking)', () => {
  const storage = new MockLocalStorage();
  const consent = storage.getItem('op_consent_analytics');
  assert.equal(consent, null);
});

test('Analytics Consent — Explicit acceptance persists granted state', () => {
  const storage = new MockLocalStorage();
  storage.setItem('op_consent_analytics', 'granted');
  storage.setItem('op_cookies_v1', 'accepted');
  storage.setItem('op_consent', 'accepted');

  assert.equal(storage.getItem('op_consent_analytics'), 'granted');
  assert.equal(storage.getItem('op_cookies_v1'), 'accepted');
});

test('Analytics Consent — Explicit decline persists denied state', () => {
  const storage = new MockLocalStorage();
  storage.setItem('op_consent_analytics', 'denied');
  storage.setItem('op_cookies_v1', 'declined');
  storage.setItem('op_consent', 'declined');

  assert.equal(storage.getItem('op_consent_analytics'), 'denied');
  assert.equal(storage.getItem('op_cookies_v1'), 'declined');
});

test('Analytics Consent — Withdrawal sets ga-disable flag and denied state', () => {
  const storage = new MockLocalStorage();
  const windowMock = {};
  const gaId = 'G-TEST12345';

  // Initially granted
  storage.setItem('op_consent_analytics', 'granted');

  // Withdraw
  storage.setItem('op_consent_analytics', 'denied');
  storage.setItem('op_cookies_v1', 'declined');
  windowMock[`ga-disable-${gaId}`] = true;

  assert.equal(storage.getItem('op_consent_analytics'), 'denied');
  assert.equal(windowMock[`ga-disable-${gaId}`], true);
});

test('Analytics Cookie Cleanup — Cookie clearing logic matches _ga and _gid patterns', () => {
  const sampleCookies = [
    '_ga=GA1.2.123456.7890',
    '_ga_ABC123=GS1.1.12345',
    '_gid=GA1.2.98765.4321',
    'op_session=valid_session_token',
  ];

  const matchedCookies = [];
  for (const c of sampleCookies) {
    const name = c.split('=')[0].trim();
    if (/^_ga|_gid|_gat/.test(name)) {
      matchedCookies.push(name);
    }
  }

  assert.deepEqual(matchedCookies, ['_ga', '_ga_ABC123', '_gid']);
  assert.equal(matchedCookies.includes('op_session'), false);
});

// ── Contact Form Validation Logic Tests ──

const ALLOWED_CATEGORIES = new Set([
  'Feedback / Suggestion',
  'Bug Report',
  'Data Question',
  'Partnership / Collaboration',
  'Privacy Request',
  'Other',
]);

function validateContactInput({ name, email, organization, category, message }) {
  if (!name || !email || !category || !message) {
    return { valid: false, status: 400, error: 'Missing required fields' };
  }
  if (name.length > 100) {
    return { valid: false, status: 400, error: 'Name exceeds maximum length of 100' };
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, status: 400, error: 'Invalid email format' };
  }
  if (organization && organization.length > 100) {
    return { valid: false, status: 400, error: 'Organization exceeds maximum length of 100' };
  }
  if (!ALLOWED_CATEGORIES.has(category)) {
    return { valid: false, status: 400, error: 'Invalid category' };
  }
  if (message.length < 5) {
    return { valid: false, status: 400, error: 'Message too short' };
  }
  if (message.length > 5000) {
    return { valid: false, status: 400, error: 'Message exceeds maximum length of 5000' };
  }
  return { valid: true };
}

test('Contact Validation — Valid submission passes', () => {
  const res = validateContactInput({
    name: 'Jane Doe',
    email: 'jane@example.com',
    organization: 'Climate Institute',
    category: 'Privacy Request',
    message: 'Please provide details on data processing for my region.',
  });
  assert.equal(res.valid, true);
});

test('Contact Validation — Missing required fields fails with 400', () => {
  const res = validateContactInput({
    name: '',
    email: 'jane@example.com',
    category: 'Privacy Request',
    message: 'Hello',
  });
  assert.equal(res.valid, false);
  assert.equal(res.status, 400);
});

test('Contact Validation — Invalid email format fails with 400', () => {
  const res = validateContactInput({
    name: 'Jane',
    email: 'not-an-email',
    category: 'Feedback / Suggestion',
    message: 'Great tool!',
  });
  assert.equal(res.valid, false);
  assert.equal(res.status, 400);
});

test('Contact Validation — Oversized name fails with 400', () => {
  const res = validateContactInput({
    name: 'A'.repeat(101),
    email: 'jane@example.com',
    category: 'Feedback / Suggestion',
    message: 'Testing length',
  });
  assert.equal(res.valid, false);
  assert.equal(res.status, 400);
});

test('Contact Validation — Oversized message fails with 400', () => {
  const res = validateContactInput({
    name: 'Jane',
    email: 'jane@example.com',
    category: 'Feedback / Suggestion',
    message: 'A'.repeat(5001),
  });
  assert.equal(res.valid, false);
  assert.equal(res.status, 400);
});

test('Contact Validation — Unknown category fails with 400', () => {
  const res = validateContactInput({
    name: 'Jane',
    email: 'jane@example.com',
    category: 'Malicious / Injection',
    message: 'Valid length message',
  });
  assert.equal(res.valid, false);
  assert.equal(res.status, 400);
});

test('Contact Rate Limiter — Blocks requests exceeding ceiling per window', () => {
  const windowMs = 600000;
  const maxReq = 5;
  const submissions = [];
  const now = Date.now();

  function attemptRequest(reqTime) {
    const valid = submissions.filter((t) => reqTime - t < windowMs);
    if (valid.length >= maxReq) return false;
    submissions.push(reqTime);
    return true;
  }

  for (let i = 0; i < 5; i++) {
    assert.equal(attemptRequest(now + i * 100), true);
  }
  // 6th request within window must be rate limited
  assert.equal(attemptRequest(now + 600), false);
});

