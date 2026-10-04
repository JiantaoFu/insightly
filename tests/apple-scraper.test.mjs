import { test } from 'node:test';
import assert from 'node:assert/strict';
import store from 'app-store-scraper';
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
  t.mock.method(store, 'reviews', async () => { throw new Error('Store unavailable'); });
  t.mock.method(axios, 'get', async () => { throw new Error('Feed unavailable'); });
  await assert.rejects(getAppReviews('123', 'us', { maxReviews: 1, months: 0 }), /Store unavailable/);
});
