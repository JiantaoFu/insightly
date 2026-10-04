import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAppleReviewFeed } from '../server/reviewFeed.js';

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
