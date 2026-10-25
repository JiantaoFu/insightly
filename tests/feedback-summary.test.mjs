import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../src/utils/feedbackSummary.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { summarizeFeedback, buildProblems, problemHasEvidence } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const label = (issue, intent = 'complaint') => ({ topic: { id: 'backup', name: 'Backup' }, issue, intent });
test('problems preserve unsupported issues and match directions by exact aspect evidence, not just theme', () => {
  const row = { app: { id: 'app1' }, analysis: { labels: [{ ...label('Backup stops'), evidence: 'Stops midway' }, { ...label('Restore is slow'), evidence: 'Slow restore' }, { ...label('Good', 'praise'), evidence: 'Great' }] } };
  const problems = buildProblems([row]);
  assert.equal(problems.length, 2);
  const backup = problems.find(problem => problem.title === 'Backup stops');
  assert.equal(backup.rows.length, 1);
  const ref = { appId: 'app1', topic: 'Backup', intent: 'complaint', quote: 'Slow restore' };
  assert.equal(problemHasEvidence(backup, [ref]), false);
  assert.equal(problemHasEvidence(backup, [{ ...ref, quote: 'Stops midway' }]), true);
  assert.equal(problemHasEvidence(backup, [{ ...ref, appId: 'other', quote: 'Stops midway' }]), false);
  assert.equal(buildProblems([row, { ...row, app: { id: 'other' } }]).length, 4);
  assert.deepEqual(buildProblems([]), []);
});
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
