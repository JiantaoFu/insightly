import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAppleReviewFeed, parseApplePageReviews } from '../server/reviewFeed.js';

test('Apple alternate feed preserves review dates and ignores non-review entries', () => {
  const entry = { id: { label: '123' }, 'im:rating': { label: '4' },
    content: { label: 'Useful app' }, updated: { label: '2026-10-02T12:00:00Z' } };
  const reviews = parseAppleReviewFeed({ feed: { entry: [{ title: { label: 'App' } }, entry] } });
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].score, 4);
  assert.equal(reviews[0].updated, '2026-10-02T12:00:00Z');
  assert.equal(parseAppleReviewFeed({ feed: { entry } }).length, 1);
  assert.deepEqual(parseAppleReviewFeed({ feed: {} }), []);
});

test('store webpage reviews preserve structured dates, ratings and deduplicate IDs', () => {
  const review = { id: 'photos-review', reviewerName: 'User', title: 'Feedback', contents: 'Missing album sorting', rating: 2, date: '2026-10-02T14:03:19.000Z' };
  const payload = { data: [{ data: { shelfMapping: { allProductReviews: { items: [{ review }, { review }] } } } }] };
  const html = `<script id="serialized-server-data" type="application/json">${JSON.stringify(payload)}</script>`;
  const parsed = parseApplePageReviews(html);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].updated, review.date);
  assert.equal(parsed[0].score, 2);
  assert.equal(parsed[0].text, review.contents);
  assert.throws(() => parseApplePageReviews('<html></html>'), /unavailable/);
});
