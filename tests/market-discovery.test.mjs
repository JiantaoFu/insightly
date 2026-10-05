import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createMarketDiscovery, storeIdentity, verifiedCandidate } from '../server/marketDiscovery.js';
import { extractAppStoreId } from '../server/appStoreScraper.js';

const candidate = id => verifiedCandidate({ title: `Photo app ${id}`, description: 'Back up photos automatically', developer: 'Example' }, `https://apps.apple.com/us/app/photos/id${id}?uo=4`);
const profile = { configured: true, model: 'fixture' };

test('discovery verifies store identities, regions and metadata before model selection', () => {
  const app = candidate(123);
  assert.equal(app.key, 'ios:us:123');
  assert.equal(extractAppStoreId(app.appUrl), '123');
  assert.equal(storeIdentity('https://play.google.com/store/apps/details?id=org.photos&gl=gb').country, 'gb');
  for (const url of ['https://evil.com/id123', 'https://apps.apple.com.evil.com/us/app/photos/id123', 'http://apps.apple.com/us/app/photos/id123', 'https://play.google.com/store/apps/details', 'https://apps.apple.com:4430/us/app/photos/id123']) assert.throws(() => storeIdentity(url));
  assert.throws(() => verifiedCandidate({ title: '' }, app.appUrl));
});

test('discovery grounds selections in actual results and caches per user, input and model', async () => {
  let calls = 0, searches = 0;
  const discover = createMarketDiscovery({
    generate: async prompt => {
      calls++; assert.match(prompt, /untrusted data/);
      return { text: JSON.stringify(prompt.includes('CANDIDATES') ? { apps: [{ key: candidate(123).key, reason: 'Supports photo backup' }] } : { scope: 'Photo backup', queries: ['photo backup'] }), usage: { totalTokenCount: 10 } };
    }, search: async () => { searches++; return { apps: [candidate(123)], partial: false }; },
  });
  const body = { query: 'photos', country: 'us' };
  const result = await discover(body, 'a', profile);
  assert.equal(result.apps[0].appUrl, candidate(123).appUrl);
  assert.equal(result.apps[0].description, undefined);
  assert.equal(result.usage.totalTokenCount, 20);
  assert.equal((await discover(body, 'a', profile)).cached, true);
  assert.equal(calls, 2); assert.equal(searches, 1);
  await discover(body, 'b', profile);
  await discover({ ...body, query: 'photo editing' }, 'a', profile);
  await discover(body, 'a', { ...profile, model: 'other' });
  assert.equal(calls, 8);
});

test('discovery rejects invented candidates and does not cache partial store failures', async () => {
  let invented = true, searches = 0;
  const discover = createMarketDiscovery({
    generate: async prompt => ({ text: JSON.stringify(prompt.includes('CANDIDATES') ? { apps: [{ key: invented ? 'invented' : candidate(123).key, reason: 'Photo backup' }] } : { scope: 'Photos', queries: ['photos'] }) }),
    search: async () => { searches++; return { apps: [candidate(123)], partial: true }; },
  });
  await assert.rejects(discover({ query: 'photos' }, 'a', profile), /Unverified/);
  invented = false;
  assert.equal((await discover({ query: 'photos' }, 'a', profile)).partial, true);
  assert.equal((await discover({ query: 'photos' }, 'a', profile)).cached, false);
  assert.equal(searches, 3);
});

test('a supplied store app is retained and insufficient matches produce an honest empty result', async () => {
  const seed = candidate(123);
  const discover = createMarketDiscovery({
    resolve: async () => seed,
    generate: async prompt => ({ text: JSON.stringify(prompt.includes('CANDIDATES') ? { apps: [] } : { scope: 'Photos', queries: ['photos'] }) }),
    search: async () => ({ apps: [], partial: false }),
  });
  assert.equal((await discover({ query: seed.appUrl }, 'a', profile)).apps[0].key, seed.key);
  assert.deepEqual((await discover({ query: 'obscure category' }, 'a', profile)).apps, []);
});

const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const intelligenceUrl = 'data:text/javascript;base64,' + Buffer.from(compile('../src/utils/marketIntelligence.ts')).toString('base64');
const flowSource = compile('../src/utils/marketResearchFlow.ts').replace("'./marketIntelligence'", JSON.stringify(intelligenceUrl));
const { pendingResearchReviews, classifyResearchReviews, loadResearchScope, storeAppKey } = await import('data:text/javascript;base64,' + Buffer.from(flowSource).toString('base64'));
const now = new Date('2026-10-04T00:00:00Z');
const app = id => ({ id, name: `App ${id}`, url: `https://apps.apple.com/us/app/photos/id${id}`, reviews: Array.from({ length: 80 }, (_, index) => ({ id: `r${index}`, text: `Backup stopped ${index}`, date: '2026-10-03' })) });

test('research budgets distribute recent reviews across apps and skip previously completed work', () => {
  const apps = [app(1), app(2), app(3)];
  apps[0].reviews[0].date = '2025-01-01';
  const pending = pendingResearchReviews(apps, { provider: 'gemini', model: 'fixture' }, 90, now);
  assert.equal(pending.length, 120);
  for (const id of [1, 2, 3]) assert.equal(pending.filter(item => item.appId === id).length, 40);
  assert.equal(pending.some(item => item.review.date === '2025-01-01'), false);
  assert.equal(storeAppKey(apps[0].url + '?uo=4'), storeAppKey(apps[0].url));
  const scope = loadResearchScope(null, apps);
  assert.equal(scope.apps.length, 3);
  assert.equal(loadResearchScope({ ...scope, apps: [scope.apps[0], scope.apps[0], { appUrl: 'https://evil.com' }] }, []).apps.length, 1);
});

test('failed classification retains completed batches and retries only unfinished reviews', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0, retained = [app(1)];
  globalThis.fetch = async (_url, options) => {
    calls++;
    if (calls === 2) return new Response(JSON.stringify({ error: 'Temporary failure' }), { status: 502 });
    const body = JSON.parse(options.body);
    return new Response(JSON.stringify({ version: 'market-semantic-v1', provider: 'gemini', model: 'fixture', analyzedAt: now.toISOString(), classifications: body.reviews.map(review => ({ key: review.key, labels: [] })) }));
  };
  try {
    await assert.rejects(classifyResearchReviews({ apps: retained, profile: { provider: 'gemini', model: 'fixture' }, marketId: 'test', serverUrl: '', token: null, onProgress: () => {}, onUpdate: apps => { retained = apps; } }), /Temporary failure/);
    assert.equal(retained[0].reviews.filter(review => review.analysis).length, 12);
    assert.equal(pendingResearchReviews(retained, { provider: 'gemini', model: 'fixture' }).length, 68);
  } finally { globalThis.fetch = originalFetch; }
});
