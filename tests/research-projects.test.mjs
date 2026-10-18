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
  const url = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
  modules.set(name, url);
  return url;
}
const { loadResearchProjects, newResearchProject, projectSources, changeResearchProject, PROJECTS_STORAGE } = await import(compile('researchProjects'));
const { parseDecisionReport, saveDecisionPlan, loadDecisionPlans, decisionPlanMarkdown } = await import(compile('decisionResearch'));
const app = (id, name) => ({ id, name, url: `https://apps.apple.com/us/app/id${id}`, platform: 'ios', role: 'my-app', reviews: [{ text: 'Original review' }] });
const selected = item => ({ key: `ios:us:${item.id}`, title: item.name, appUrl: item.url, platform: 'ios', reason: 'Selected' });
const scope = (query, item) => ({ query, title: query, country: 'us', apps: [selected(item)] });
const storage = entries => ({ getItem: key => JSON.stringify(entries[key] ?? null) });

test('legacy scope migrates without mixing all collected sources or writing legacy data', () => {
  const photo = app('1', 'Photos'), translation = app('2', 'Translation');
  const state = loadResearchProjects(storage({ insightly_market_scope_v1: scope('Photos', photo) }), [photo, translation]);
  assert.equal(state.projects.length, 1);
  assert.deepEqual(projectSources(state.projects[0], [photo, translation]).map(item => item.id), ['1']);
  assert.equal(projectSources(state.projects[0], [photo])[0].role, 'my-app');
  const unknown = loadResearchProjects(storage({}), [photo, translation]);
  assert.equal(unknown.projects[0].scope.apps.length, 0);
});

test('new starting point preserves old project, report, period and saved directions', () => {
  const photo = app('1', 'Photos'), translation = app('2', 'Translation');
  const original = { ...newResearchProject(), scope: scope('Photos', photo), days: 30, report: { marker: 'previous' }, saved: [{ marker: 'saved' }] };
  const first = { activeId: original.id, projects: [original] };
  const next = changeResearchProject(first, original.id, { scope: scope('Translation', translation) });
  assert.equal(next.projects.length, 2);
  assert.notEqual(next.activeId, original.id);
  assert.deepEqual(next.projects[0], original);
  assert.equal(next.projects[1].report, null);
  assert.deepEqual(next.projects[1].saved, []);
  assert.deepEqual(projectSources(next.projects[1], [photo, translation]).map(item => item.id), ['2']);
});

test('source removal and roles remain project-local; shared reviews are unchanged', () => {
  const photo = app('1', 'Photos');
  const a = { ...newResearchProject(), scope: scope('Photos', photo), roles: { 'ios:us:1': 'my-app' } };
  const b = { ...newResearchProject(), scope: scope('Another scenario', photo) };
  assert.equal(projectSources(a, [photo])[0].role, 'my-app');
  assert.equal(projectSources(b, [photo])[0].role, 'competitor');
  const next = changeResearchProject({ activeId: a.id, projects: [a, b] }, a.id, { scope: { ...a.scope, apps: [] } });
  assert.equal(next.projects.length, 2);
  assert.equal(projectSources(next.projects[0], [photo]).length, 0);
  assert.equal(projectSources(next.projects[1], [photo])[0].reviews, photo.reviews);
});

test('reload restores active direction and scopes; invalid active ID falls back safely', () => {
  const a = newResearchProject(), b = { ...newResearchProject(), scope: scope('Translation', app('2', 'Translation')), days: 7 };
  const state = { activeId: b.id, projects: [a, b] };
  const restored = loadResearchProjects(storage({ [PROJECTS_STORAGE]: state }), []);
  assert.equal(restored.activeId, b.id);
  assert.equal(restored.projects[1].days, 7);
  assert.equal(restored.projects[1].scope.apps[0].title, 'Translation');
  assert.equal(loadResearchProjects(storage({ [PROJECTS_STORAGE]: { ...state, activeId: 'missing' } }), []).activeId, a.id);
});

