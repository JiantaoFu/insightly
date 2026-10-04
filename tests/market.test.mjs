import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/marketIntelligence.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { splitReviewWindows, calculateTopicTrends, buildMarketSignals, mergeMarketReviews, observeReviewSync, appendSyncObservation, normalizeResearchContext, buildResearchBrief, researchBriefMarkdown, getReviewAnalysis, getMarketTopics } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const loading = { id: 'topic-0000000000000001', name: 'Loading reliability', description: 'Loading workflow reliability' };
const exporting = { id: 'topic-0000000000000002', name: 'Offline export', description: 'Exporting without an internet connection' };
const annotated = (review, topic = loading, polarity = 'negative', intent = 'complaint') => ({ ...review,
  analysis: { version: 'market-semantic-v1', provider: 'gemini', model: 'test-model', source: 'model', sourceText: review.text, analyzedAt: '2026-10-03',
    labels: topic ? [{ topic, polarity, intent, issue: review.text, evidence: review.text }] : [] } });

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
test('model aspect judgments retain evidence and are independent of star ratings', () => {
  const trends = calculateTopicTrends([annotated({ text: 'App crashes and is slow', score: 5, date: new Date().toISOString() })]);
  const performance = trends.find(trend => trend.topic === 'Loading reliability');
  assert.equal(performance.delta, 1);
  assert.equal(performance.sentiment, 'negative');
  assert.equal(performance.example, 'App crashes and is slow');
});

test('unclassified reviews do not produce keyword topics or star-based sentiment', () => {
  const date = new Date().toISOString();
  assert.equal(calculateTopicTrends([{ text: 'Please add export. Loading is slow.', date }]).some(trend => trend.topic === 'Advertising'), false);
  assert.equal(calculateTopicTrends([{ text: 'Too many ads', date }]).length, 0);
});

const now = new Date('2026-10-03T00:00:00Z');
const app = (id, reviews, extra = {}) => ({ id, name: id, role: 'competitor', url: '', platform: 'ios', syncedAt: now.toISOString(), reviewSource: 'review-feed', reviews, ...extra });
const windowReviews = (count, crashes, date, prefix) => Array.from({ length: count }, (_, index) => annotated({ id: `${prefix}-${index}`, text: index < crashes ? 'App crashes' : 'Useful app', score: 2, date }, index < crashes ? loading : null));

test('traffic increase alone does not imply higher topic share; evidence stays attributed', () => {
  const reviews = [...windowReviews(10, 2, '2026-10-02', 'current'), ...windowReviews(5, 1, '2026-08-20', 'previous')];
  const signals = buildMarketSignals([app('A', reviews), app('B', [annotated({ text: 'Please add export', date: '2026-10-02' }, exporting, 'neutral', 'request')])], 30, now);
  const signal = signals.find(item => item.appId === 'A');
  assert.equal(signal.delta, 1);
  assert.equal(signal.changePp, 0);
  assert.equal(signal.evidence.length, 3);
  assert.ok(signal.evidence.every(item => item.review.text === 'App crashes'));
});

test('webpage samples, partial syncs and sparse baselines cannot claim a trend', () => {
  const reviews = [...windowReviews(10, 8, '2026-10-02', 'current'), ...windowReviews(10, 1, '2026-08-20', 'previous')];
  for (const candidate of [app('sample', reviews, { reviewSource: 'store-page-sample' }), app('partial', reviews, { partial: true }), app('sparse', reviews.slice(0, 2)), app('unknown', reviews, { reviewSource: undefined }), app('empty-sync', reviews, { lastFetchedCount: 0 }), app('stale', reviews, { syncedAt: '2026-09-20T00:00:00Z' })]) {
    const signal = buildMarketSignals([candidate], 30, now)[0];
    assert.equal(signal.changePp, null);
    assert.equal(signal.comparable, false);
    assert.ok(signal.comparisonReason);
  }
});

test('weekly and monthly evidence respect their own periods', () => {
  const reviews = [annotated({ text: 'App crashes', date: '2026-09-20' })];
  const weekly = buildMarketSignals([app('A', reviews)], 7, now)[0];
  const monthly = buildMarketSignals([app('A', reviews)], 30, now)[0];
  assert.equal(weekly.currentMentions, 0);
  assert.equal(weekly.previousMentions, 1);
  assert.equal(monthly.currentMentions, 1);
});

