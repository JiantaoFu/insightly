// Run: npm run test:prerender  (node --test, no extra deps)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyBody, applyHead, applyHeroCopy, extractSummary, hasMainMarkers, jsonForScript,
  mdToHtml, renderAppReportMain, renderInsightsMain, splitReport,
} from './prerender-core.js';

const shell = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const count = (html, re) => (html.match(re) || []).length;

const REPORT = `# Summary of Key Insights
Acme is loved for speed. However, sync bugs frustrate users.

### Key Weaknesses
* **Sync Bugs:** Files <b>vanish</b> after update.
* **Ads:** Too many.
  * nested point

---

# Key User Pain Points
1. Login loops
2. Crashes on launch

| Area | Score |
|---|---|
| UX | 3 |
`;

test('index.html has the markers the edge function relies on', () => {
  assert.ok(hasMainMarkers(shell));
  assert.equal(count(shell, /<h1\b/g), 1);
});

test('extractSummary/splitReport mirror ShareReportView', () => {
  assert.ok(extractSummary(REPORT).startsWith('Acme is loved for speed. However, sync bugs frustrate users.'));
  assert.ok(extractSummary(REPORT).length <= 155);
  assert.equal(extractSummary('Users (68.4%) love it. Others (12.5%) do not.'), 'Users (68.4%) love it. Others (12.5%) do not.');
  const long = extractSummary('word '.repeat(80) + 'end.');
  assert.ok(long.endsWith('…') && long.length <= 153);
  const { tldr, body } = splitReport(REPORT);
  assert.equal(tldr, 'Acme is loved for speed. However, sync bugs frustrate users.');
  assert.ok(body.startsWith('### Key Weaknesses'));
});

test('mdToHtml escapes HTML and demotes headings', () => {
  const html = mdToHtml(REPORT).replace(/\n/g, '');
  assert.ok(!html.includes('<b>'), 'raw HTML from the report must be escaped');
  assert.ok(html.includes('&lt;b&gt;vanish&lt;/b&gt;'));
  assert.ok(html.includes('<strong>Sync Bugs:</strong>'));
  assert.equal(count(html, /<h1\b/g), 0);
  assert.ok(html.includes('<h2>Key User Pain Points</h2>'));
  assert.ok(html.includes('<ol><li>Login loops</li><li>Crashes on launch</li></ol>'));
  assert.ok(html.includes('<ul><li>nested point</li></ul>'));
  assert.ok(html.includes('<td>UX</td>'));
  assert.equal(count(html, /<ul>/g), count(html, /<\/ul>/g));
});

test('jsonForScript cannot close the script tag', () => {
  const s = jsonForScript({ t: '</script><script>alert(1)</script>' });
  assert.ok(!s.includes('</script>'));
  assert.deepEqual(JSON.parse(s), { t: '</script><script>alert(1)</script>' });
});

test('report page: own head tags, one h1, body text, embedded data', () => {
  const appDetails = { title: 'Acme "Pro" <App>', icon: 'https://x/icon.png', developer: 'Acme', platform: 'ios',
    reviews: [{ score: 1 }, { score: 5 }, { score: 5 }] };
  let html = applyHead(shell, {
    title: `${appDetails.title} Review Analysis Report | Insightly`,
    description: extractSummary(REPORT),
    canonical: 'https://insightly.top/shared-app-report/abc123',
    ogType: 'article', image: appDetails.icon, twitterCard: 'summary', jsonLd: null,
  });
  html = applyBody(html, { main: renderAppReportMain({ appDetails, report: REPORT }), css: '.x{}',
    data: { kind: 'app-report', shareId: 'abc123', appDetails, report: REPORT } });
  assert.match(html, /<title>Acme &quot;Pro&quot; &lt;App&gt; Review Analysis Report \| Insightly<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/insightly.top\/shared-app-report\/abc123">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/insightly.top\/shared-app-report\/abc123">/);
  assert.match(html, /<meta name="twitter:card" content="summary">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/x\/icon.png">/);
  assert.equal(count(html, /<meta name="description"/g), 1);
  assert.equal(count(html, /<title>/g), 1);
  assert.equal(count(html, /og:image:width/g), 0);
  assert.equal(count(html, /application\/ld\+json/g), 0);
  assert.ok(!html.includes('Find Your Next Product Idea in Competitors'), 'home copy must be gone');
  assert.equal(count(html, /<h1\b/g), 1);
  assert.ok(html.includes('Files &lt;b&gt;vanish&lt;/b&gt; after update.'));
  assert.ok(html.includes('id="__INSIGHTLY_DATA__"'));
  assert.ok(html.includes('3 reviews analyzed'));
});

test('insights list + teams hero', () => {
  const main = renderInsightsMain({ title: 'Archive', intro: 'Intro', total: 2864,
    items: [{ hashUrl: 'h1', title: 'App One', developer: 'Dev', platform: 'android', icon: '', avgRating: 4.2 }] });
  assert.ok(main.includes('href="/shared-app-report/h1"'));
  assert.ok(main.includes('2,864 public reports'));
  const teams = applyHeroCopy(shell, { heading: 'Teams H', subtitle: 'Teams S', cta: { label: 'Book a Demo', href: 'https://c/x', external: true } });
  assert.ok(teams.includes('<h1 class="isk-h1">Teams H</h1>'));
  assert.ok(teams.includes('data-prerendered'));
  assert.ok(teams.includes('>Book a Demo</a>'));
});
