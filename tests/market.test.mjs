import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/marketIntelligence.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { splitReviewWindows, calculateTopicTrends } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('windows exclude stale, undated and future evidence', () => {
  const now = new Date('2026-10-03T00:00:00Z');
  const result = splitReviewWindows([
    { text: 'current', timestamp: '2026-10-02' },
    { text: 'previous', date: '2026-08-20' },
    { text: 'stale', date: '2025-01-01' },
    { text: 'future', date: '2027-01-01' },
    { text: 'unknown' },
  ], 30, now);
  assert.equal(result.current.length, 1);
  assert.equal(result.previous.length, 1);
  assert.equal(splitReviewWindows([{ text: 'undated' }]).current.length, 0);
});
test('emerging performance complaints retain evidence', () => {
  const trends = calculateTopicTrends([{ text: 'App crashes and is slow', score: 1, date: new Date().toISOString() }]);
  const performance = trends.find(trend => trend.topic === 'Performance issues');
  assert.equal(performance.delta, 1);
  assert.equal(performance.sentiment, 'negative');
  assert.equal(performance.example, 'App crashes and is slow');
});