test('legacy date reviews merge with timestamp reviews and keep distinct IDs', () => {
  const old = { text: 'Review', userName: 'User', date: '2026-10-02T00:00:00Z' };
  const incoming = { id: 'one', text: 'Review', userName: 'User', timestamp: '2026-10-02T00:00:00.000Z' };
  assert.equal(mergeMarketReviews([old], [incoming]).length, 1);
  const changed = { ...incoming, text: 'Updated review' };
  assert.equal(mergeMarketReviews([incoming], [changed])[0].text, 'Updated review');
  assert.equal(mergeMarketReviews([incoming], [{ ...incoming, id: 'two' }]).length, 2);
});

const syncOptions = { startedAt: '2026-10-02T23:59:50Z', finishedAt: now.toISOString(), url: 'https://apps.apple.com/us/app/test/id123', kind: 'refresh', country: 'us', source: 'review-feed' };

test('sync observation separates discovered, updated and published dates', () => {
  const original = { id: 'old', text: 'Sync broken', score: 2, date: '2024-01-01', firstSeenAt: '2026-09-01T00:00:00Z' };
  const result = observeReviewSync([original], [
    { ...original, text: 'Sync fixed', score: 4 },
    { id: 'new', text: 'Old historical review', date: '2023-01-01' },
    { id: 'unknown', text: 'Undated' },
    { id: 'future', text: 'Future', date: '2027-01-01' },
  ], syncOptions);
  assert.equal(result.observation.discovered, 3);
  assert.equal(result.observation.updated, 1);
  assert.equal(result.observation.undated, 1);
  assert.equal(result.observation.futureDated, 1);
  assert.equal(result.observation.oldestDate, '2023-01-01T00:00:00.000Z');
  assert.equal(result.reviews.find(review => review.id === 'old').firstSeenAt, original.firstSeenAt);
  assert.equal(result.reviews.find(review => review.id === 'new').firstSeenAt, now.toISOString());
  assert.equal(splitReviewWindows(result.reviews, 30, now).current.length, 0);
  const repeated = observeReviewSync(result.reviews, result.reviews, syncOptions);
  assert.equal(repeated.observation.discovered, 0);
  assert.equal(repeated.observation.updated, 0);
});

test('sync counts distinct IDs while upgrading legacy signatures without a false discovery', () => {
  const legacy = { text: 'Same text', userName: 'User', date: '2026-10-02' };
  const first = { ...legacy, id: 'first' };
  const migrated = observeReviewSync([legacy], [first], syncOptions);
  assert.equal(migrated.observation.discovered, 0);
  assert.equal(migrated.reviews[0].firstSeenAt, undefined);
  const distinct = observeReviewSync([first], [{ ...first, id: 'second' }], syncOptions);
  assert.equal(distinct.observation.discovered, 1);
  assert.equal(distinct.reviews.length, 2);
});

test('retention cap does not erase the count of first discoveries', () => {
  const existing = Array.from({ length: 2000 }, (_, index) => ({ id: `old-${index}`, text: 'Old', date: '2024-01-01' }));
  const result = observeReviewSync(existing, [{ id: 'new', text: 'New', date: '2026-10-02' }], syncOptions);
  assert.equal(result.reviews.length, 2000);
  assert.equal(result.observation.discovered, 1);
});

test('latest failed sync and region mismatch withhold comparisons after reload', () => {
  const reviews = [...windowReviews(10, 8, '2026-10-02', 'current'), ...windowReviews(10, 1, '2026-08-20', 'previous')];
  for (const candidate of [app('failed', reviews, { syncHistory: [{ status: 'failed' }] }), app('fallback', reviews, { url: syncOptions.url, reviewCountry: 'gb' })]) {
    assert.equal(buildMarketSignals([candidate], 30, now)[0].comparable, false);
  }
  const history = Array.from({ length: 25 }, (_, index) => ({ status: 'success', index }));
  assert.equal(appendSyncObservation(history, { status: 'failed' }).length, 20);
});

test('research question validation handles malformed storage and bounds input', () => {
  assert.deepEqual(normalizeResearchContext(null), { product: '', question: '', focusTopic: 'all' });
  const normalized = normalizeResearchContext({ product: 'x'.repeat(900), question: ' question ', focusTopic: 'Invented topic' });
  assert.equal(normalized.product.length, 600);
  assert.equal(normalized.question, 'question');
  assert.equal(normalized.focusTopic, 'all');
});

