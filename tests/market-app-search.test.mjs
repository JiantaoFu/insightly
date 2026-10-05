import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMarketAppSearch } from '../server/marketAppSearch.js';

const apple = index => ({ title: `Photo ${index}`, url: `https://apps.apple.com/us/app/photo/id${index + 1}`, description: 'Photo backup' });
const google = index => ({ title: `Photo ${index}`, url: `https://play.google.com/store/apps/details?id=app.photo${index}`, summary: 'Photo backup' });

test('candidate pages are disjoint, interleaved and served from a bounded cached store pool', async () => {
  let calls = 0;
  const search = createMarketAppSearch({ apple: async () => { calls++; return Array.from({ length: 70 }, (_, n) => apple(n)); }, google: async () => { calls++; return Array.from({ length: 70 }, (_, n) => google(n)); } });
  const first = await search({ query: 'photos' }), second = await search({ query: 'photos', page: 2 });
  assert.equal(first.apps.length, 20); assert.equal(first.total, 120); assert.equal(first.totalPages, 6);
  assert.equal(first.apps[0].platform, 'ios'); assert.equal(first.apps[1].platform, 'android');
  assert.equal(new Set([...first.apps, ...second.apps].map(app => app.key)).size, 40);
  assert.equal(calls, 2);
  assert.equal((await search({ query: 'photos', page: 6 })).hasMore, false);
  await assert.rejects(search({ query: 'photos', page: 7 }));
});

test('platform, region and autocomplete limits isolate cache entries and preserve actual regions', async () => {
  const calls = [];
  const search = createMarketAppSearch({ apple: async (_query, country, limit) => { calls.push(['ios', country, limit]); return Array.from({ length: limit }, (_, n) => apple(n)); }, google: async (_query, country, limit) => { calls.push(['android', country, limit]); return Array.from({ length: limit }, (_, n) => google(n)); } });
  const suggest = await search({ query: 'photo', suggest: true });
  assert.equal(suggest.apps.length, 12); assert.equal(suggest.totalPages, 1);
  assert.equal((await search({ query: 'photo', platform: 'android', country: 'gb' })).apps[0].key, 'android:gb:app.photo0');
  await search({ query: 'photo' });
  assert.deepEqual(calls.map(item => item[2]), [6, 6, 60, 60, 60]);
});

test('candidate search deduplicates, rejects invalid store links and exposes partial results', async () => {
  const search = createMarketAppSearch({ apple: async () => [apple(1), apple(1), { title: 'Invalid', url: 'https://evil.com' }], google: async () => { throw new Error('Unavailable'); } });
  const result = await search({ query: 'photo' });
  assert.equal(result.total, 1); assert.equal(result.partial, true); assert.equal(result.hasMore, false);
  await assert.rejects(search({ query: 'photo', platform: 'android' }), /unavailable/i);
  await assert.rejects(search({ query: 'x' }));
});
