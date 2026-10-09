import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  PRERENDER_KEY_HEADER, MIN_SECRET_LENGTH, configuredSecret, isValidPrerenderKey,
  prerenderLimit, createApiRateLimit,
} from '../utils/prerenderRateLimit.js';

const SECRET = 'test-secret-'.padEnd(MIN_SECRET_LENGTH + 8, 'x');
const silent = { log() {}, warn() {}, error() {} };

/** Real express + express-rate-limit, tiny limits, routes mirroring the backend. */
async function startApp({ secret, apiMax = 2, prerenderMax = 5, logs = [] }) {
  const app = express();
  app.set('trust proxy', 1);
  const apiLimiter = rateLimit({ windowMs: 60_000, max: apiMax, standardHeaders: true, legacyHeaders: false, message: 'Too many requests, please try again later.' });
  const prerenderLimiter = rateLimit({ windowMs: 60_000, max: prerenderMax, keyGenerator: () => 'edge-prerender', standardHeaders: true, legacyHeaders: false });
  const log = { log: (m) => logs.push(m), warn: (m) => logs.push(m), error: (m) => logs.push(m) };
  app.use('/api', createApiRateLimit({ apiLimiter, prerenderLimiter, getSecret: () => secret, log }));
  app.get('/api/shared-app-report', (req, res) => res.json({ ok: true, edge: !!req.isEdgePrerender }));
  app.get('/api/shared-competitor-report', (req, res) => res.json({ ok: true, edge: !!req.isEdgePrerender }));
  app.get('/api/db-analyses', (req, res) => res.json({ ok: true, edge: !!req.isEdgePrerender }));
  app.post('/api/analyze', (req, res) => res.json({ ok: true, edge: !!req.isEdgePrerender }));
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { key, method = 'GET', ip = '203.0.113.7' } = {}) => {
    const headers = { 'x-forwarded-for': ip };
    if (key !== undefined) headers[PRERENDER_KEY_HEADER] = key;
    const res = await fetch(base + path, { method, headers });
    const text = await res.text();
    return { status: res.status, body: text, remaining: res.headers.get('ratelimit-remaining') };
  };
  return { call, close: () => new Promise((r) => server.close(r)) };
}

describe('prerender rate limit', () => {
  it('configuredSecret: unset / blank / too short means disabled', () => {
    expect(configuredSecret({})).to.equal(null);
    expect(configuredSecret({ PRERENDER_SHARED_SECRET: '   ' })).to.equal(null);
    expect(configuredSecret({ PRERENDER_SHARED_SECRET: 'short' })).to.equal(null);
    expect(configuredSecret({ PRERENDER_SHARED_SECRET: ` ${SECRET} ` })).to.equal(SECRET);
  });

  it('isValidPrerenderKey: exact match only', () => {
    expect(isValidPrerenderKey(SECRET, SECRET)).to.equal(true);
    expect(isValidPrerenderKey(SECRET + 'x', SECRET)).to.equal(false);
    expect(isValidPrerenderKey('', SECRET)).to.equal(false);
    expect(isValidPrerenderKey(undefined, SECRET)).to.equal(false);
    expect(isValidPrerenderKey(SECRET, null)).to.equal(false);
  });

  it('prerenderLimit env override', () => {
    expect(prerenderLimit({})).to.equal(3000);
    expect(prerenderLimit({ PRERENDER_RATE_LIMIT_MAX: '500' })).to.equal(500);
    expect(prerenderLimit({ PRERENDER_RATE_LIMIT_MAX: 'nope' })).to.equal(3000);
  });

  it('valid key on the edge read endpoints uses the separate budget (per-IP limit not consumed)', async () => {
    const app = await startApp({ secret: SECRET });
    try {
      // Same IP as normal traffic; 5 edge calls succeed although the per-IP limit is 2.
      for (let i = 0; i < 5; i++) {
        const path = ['/api/shared-app-report', '/api/shared-competitor-report', '/api/db-analyses'][i % 3];
        const r = await app.call(`${path}?shareId=x`, { key: SECRET });
        expect(r.status).to.equal(200);
        expect(JSON.parse(r.body).edge).to.equal(true);
      }
      // The separate budget is itself limited (6th edge call).
      expect((await app.call('/api/shared-app-report', { key: SECRET })).status).to.equal(429);
      // Normal clients from that IP still have their full per-IP budget.
      expect((await app.call('/api/shared-app-report')).remaining).to.equal('1');
    } finally { await app.close(); }
  });

  it('secret missing: header ignored, exactly the old per-IP behaviour', async () => {
    const logs = [];
    const app = await startApp({ secret: null, logs });
    try {
      expect((await app.call('/api/shared-app-report', { key: SECRET })).status).to.equal(200);
      expect((await app.call('/api/shared-app-report', { key: SECRET })).status).to.equal(200);
      const third = await app.call('/api/shared-app-report', { key: SECRET });
      expect(third.status).to.equal(429);
      expect(third.body).to.equal('Too many requests, please try again later.');
      expect(logs.join('\n')).to.match(/disabled/);
    } finally { await app.close(); }
  });

  it('wrong key, other endpoints, non-GET: per-IP limit applies', async () => {
    const app = await startApp({ secret: SECRET, apiMax: 3 });
    try {
      const r1 = await app.call('/api/shared-app-report', { key: 'wrong' });
      expect(JSON.parse(r1.body).edge).to.equal(false);
      const r2 = await app.call('/api/analyze', { key: SECRET, method: 'POST' });
      expect(JSON.parse(r2.body).edge).to.equal(false);
      const r3 = await app.call('/api/shared-app-report?x=1', { key: SECRET.toUpperCase() });
      expect(JSON.parse(r3.body).edge).to.equal(false);
      expect((await app.call('/api/shared-app-report', { key: 'wrong' })).status).to.equal(429);
    } finally { await app.close(); }
  });

  it('never logs the secret', async () => {
    const logs = [];
    const app = await startApp({ secret: SECRET, logs });
    try {
      await app.call('/api/shared-app-report', { key: SECRET });
      await app.call('/api/shared-app-report', { key: 'wrong' });
      expect(logs.join('\n')).to.match(/enabled/);
      expect(logs.join('\n')).to.not.include(SECRET);
    } finally { await app.close(); }
  });
});
