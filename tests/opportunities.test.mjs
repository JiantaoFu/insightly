import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createOpportunityResearch, validateOpportunityInput, validateOpportunityOutput } from '../server/marketOpportunities.js';

const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const intelligenceUrl = 'data:text/javascript;base64,' + Buffer.from(compile('../src/utils/marketIntelligence.ts')).toString('base64');
const opportunitySource = compile('../src/utils/marketOpportunities.ts').replace("'./marketIntelligence'", JSON.stringify(intelligenceUrl));
const utils = await import('data:text/javascript;base64,' + Buffer.from(opportunitySource).toString('base64'));
const { selectOpportunityEvidence, opportunityInputKey, opportunityRequest, parseOpportunityReport, loadSavedOpportunities, illustrativeOpportunityReport, opportunityMarkdown, saveOpportunitySnapshot } = utils;
const context = { mode: 'explore', product: '', question: 'Which notebook problems should we investigate?', focusTopic: 'all' };
const evidence = { key: 'e0', reviewKey: 'app:r0', appId: 'app', appName: 'Notes', topic: 'Notebook loading reliability', quote: 'Notebook crashes',
  intent: 'complaint', polarity: 'negative', appUrl: '', date: '2026-10-02', country: 'us', source: 'review-feed', partial: false, sample: false };
const input = () => opportunityRequest('market', context, [evidence], 30);
const opportunity = () => ({ title: 'Reliable notebook access', scenario: 'A user opens a notebook to access notes.', obstacle: 'The notebook crashes.',
  consequence: 'Task interruption may matter; impact needs verification.', hypothesis: 'Reliable access might be worth investigating.',
  nextWho: 'Users who encountered the crash', nextQuestion: 'What did you do next?', nextExperiment: 'Observe the workflow and test a reliable-access prototype.',
  unknowns: ['Whether users would pay or switch'], evidenceKeys: ['e0'] });
const output = () => JSON.stringify({ opportunities: [opportunity()] });
const profile = { configured: true, model: 'fixture-model' };

test('opportunity input is bounded and sends no username, full review or invented statistics', () => {
  const body = input(); body.evidence[0].userName = 'Private user';
  assert.equal(validateOpportunityInput(body).evidence[0].userName, undefined);
  assert.throws(() => validateOpportunityInput({ ...body, evidence: Array(25).fill(body.evidence[0]) }));
  assert.equal(validateOpportunityInput({ ...body, question: '', days: 90 }).question, '');
  assert.throws(() => validateOpportunityInput({ ...body, question: 'x'.repeat(401) }));
  assert.throws(() => validateOpportunityInput({ ...body, days: 365 }));
});

test('hypotheses need supplied evidence references and bounded fields; zero results are valid', () => {
  const result = validateOpportunityOutput(output(), input());
  assert.match(result[0].id, /^opportunity-[a-f0-9]{16}$/);
  assert.deepEqual(validateOpportunityOutput('{"opportunities":[]}', input()), []);
  for (const mutate of [item => { item.evidenceKeys = ['imaginary']; }, item => { item.unknowns = []; }, item => { item.scenario = 'x'.repeat(701); }]) {
    const item = opportunity(); mutate(item);
    assert.throws(() => validateOpportunityOutput(JSON.stringify({ opportunities: [item] }), input()));
  }
  assert.throws(() => validateOpportunityOutput(JSON.stringify({ opportunities: [opportunity(), opportunity()] }), input()));
});

test('research cache respects user, mode, question, evidence and model; failures are not cached', async () => {
  let calls = 0;
  const research = createOpportunityResearch(async prompt => { calls++; assert.match(prompt, /untrusted data/); return { text: output(), usage: { totalTokenCount: 42 } }; });
  const first = await research(input(), 'a', profile);
  assert.equal(first.usage.totalTokenCount, 42);
  assert.equal((await research(input(), 'a', profile)).cached, true);
  for (const [body, user, model] of [[input(), 'b', profile], [{ ...input(), mode: 'improve' }, 'a', profile],
    [{ ...input(), question: 'Different question' }, 'a', profile], [input(), 'a', { ...profile, model: 'other' }],
    [{ ...input(), evidence: [{ ...input().evidence[0], quote: 'Another original quote' }] }, 'a', profile]]) await research(body, user, model);
  assert.equal(calls, 6);
  let failed = 0;
  const failing = createOpportunityResearch(async () => { failed++; throw new Error('Unavailable'); });
  await assert.rejects(failing(input(), 'a', { configured: false }));
  assert.equal(failed, 0);
  await assert.rejects(failing(input(), 'a', profile));
  await assert.rejects(failing(input(), 'a', profile));
  assert.equal(failed, 2);
});

