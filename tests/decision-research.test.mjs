import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDecisionResearch, decisionHandler } from '../server/marketDecisions.js';
import { parseDecisionBrief, parseDecisionResult } from '../shared/decisionContract.js';
const brief = { title: 'Focus photo backup', situation: 'Founder reports slow growth.', decision: 'Should the product focus on photo backup?', searchQuery: 'automatic photo backup', assumptions: ['A narrower workflow would help users'], limits: ['Reviews cannot diagnose growth or brand effects'] };
const input = 'My photo product is not growing. Should I focus on backup and rebrand?';
const profile = { configured: true, model: 'fixture' };
const evidence = [{ key: 'e0', reviewKey: 'a:r0', appId: 'a', appName: 'Photos', topic: 'Backup reliability', quote: 'Backup stops.', intent: 'complaint', polarity: 'negative' }];
const result = { position: 'conditional', conclusion: 'Test reliability before deciding scope.', conclusionKeys: ['e0'], supports: [{ text: 'This review reports interrupted backup.', evidenceKeys: ['e0'] }], counters: [], unknowns: ['Whether this affects the target users'], nextStep: { action: 'Observe a backup session with a user.', success: 'They finish the task without intervention.', changeMind: 'The missing companion workflow prevents completion.' } };
const body = () => ({ marketId: 'project-a', input, brief, days: 90, evidence });

test('decision brief separates hypothesis and limits and rejects missing or oversized fields', () => {
  assert.deepEqual(parseDecisionBrief(brief), brief);
  assert.equal(parseDecisionBrief({ ...brief, assumptions: [] }), null);
  assert.equal(parseDecisionBrief({ ...brief, decision: 'x'.repeat(401) }), null);
  assert.equal(parseDecisionBrief({ ...brief, limits: [] }), null);
});
test('claims need real references; absent counter-evidence and insufficient decisions are valid', () => {
  assert.deepEqual(parseDecisionResult(result, ['e0']), result);
  assert.equal(parseDecisionResult({ ...result, supports: [{ text: 'Invented claim', evidenceKeys: ['missing'] }] }, ['e0']), null);
  assert.equal(parseDecisionResult({ ...result, conclusionKeys: [] }, ['e0']), null);
  assert.equal(parseDecisionResult({ ...result, counters: [{ text: 'No references', evidenceKeys: [] }] }, ['e0']), null);
  assert.ok(parseDecisionResult({ ...result, position: 'insufficient', conclusionKeys: [], supports: [] }, ['e0']));
});
test('decision caching respects user, model, narrative, corrected brief and evidence', async () => {
  let calls = 0;
  const run = createDecisionResearch(async prompt => { calls++; assert.match(prompt, /untrusted data/); assert.match(prompt, /Never fabricate balance/); return { text: JSON.stringify(result) }; });
  assert.equal((await run(body(), 'user', profile, 'report')).report.supports.length, 1);
  assert.equal((await run(body(), 'user', profile, 'report')).cached, true);
  await run(body(), 'other', profile, 'report');
  await run(body(), 'user', { ...profile, model: 'other' }, 'report');
  await run({ ...body(), input: input + ' Changed.' }, 'user', profile, 'report');
  await run({ ...body(), brief: { ...brief, decision: 'Should reliability come first?' } }, 'user', profile, 'report');
  await run({ ...body(), evidence: [{ ...evidence[0], quote: 'A different quote.' }] }, 'user', profile, 'report');
  assert.equal(calls, 12);
});
test('brief generation is independent of collection; invalid output is not cached', async () => {
  let calls = 0;
  const run = createDecisionResearch(async () => { calls++; return { text: JSON.stringify(calls === 1 ? {} : brief) }; });
  await assert.rejects(run({ input }, 'user', profile, 'brief'));
  assert.deepEqual((await run({ input }, 'user', profile, 'brief')).brief, brief);
  assert.equal(calls, 2);
  await assert.rejects(run({ input: 'short' }, 'user', profile, 'brief'));
  await assert.rejects(run({ input }, 'user', { configured: false }, 'brief'));
  await assert.rejects(run({ ...body(), evidence: [] }, 'user', profile, 'report'));
  assert.equal(calls, 2);
});

test('evidence check can reject draft claims and combines both calls usage', async () => {
  let calls = 0;
  const run = createDecisionResearch(async () => ({ text: JSON.stringify(++calls === 1 ? result : { ...result, position: 'insufficient', supports: [], conclusionKeys: [] }), usage: { totalTokenCount: 100 } }));
  const response = await run(body(), 'user', profile, 'report');
  assert.equal(response.report.supports.length, 0);
  assert.equal(response.report.position, 'insufficient');
  assert.equal(response.usage.totalTokenCount, 200);
  const invalid = createDecisionResearch(async () => ({ text: JSON.stringify(++calls === 3 ? result : { ...result, conclusionKeys: ['fake'] }) }));
  await assert.rejects(invalid(body(), 'user', profile, 'report'));
});
test('same-user concurrency and origin/auth guards protect decision endpoints', async () => {
  let release;
  const run = createDecisionResearch(() => new Promise(resolve => { release = resolve; }));
  const pending = run({ input }, 'user', profile, 'brief');
  await assert.rejects(run({ input: input + ' another' }, 'user', profile, 'brief'), error => error.status === 409);
  release({ text: JSON.stringify(brief) }); await pending;
  for (const [local, headers] of [[true, { origin: 'https://untrusted.example' }], [false, {}]]) {
    const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await decisionHandler(local)({ headers }, response);
    assert.equal(response.code, 403);
  }
});