test('decision research keeps corrected context through source changes and reload', () => {
  const brief = { title: 'Backup focus', situation: 'Growth is slow', decision: 'Should we prioritize backup?', searchQuery: 'photo backup', assumptions: ['A simpler task may help'], limits: ['Growth causes are unknown'] };
  const original = { ...newResearchProject(), workflow: 'decision', decision: { input: 'My product growth is slow', briefInput: 'My product growth is slow', brief, report: null }, scope: scope('Photos', app('1', 'Photos')) };
  const changed = changeResearchProject({ activeId: original.id, projects: [original] }, original.id, { scope: scope('Photo backup', app('2', 'Backup')) });
  assert.equal(changed.projects.length, 1);
  const restored = loadResearchProjects(storage({ [PROJECTS_STORAGE]: changed }), []);
  assert.deepEqual(restored.projects[0].decision.brief, brief);
  assert.equal(restored.projects[0].workflow, 'decision');
  assert.equal(restored.projects[0].scope.apps[0].title, 'Backup');
});

test('legacy reports remain readable while v2 requires directions and honest context-only provenance', () => {
  const brief = { title: 'Next steps', situation: 'No plan yet', decision: 'What should we investigate?', searchQuery: 'photo backup', assumptions: [], limits: ['Demand unknown'], originalIdea: '' };
  const result = { position: 'insufficient', conclusion: 'Observe a user task first.', conclusionKeys: [], supports: [], counters: [], unknowns: ['Task blockers'], nextStep: { action: 'Observe backup.', success: 'Task completed.', changeMind: 'A different task blocks progress.' } };
  const report = { version: 'decision-research-v1', input: 'No plan for my photo product yet', brief, days: 90, appKeys: [], evidence: [], result, inputKey: 'legacy-key', provider: 'gemini', model: 'fixture', generatedAt: new Date().toISOString(), usage: {} };
  assert.ok(parseDecisionReport(report));
  assert.equal(parseDecisionReport({ ...report, version: 'decision-research-v2' }), null);
  const updated = { ...report, version: 'decision-research-v2', basis: 'context', result: { ...result,
    directions: [{ kind: 'investigate', title: 'Observe completion', scenario: 'A user tries a backup.', problem: 'Blockers unknown', proposal: 'Study one task', rationale: 'Avoid an unsupported feature bet', uncertainty: 'User needs unknown', action: 'Observe backup', changeMind: 'A different task is the blocker', evidenceKeys: [] }],
    originalIdea: { status: 'not_provided', assessment: 'No proposed approach', evidenceKeys: [] } } };
  assert.ok(parseDecisionReport(updated));
  assert.equal(parseDecisionReport({ ...updated, appKeys: ['ios:us:1'] }), null);
  const project = { ...newResearchProject(), workflow: 'decision', decision: { input: report.input, briefInput: report.input, brief, report: updated } };
  const restored = loadResearchProjects(storage({ [PROJECTS_STORAGE]: { activeId: project.id, projects: [project] } }), []);
  assert.equal(restored.projects[0].decision.report.result.directions[0].title, 'Observe completion');
  const plans = saveDecisionPlan([], updated, 0);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].success, '', 'Do not invent a success threshold');
  assert.equal(saveDecisionPlan(plans, updated, 0).length, 1, 'Saving again must not duplicate a direction');
  const edited = [{ ...plans[0], stage: 'testing', notes: 'Interview scheduled', success: 'User completes backup' }];
  project.decisionPlans = edited;
  const reloaded = loadResearchProjects(storage({ [PROJECTS_STORAGE]: { activeId: project.id, projects: [project] } }), []);
  assert.equal(reloaded.projects[0].decisionPlans[0].notes, 'Interview scheduled');
  assert.equal(reloaded.projects[0].decisionPlans[0].stage, 'testing');
  assert.match(decisionPlanMarkdown(edited[0]), /User completes backup/);
  assert.match(decisionPlanMarkdown(edited[0]), /No supporting review citations/);
  assert.deepEqual(loadDecisionPlans([{ ...plans[0], directionIndex: 99 }, { ...plans[0], notes: null }]), []);
});