const now = new Date('2026-10-04T00:00:00Z');
const app = (id, sample = false) => ({ id, name: id, url: '', sample, reviews: Array.from({ length: 30 }, (_, index) => {
  const text = `Notebook crashes ${index}`;
  return { id: 'r' + index, text, date: '2026-10-02', userName: 'Hidden user',
    analysis: { version: 'market-semantic-v1', provider: sample ? 'sample' : 'gemini', model: 'fixture-model', source: sample ? 'illustrative' : 'model',
      sourceText: text, labels: [{ topic: { id: 'topic-0000000000000001', name: 'Notebook loading reliability', description: 'Loading notes' }, evidence: text, issue: text, polarity: 'negative', intent: 'complaint' }] } };
}) });

test('evidence selection is bounded, app-balanced, dated, classified and excludes mixed sample data', () => {
  const selected = selectOpportunityEvidence([app('a'), app('b'), app('sample', true)], context, 30, now);
  assert.equal(selected.length, 24);
  assert.equal(selected.filter(item => item.appId === 'a').length, 12);
  assert.equal(selected.filter(item => item.appId === 'b').length, 12);
  assert.equal(selected.some(item => item.sample), false);
  assert.equal(selected[0].userName, undefined);
  assert.equal(selectOpportunityEvidence([app('a')], { ...context, focusTopic: 'topic-0000000000000009' }, 30, now).length, 0);
  assert.equal(selectOpportunityEvidence([app('a')], context, 30, new Date('2027-01-01')).length, 0);
  const unclassified = app('a'); delete unclassified.reviews[0].analysis;
  assert.equal(selectOpportunityEvidence([unclassified], context, 30, now).some(item => item.reviewKey === 'a:r0'), false);
});

test('stored reports and validation snapshots reject corrupted references and preserve grounded exports', () => {
  const report = illustrativeOpportunityReport([{ ...evidence, sample: true }], context, 30);
  assert.ok(parseOpportunityReport(report));
  const saved = { opportunity: report.opportunities[0], report, savedAt: now.toISOString(), stage: 'interview' };
  assert.equal(loadSavedOpportunities([saved, saved]).length, 1);
  assert.match(opportunityMarkdown(saved), /ILLUSTRATIVE SAMPLE DATA/);
  assert.match(opportunityMarkdown(saved), /Notebook crashes/);
  assert.match(opportunityMarkdown(saved), /Interview|interview/);
  const corrupted = structuredClone(report); corrupted.opportunities[0].evidenceKeys = ['invented'];
  assert.equal(parseOpportunityReport(corrupted), null);
  assert.equal(loadSavedOpportunities([{ ...saved, stage: 'confirmed-profitable' }]).length, 0);
  assert.notEqual(opportunityInputKey(context, [evidence], 30), opportunityInputKey({ ...context, mode: 'improve' }, [evidence], 30));
  assert.notEqual(opportunityInputKey(context, [evidence], 30), opportunityInputKey(context, [{ ...evidence, quote: 'Changed' }], 30));
  assert.equal(opportunityInputKey(context, [evidence], 30), opportunityInputKey({ question: context.question, focusTopic: 'all', product: '', mode: 'explore' }, [evidence], 30));
});

test('explicit saved snapshot updates preserve validation stage and do not duplicate the opportunity', () => {
  const report = illustrativeOpportunityReport([{ ...evidence, sample: true }], context, 30);
  const old = { opportunity: report.opportunities[0], report, savedAt: now.toISOString(), stage: 'interview' };
  const next = illustrativeOpportunityReport([{ ...evidence, sample: true }], { ...context, mode: 'improve' }, 30);
  const saved = saveOpportunitySnapshot([old], next.opportunities[0], next);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].stage, 'interview');
  assert.equal(saved[0].savedAt, old.savedAt);
  assert.equal(saved[0].report.context.mode, 'improve');
  assert.equal(old.report.context.mode, 'explore');
});
