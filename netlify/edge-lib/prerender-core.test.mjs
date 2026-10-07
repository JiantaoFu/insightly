// Run: npm run test:prerender  (node --test, no extra deps)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyBody, applyHead, applyHeroCopy, extractSummary, hasMainMarkers, jsonForScript,
  mdToHtml, renderAppReportMain, renderInsightsMain, splitReport,
  applyGoneHead, classifyReportLookup, backendHeaders, fetchFailure, fallbackReason, FALLBACK_CDN_CACHE, PRERENDER_KEY_HEADER, isShareId, renderGoneMain, GONE, GONE_CSS, PAGE_CSS,
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

test('isShareId: md5 hex only', () => {
  assert.equal(isShareId('a76a6ea3f499160cdfe174330a02969d'), true);
  assert.equal(isShareId('1CD802BF2D661DC96A4DF344975AEFAF'), true);
  assert.equal(isShareId('doesnotexist123'), false);
  assert.equal(isShareId('https%3A%2F%2Fapps.apple.com%2Fus%2Fapp%2Fx'), false);
  assert.equal(isShareId(''), false);
});

test('classifyReportLookup: only explicit backend codes are definitive', () => {
  const id = 'a76a6ea3f499160cdfe174330a02969d';
  const app = (b) => !!b.appDetails;
  const c = (api, sid = id) => classifyReportLookup(sid, api, app);

  assert.deepEqual(c({ status: 200, body: { appDetails: {}, report: 'x' } }), { result: 'ok' });
  // Definitive
  assert.deepEqual(c(null, 'doesnotexist123'), { result: 'gone', reason: 'not_found' });
  assert.deepEqual(c({ status: 404, body: { error: 'Report not found', code: 'not_found' } }), { result: 'gone', reason: 'not_found' });
  assert.deepEqual(c({ status: 410, body: { error: 'Report expired.', code: 'expired' } }), { result: 'gone', reason: 'expired' });
  // Timeout / network error
  assert.equal(c(null).result, 'unknown');
  // Legacy ambiguous answers (current production backend): fallback
  assert.equal(c({ status: 404, body: { error: 'Report not found or inaccessible', shouldReanalyze: true } }).result, 'unknown');
  assert.equal(c({ status: 404, body: { error: 'Report expired. Please re-run the comparison.', shouldReanalyze: true } }).result, 'unknown');
  assert.equal(c({ status: 410, body: { error: 'Report expired. Please re-run the analysis.', shouldReanalyze: true } }).result, 'unknown');
  // Transient / odd
  assert.equal(c({ status: 503, body: { error: 'x', code: 'unavailable' } }).result, 'unknown');
  assert.equal(c({ status: 502, body: null }).result, 'unknown'); // Render's HTML error page
  assert.equal(c({ status: 500, body: { code: 'not_found' } }).result, 'unknown'); // code+status must agree
  assert.equal(c({ status: 410, body: { code: 'not_found' } }).result, 'unknown');
  assert.equal(c({ status: 200, body: { error: 'x' } }).result, 'unknown');
  assert.equal(c({ status: 200, body: {} }).result, 'unknown');
});

test('gone page: own title, noindex, no canonical, no hero, data for the SPA', () => {
  let html = applyGoneHead(shell);
  html = applyBody(html, {
    main: renderGoneMain({ reportType: 'competitor' }),
    css: PAGE_CSS + GONE_CSS,
    data: { kind: 'report-gone', shareId: 'abc', reportType: 'competitor', reason: 'not_found' },
  });
  assert.match(html, new RegExp(`<title>${GONE.title.replace(/[|]/g, '\\$&')}</title>`));
  assert.equal(count(html, /<title>/g), 1);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.equal(count(html, /<meta name="robots"/g), 1);
  assert.doesNotMatch(html, /rel="canonical"/);
  assert.doesNotMatch(html, /property="og:url"/);
  assert.doesNotMatch(html, /name="twitter:url"/);
  assert.doesNotMatch(html, /application\/ld\+json/);
  assert.doesNotMatch(html, /<main class="isk-hero"/); // home hero gone
  assert.doesNotMatch(html, /Find Your Next Product Idea/);
  assert.equal(count(html, /<h1[\s>]/g), 1);
  assert.match(html, /<h1>This report has expired or no longer exists<\/h1>/);
  assert.match(html, /<a class="ipr-btn" href="\/">Check an app/);
  assert.match(html, /competitor comparison/);
  assert.match(html, /data-prerendered/);
  assert.match(html, /id="__INSIGHTLY_DATA__">\{"kind":"report-gone"/);
});

test('backend auth header only when a secret is configured', () => {
  assert.deepEqual(backendHeaders(undefined), {});
  assert.deepEqual(backendHeaders(''), {});
  assert.deepEqual(backendHeaders('   '), {});
  assert.deepEqual(backendHeaders(' s3cret '), { [PRERENDER_KEY_HEADER]: 's3cret' });
  assert.equal(PRERENDER_KEY_HEADER, 'x-insightly-prerender-key');
});

test('fallback reason names the backend failure, never cached at the CDN', () => {
  const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' });
  assert.equal(fetchFailure(timeout), 'timeout');
  assert.equal(fetchFailure(Object.assign(new Error('a'), { name: 'AbortError' })), 'timeout');
  assert.equal(fetchFailure(new TypeError('fetch failed')), 'network');
  assert.equal(fallbackReason({ status: 0, body: null, failure: 'timeout' }), 'timeout');
  assert.equal(fallbackReason({ status: 0, body: null, failure: 'network' }), 'network');
  assert.equal(fallbackReason({ status: 429, body: null }), 'backend-429');
  assert.equal(fallbackReason({ status: 503, body: { code: 'unavailable' } }), 'backend-503');
  assert.equal(fallbackReason({ status: 404, body: { error: 'legacy' } }), 'backend-404');
  assert.equal(fallbackReason({ status: 200, body: { error: 'x' } }), 'bad-payload');
  assert.equal(fallbackReason(null), 'network');
  assert.equal(FALLBACK_CDN_CACHE, 'no-store');
});

test('edge function wiring: header sent, reasons set, fallbacks not cached (static check)', () => {
  const src = readFileSync(new URL('../edge-functions/prerender.ts', import.meta.url), 'utf8');
  assert.match(src, /Netlify\.env\.get\("PRERENDER_SHARED_SECRET"\)/);
  assert.match(src, /headers: backendHeaders\(PRERENDER_SECRET\)/);
  assert.doesNotMatch(src, /console\.\w+\([^)]*PRERENDER_SECRET/); // never logged
  assert.equal((src.match(/passthrough\(origin, html, fallbackReason\(api\)\)/g) || []).length, 2);
  assert.match(src, /"x-insightly-fallback-reason", fallbackReason\(api\)/); // /app-insights
  assert.match(src, /cdnCache \|\| FALLBACK_CDN_CACHE/);
});
