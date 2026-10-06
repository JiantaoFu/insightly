const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1355, height: 892 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let reports = 0, collections = 0, invalid = false, empty = true, failed = false;
    const envelope = { version: 'decision-research-v2', provider: 'gemini', model: 'fixture', generatedAt: new Date().toISOString(), usage: {} };
    const app = { key: 'ios:us:1', title: 'Backup App', appUrl: 'https://apps.apple.com/us/app/id1', platform: 'ios', reason: 'Backup task alternative' };
    const direction = { title: 'Make backup completion clear', scenario: 'Someone leaves a phone backup running.', problem: 'They cannot finish the backup.', proposal: 'Test a clear completion status.', rationale: 'Start with the core task before unrelated features.', uncertainty: 'Target-user relevance needs checking.', action: 'Observe a backup session.', changeMind: 'Users already know when it finishes.' };
    await page.route('**/api/market/classifier', route => route.fulfill({ json: { version: 'market-semantic-v1', configured: true, model: 'fixture', provider: 'gemini' } }));
    await page.route('**/api/market/decision/brief', route => {
      const input = route.request().postDataJSON().input;
      return route.fulfill({ json: { ...envelope, brief: { title: 'Backup next steps', situation: input, decision: 'Which backup problems should we explore next?', searchQuery: 'photo backup', assumptions: [], limits: ['Growth causes are unknown'], originalIdea: input.includes('remove') ? 'Remove companion features' : '' } } });
    });
    await page.route('**/api/market/discover', route => failed ? route.fulfill({ status: 503, json: { error: 'Discovery unavailable' } }) : route.fulfill({ json: { scope: 'Backup', country: 'us', apps: empty ? [] : [app] } }));
    await page.route('**/app-store/process-url', route => { collections++; return route.fulfill({ json: { details: { title: app.title }, reviews: { country: 'us', source: 'review-feed', reviews: [{ id: 'r1', text: 'Backup stops before it finishes.', score: 2, date: new Date().toISOString() }] } } }); });
    await page.route('**/api/market/classify', route => {
      const body = route.request().postDataJSON();
      return route.fulfill({ json: { version: 'market-semantic-v1', model: 'fixture', provider: 'gemini', analyzedAt: new Date().toISOString(), classifications: body.reviews.map(review => ({ key: review.key, labels: [{ topic: { id: 'topic-0000000000000001', name: 'Backup completion', description: 'Completing the task' }, intent: 'complaint', polarity: 'negative', issue: 'Backup interrupted', evidence: review.text }] })) } });
    });
    await page.route('**/api/market/decision/report', route => {
      reports++; const body = route.request().postDataJSON(), refs = body.evidence.map(item => item.key);
      const first = { ...direction, kind: refs.length ? 'observed' : 'investigate', evidenceKeys: invalid ? ['fake'] : refs };
      return route.fulfill({ json: { ...envelope, report: { position: refs.length ? 'conditional' : 'insufficient', conclusion: 'Start by understanding whether users complete backup successfully.', conclusionKeys: refs,
        supports: [], counters: [], unknowns: ['What blocks the target users?'],
        nextStep: { action: direction.action, success: 'Users complete the task.', changeMind: direction.changeMind },
        directions: [first, { ...direction, kind: 'exploratory', title: 'Explore a recovery rehearsal', proposal: 'Explore a small restore check before building more management features.', evidenceKeys: [] }],
        originalIdea: { status: body.brief.originalIdea ? 'adjust' : 'not_provided', assessment: body.brief.originalIdea ? 'Keep task focus; do not assume recovery can be removed.' : 'No idea was supplied.', evidenceKeys: [] },
      } } });
    });
    await page.goto(`${process.env.QA_BASE_URL || 'http://127.0.0.1:5173'}/market`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const input = page.getByLabel('What are you working on or exploring?', { exact: true });
    await input.fill('My backup product is not growing. I have no idea what to improve.');
    await page.getByRole('button', { name: 'Find my next step', exact: true }).click();
    await page.getByRole('heading', { name: 'Make backup completion clear', exact: true }).waitFor();
    await page.getByText('Context-only suggestions · no reviews analyzed', { exact: true }).waitFor();
    assert.equal(collections, 0);
    assert.equal(await page.getByRole('heading', { name: /Your original idea/ }).count(), 0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Explore a recovery rehearsal', exact: true }).waitFor();
    assert.equal(await page.getByText(/Previous result/).count(), 0);
    await page.getByRole('button', { name: 'Edit research', exact: true }).click();
    await page.getByRole('button', { name: 'Update next steps', exact: true }).click();
    await page.getByText('Research is up to date.', { exact: true }).waitFor();
    assert.equal(reports, 1);
    await page.getByRole('button', { name: 'Edit research', exact: true }).click();
    empty = false;
    await page.getByRole('button', { name: 'Update next steps', exact: true }).click();
    await page.getByText(/Observed problem · proposed solution unvalidated/).waitFor();
    await page.getByText('Overall assessment', { exact: true }).click();
    await page.getByText('Original evidence (1)', { exact: true }).first().click();
    await page.getByText('Backup stops before it finishes.', { exact: true }).first().waitFor();
    await page.screenshot({ path: path.join(process.env.QA_OUTPUT_DIR || require('node:os').tmpdir(), 'next-steps-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(process.env.QA_OUTPUT_DIR || require('node:os').tmpdir(), 'next-steps-mobile.png'), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: 'Evidence & sources (1)', exact: true }).click();
    await page.getByRole('heading', { name: 'Evidence behind your saved suggestions' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Track app', exact: true }).isVisible(), false);
    await page.getByRole('link', { name: 'Evidence 1', exact: true }).click();
    await page.screenshot({ path: path.join(process.env.QA_OUTPUT_DIR || require('node:os').tmpdir(), 'evidence-mobile.png'), fullPage: true });
    await page.getByRole('tab', { name: 'Source management', exact: true }).click();
    await page.getByRole('heading', { name: 'Watchlist', exact: true }).waitFor();
    assert.equal(await page.getByRole('tab', { name: 'Weekly brief', exact: true }).isVisible(), false);
    await page.getByText('Monitoring & analysis tools', { exact: true }).click();
    await page.getByRole('tab', { name: 'Weekly brief', exact: true }).click();
    await page.getByRole('heading', { name: 'Weekly product brief' }).waitFor();
    await page.getByRole('tab', { name: 'Watchlist', exact: true }).click();
    await page.getByText('Monitoring & analysis tools', { exact: true }).click();
    await page.screenshot({ path: path.join(process.env.QA_OUTPUT_DIR || require('node:os').tmpdir(), 'sources-mobile.png'), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: 'Back to next steps', exact: true }).click();
    await page.getByRole('button', { name: 'Edit research', exact: true }).click();
    await input.fill('I think I should remove all companion features from my backup product.');
    await page.getByRole('button', { name: 'Update next steps', exact: true }).click();
    await page.getByRole('heading', { name: 'Your original idea · adjust', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Explore a recovery rehearsal', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edit research', exact: true }).click();
    await input.fill('A different backup problem needs investigation now.'); invalid = true;
    await page.getByRole('button', { name: 'Update next steps', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'invalid evidence references' }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Explore a recovery rehearsal', exact: true }).count(), 1);
    const reportCount = reports;
    await input.fill('Another new field to explore, with no specific solution.'); failed = true;
    await page.getByRole('button', { name: 'Update next steps', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Discovery unavailable' }).waitFor();
    assert.equal(reports, reportCount, 'Service errors must not silently generate context-only reports');
    assert.deepEqual(errors, []);
    console.log('PASS: no-idea entry, context-only label and no collection, inferred vs observed directions, alternative to original idea, reload/cache, citations, invalid refs retain result, desktop/mobile');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
