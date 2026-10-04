import { test } from 'node:test';
import assert from 'node:assert/strict';
import gplay from 'google-play-scraper';
import { getAppReviews } from '../server/googlePlayScraper.js';

test('Google review samples retain IDs, links, region and collection limit', async t => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'debug', () => {});
  t.mock.method(gplay, 'reviews', async params => {
    assert.equal(params.lang, 'en');
    return { data: [{ id: 'review-id', url: 'https://play.google.com/store/apps/details?id=app', text: 'Sync broken', score: 2, date: new Date('2026-09-01') }], nextPaginationToken: 'more' };
  });
  const result = await getAppReviews('app', 'gb', { maxReviews: 1, months: 0 });
  assert.equal(result.reviews[0].id, 'review-id');
  assert.ok(result.reviews[0].url);
  assert.equal(result.country, 'gb');
  assert.equal(result.requestedLimit, 1);
  assert.equal(result.limitReached, true);
  assert.equal(result.source, 'review-feed');
});

test('Google region fallback reports the actual region rather than the requested region', async t => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'debug', () => {});
  t.mock.method(console, 'error', () => {});
  t.mock.method(gplay, 'reviews', async ({ country }) => {
    if (country === 'gb') throw new Error('Regional endpoint unavailable');
    return { data: [], nextPaginationToken: null };
  });
  const result = await getAppReviews('app', 'gb', { maxReviews: 100, months: 0 });
  assert.equal(result.country, 'us');
  assert.equal(result.total, 0);
  assert.equal(result.limitReached, false);
});

test('Google pagination guard is labeled as incomplete coverage', async t => {
  for (const method of ['log', 'debug', 'warn']) t.mock.method(console, method, () => {});
  let page = 0;
  t.mock.method(gplay, 'reviews', async () => ({ data: [{ id: `r-${++page}`, text: 'Review', date: new Date('2026-09-01') }], nextPaginationToken: 'more' }));
  const result = await getAppReviews('app', 'us', { maxReviews: 500, months: 0 });
  assert.equal(result.pagesFetched, 10);
  assert.equal(result.partial, true);
  assert.equal(result.total, 10);
});
