import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../src/utils/feedbackSummary.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { summarizeFeedback } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const label = (issue, intent = 'complaint') => ({ topic: { id: 'backup', name: 'Backup' }, issue, intent });
test('summaries count reviews once and retain specific issue descriptions without inventing synthesis', () => {
  const rows = [{ analysis: { labels: [label('Backup stops'), label('Backup stops'), label('Restore is slow')] } },
    { analysis: { labels: [label('Backup stops')] } }, { analysis: { labels: [label('Works well', 'praise')] } }, {}];
  const [summary] = summarizeFeedback(rows, 'complaint');
  assert.equal(summary.count, 2);
  assert.deepEqual(summary.issues, [{ text: 'Backup stops', count: 2 }, { text: 'Restore is slow', count: 1 }]);
  assert.equal(summarizeFeedback(rows, 'praise')[0].count, 1);
  assert.deepEqual(summarizeFeedback(rows, 'request'), []);
});
test('empty input and missing issue text do not fabricate problems', () => {
  assert.deepEqual(summarizeFeedback([], 'complaint'), []);
  const [summary] = summarizeFeedback([{ analysis: { labels: [label('')] } }], 'complaint');
  assert.equal(summary.count, 1);
  assert.deepEqual(summary.issues, []);
});
