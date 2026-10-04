import { test } from 'node:test';
import assert from 'node:assert/strict';
import store from '@jeromyfu/app-store-scraper';
import axios from 'axios';
import { getAppReviews } from '../server/appStoreScraper.js';

test('empty primary feed falls back and preserves historical review with months=0', async t => {
  t.mock.method(store, 'reviews', async () => []);
  const paths = [];
  t.mock.method(axios, 'get', async url => {
    paths.push(url);
    return { data: { feed: { entry: url.endsWith('/sortby=mostrecent/json') ? [] : [
      { id: { label: 'old' }, 'im:rating': { label: '2' }, content: { label: 'Sync is broken' }, updated: { label: '2024-07-13T07:11:56-07:00' } },
    ] } } };
  });
  const result = await getAppReviews('123', 'us', { maxReviews: 1, months: 0 });
  assert.equal(result.reviews.length, 1);
  assert.equal(result.reviews[0].timestamp, '2024-07-13T07:11:56-07:00');
  assert.equal(paths.length, 2);
});

test('all feeds failing rejects rather than returning successful zero reviews', async t => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(store, 'reviews', async () => { throw new Error('Store unavailable'); });
  t.mock.method(axios, 'get', async () => { throw new Error('Feed unavailable'); });
  await assert.rejects(getAppReviews('123', 'us', { maxReviews: 1, months: 0 }), /Store unavailable/);
});

test('empty RSS feeds return labeled webpage sample without pretending it is complete', async t => {
  const primary = t.mock.method(store, 'reviews', async () => []);
  t.mock.method(globalThis, 'setTimeout', callback => { queueMicrotask(callback); });
  const review = { id: 'web-1', reviewerName: 'User', contents: 'Missing features', rating: 2, date: '2026-10-02T14:03:19.000Z' };
  const payload = { data: [{ data: { shelfMapping: { allProductReviews: { items: [{ review }] } } } }] };
  t.mock.method(axios, 'get', async url => ({ data: url.startsWith('https://apps.apple.com/')
    ? `<script id="serialized-server-data" type="application/json">${JSON.stringify(payload)}</script>`
    : { feed: {} } }));
  const result = await getAppReviews('123', 'us', { maxReviews: 100, months: 0 });
  assert.equal(result.total, 1);
  assert.equal(result.source, 'store-page-sample');
  assert.equal(result.partial, true);
  assert.equal(result.reviews[0].timestamp, review.date);
  assert.equal(primary.mock.callCount(), 3);
});

test('product and all-reviews pages merge by review ID', async t => {
  t.mock.method(store, 'reviews', async () => []);
  t.mock.method(globalThis, 'setTimeout', callback => { queueMicrotask(callback); });
  t.mock.method(axios, 'get', async url => {
    if (!url.startsWith('https://apps.apple.com/')) return { data: { feed: {} } };
    const ids = url.includes('see-all=reviews') ? ['shared', 'additional'] : ['shared', 'product'];
    const items = ids.map(id => ({ review: { id, contents: 'Review text', rating: 3, date: '2026-10-02T14:03:19.000Z' } }));
    const payload = { data: [{ data: { shelfMapping: { allProductReviews: { items } } } }] };
    return { data: `<script id="serialized-server-data" type="application/json">${JSON.stringify(payload)}</script>` };
  });
  const result = await getAppReviews('123', 'us', { maxReviews: 100, months: 0 });
  assert.equal(result.total, 3);
  assert.deepEqual(new Set(result.reviews.map(review => review.id)), new Set(['shared', 'additional', 'product']));
});

test('RSS pagination includes page ten and honors the requested limit', async t => {
  const pages = [];
  t.mock.method(store, 'reviews', async ({ page }) => {
    pages.push(page);
    return [{ id: `review-${page}`, score: 3, text: 'Review', updated: '2026-10-02T14:03:19.000Z' }];
  });
  const result = await getAppReviews('123', 'us', { maxReviews: 10, months: 0 });
  assert.equal(result.total, 10);
  assert.equal(pages.at(-1), 10);
  assert.equal(result.source, 'review-feed');
});
