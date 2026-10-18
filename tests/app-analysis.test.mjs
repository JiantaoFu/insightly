import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const modules = new Map();
function compile(name) {
  if (modules.has(name)) return modules.get(name);
  let source = ts.transpileModule(readFileSync(new URL(`../src/utils/${name}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  source = source.replace(/from '\.\/([^']+)'/g, (_, dependency) => `from '${compile(dependency)}'`)
    .replace(/from '..\/..\/shared\/decisionContract.js'/g, `from '${new URL('../shared/decisionContract.js', import.meta.url).href}'`);
  const url = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64'); modules.set(name, url); return url;
}
const { analyzeApplication } = await import(compile('appAnalysis'));
const { loadResearchProjects, PROJECTS_STORAGE } = await import(compile('researchProjects'));
const app = { key: 'ios:us:1', title: 'Backup', appUrl: 'https://apps.apple.com/us/app/id1', platform: 'ios', reason: 'Selected' };
function fixture(t, overrides = {}) {
  const calls = [], retained = [], controller = new AbortController(), original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null; calls.push({ url, body });
    if (String(url).endsWith('/classifier')) return Response.json({ configured: true, provider: 'gemini', model: 'fixture', version: 'market-semantic-v1' });
    if (String(url).endsWith('/process-url')) return Response.json({ details: { title: 'Backup' }, reviews: { source: 'review-feed', country: overrides.country || 'us', reviews: overrides.empty ? [] : [10, 60].map(days => ({ id: String(days), text: `Backup stops after ${days} files.`, date: new Date(Date.now() - days * 86400000).toISOString(), score: 2 })) } });
    if (String(url).endsWith('/classify')) return Response.json({ version: 'market-semantic-v1', provider: 'gemini', model: 'fixture', analyzedAt: new Date().toISOString(), classifications: body.reviews.map(review => ({ key: review.key, labels: [{ topic: { id: 'topic-0000000000000001', name: 'Backup', description: 'Task interruption' }, intent: 'complaint', polarity: 'negative', issue: 'Stops early', evidence: review.text }] })) });
    if (String(url).endsWith('/opportunities')) {
      if (overrides.fail) return Response.json({ error: 'Service failed' }, { status: 503 });
      if (overrides.cancel) controller.abort();
      return Response.json({ version: 'market-opportunities-v1', provider: 'gemini', model: 'fixture', generatedAt: new Date().toISOString(), opportunities: [{ id: 'opportunity-0000000000000001', title: 'Complete backup', scenario: 'A user backs up files', obstacle: 'Backup stops', consequence: 'Incomplete backup', hypothesis: 'Reliable completion may help', nextWho: 'An affected user', nextQuestion: 'When did it stop?', nextExperiment: 'Observe a backup', unknowns: ['Demand'], evidenceKeys: overrides.invalid ? ['invented'] : body.evidence.map(item => item.key) }] });
    }
    throw new Error(`Unexpected request ${url}`);
  };
  return { calls, retained, options: { app, days: 90, savedApps: [], server: 'http://fixture', token: null, signal: controller.signal, progress: () => {}, retain: value => retained.push(value) } };
}
test('one app selection collects, classifies and generates a scope-consistent persisted snapshot', async t => {
  const { calls, retained, options } = fixture(t);
  const result = await analyzeApplication(options);
  assert.deepEqual(calls.map(item => item.url.split('/').at(-1)), ['classifier', 'process-url', 'classify', 'opportunities']);
  assert.equal(result.scope.apps.length, 1); assert.equal(result.report.evidence.length, 2);
  assert.equal(result.analysisApp.reviews.length, 2); assert.equal(result.id, 'analysis:ios:us:1');
  const loaded = loadResearchProjects({ getItem: key => key === PROJECTS_STORAGE ? JSON.stringify({ activeId: result.id, projects: [result] }) : null }, []);
  assert.deepEqual(loaded.projects[0].analysisApp, JSON.parse(JSON.stringify(result.analysisApp)));
  const next = await analyzeApplication({ ...options, days: 30, previous: result, savedApps: [retained.at(-1)] });
  assert.equal(next.report.days, 30); assert.equal(next.report.evidence.length, 1);
  assert.equal(result.report.days, 90); assert.equal(result.report.evidence.length, 2, 'previous result remains immutable');
});
test('failed synthesis retains collected reviews but does not publish a completed result', async t => {
  const { retained, options } = fixture(t, { fail: true });
  await assert.rejects(analyzeApplication(options), /Service failed/);
  assert.equal(retained.at(-1).reviews.length, 2);
});
test('cancellation and invented evidence cannot publish a result', async t => {
  await t.test('cancelled after generation', async t => { const { options } = fixture(t, { cancel: true }); await assert.rejects(analyzeApplication(options), { name: 'AbortError' }); });
  await t.test('invalid references', async t => { const { options } = fixture(t, { invalid: true }); await assert.rejects(analyzeApplication(options), /invalid opportunities/); });
});
test('empty feedback never produces fabricated opportunities; region mismatch cannot overwrite saved reviews', async t => {
  await t.test('empty', async t => { const { options, calls } = fixture(t, { empty: true }); await assert.rejects(analyzeApplication(options), /No classified review evidence/); assert.equal(calls.length, 2); });
  await t.test('region', async t => { const { options, retained } = fixture(t, { country: 'gb' }); await assert.rejects(analyzeApplication(options), /different region/); assert.equal(retained.length, 0); });
});