test('research brief respects app, date and explicit topic scope without inventing answers', () => {
  const candidate = app('A', [annotated({ text: 'Please add export', date: '2026-10-02' }, exporting, 'neutral', 'request'), annotated({ text: 'Sync broken', date: '2026-10-02' })], { sample: true });
  const context = { product: 'My product', question: 'Should we implement export?', focusTopic: exporting.id };
  const brief = buildResearchBrief([candidate], context, 7, now);
  assert.equal(brief.findings.length, 1);
  assert.equal(brief.findings[0].appId, 'A');
  assert.equal(brief.findings[0].topic, 'Offline export');
  assert.equal(brief.findings[0].comparable, false);
  const exported = researchBriefMarkdown(brief);
  assert.match(exported, /ILLUSTRATIVE SAMPLE DATA/);
  assert.match(exported, /Should we implement export/);
  assert.match(exported, /Please add export/);
  assert.doesNotMatch(exported, /Sync broken/);
  assert.match(exported, /Comparison withheld/);
  assert.equal(buildResearchBrief([candidate], { ...context, focusTopic: 'topic-0000000000000009' }, 7, now).findings.length, 0);
  assert.equal(buildResearchBrief([candidate], context, 7, new Date('2027-01-01')).findings.length, 0);
});

test('updated review text invalidates classification but retains known theme vocabulary', () => {
  const original = annotated({ id: 'one', text: 'Loading fails', date: '2026-10-02' });
  const changed = mergeMarketReviews([original], [{ id: 'one', text: 'Loading now works', date: '2026-10-02' }]);
  assert.equal(getReviewAnalysis(changed[0]), null);
  assert.equal(calculateTopicTrends(changed, 30, now).length, 0);
  assert.equal(getMarketTopics([app('A', changed)])[0].id, loading.id);
});

test('incomplete or mixed-model classification cannot claim a sample trend', () => {
  const reviews = [...windowReviews(5, 2, '2026-10-02', 'current'), ...windowReviews(5, 1, '2026-08-20', 'previous')];
  const unclassified = reviews.map((review, index) => index === 0 ? { ...review, analysis: undefined } : review);
  assert.equal(buildMarketSignals([app('A', unclassified)], 30, now)[0].comparable, false);
  const changedModel = reviews.map((review, index) => index === 0 ? { ...review, analysis: { ...review.analysis, model: 'other-model' } } : review);
  assert.equal(buildMarketSignals([app('A', changedModel)], 30, now)[0].comparable, false);
});

test('different domains and multiple aspects do not require preset category names', () => {
  const restore = { id: 'topic-0000000000000003', name: 'Restored photo ordering', description: 'Photo ordering after recovery' };
  const review = annotated({ text: 'Backup is great but restore scrambles order', date: '2026-10-02', score: 5 }, loading, 'positive', 'praise');
  review.analysis.labels.push({ topic: restore, polarity: 'negative', intent: 'complaint', issue: 'Restore scrambles ordering', evidence: 'restore scrambles order' });
  const trends = calculateTopicTrends([review], 30, now);
  assert.equal(trends.find(item => item.topicId === loading.id).sentiment, 'positive');
  assert.equal(trends.find(item => item.topicId === restore.id).sentiment, 'negative');
  const banking = { id: 'topic-0000000000000004', name: 'Duplicate bank transactions', description: 'Duplicate transaction import' };
  assert.equal(calculateTopicTrends([annotated({ text: 'Transaction duplicated', date: '2026-10-02' }, banking)], 30, now)[0].topic, banking.name);
});

test('stored classifications reject malformed or oversized aspects', () => {
  const review = annotated({ text: 'Loading fails', date: '2026-10-02' });
  for (const topic of [{ ...loading, id: 'arbitrary' }, { ...loading, name: 5 }, { ...loading, description: 'x'.repeat(301) }]) {
    assert.equal(getReviewAnalysis({ ...review, analysis: { ...review.analysis, labels: [{ ...review.analysis.labels[0], topic }] } }), null);
  }
  assert.equal(getReviewAnalysis({ ...review, analysis: { ...review.analysis, labels: Array(5).fill(review.analysis.labels[0]) } }), null);
});

test('multiple aspects preserve each intent while counting a review once per theme and period', () => {
  const makeReview = date => {
    const review = annotated({ text: 'Import duplicates transactions. Please add undo.', date }, loading);
    review.analysis.labels[0].evidence = 'Import duplicates transactions.';
    review.analysis.labels.push({ topic: loading, polarity: 'neutral', intent: 'request', issue: 'Request to undo import', evidence: 'Please add undo.' });
    assert.ok(getReviewAnalysis(review));
    return review;
  };
  const trend = calculateTopicTrends([makeReview('2026-10-02'), makeReview('2026-08-20')], 30, now)[0];
  assert.equal(trend.currentMentions, 1);
  assert.equal(trend.previousMentions, 1);
  assert.equal(trend.delta, 0);
  assert.equal(trend.currentShare, 100);
  assert.equal(trend.previousShare, 100);
  assert.equal(trend.complaintMentions, 1);
  assert.equal(trend.requestMentions, 1);
  assert.equal(trend.evidence.length, 4);
});
