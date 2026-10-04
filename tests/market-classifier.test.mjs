import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMarketClassifier, validateClassificationInput, validateClassificationOutput, classificationFailure, CLASSIFIER_VERSION } from '../server/marketClassifier.js';

const input = () => ({ marketId: 'market-one', topics: [], reviews: [{ key: 'r0', appName: 'Photos', text: 'Backup works but restoration scrambles the order' }] });
const output = () => ({ newTopics: [{ key: 'new-restore', name: 'Restored photo ordering', description: 'Photo order after restoration' }],
  classifications: [{ reviewKey: 'r0', labels: [{ topic: 'new-restore', polarity: 'negative', intent: 'complaint', issue: 'Restoration changes photo order', evidence: 'restoration scrambles the order' }] }] });
const profile = { configured: true, model: 'test-model' };

test('dynamic domain themes are assigned stable IDs and grounded original evidence', () => {
  const result = validateClassificationOutput(JSON.stringify(output()), input());
  assert.match(result.topics[0].id, /^topic-[a-f0-9]{16}$/);
  assert.equal(result.classifications[0].labels[0].topic.name, 'Restored photo ordering');
  assert.equal(result.topics[0].id, validateClassificationOutput(JSON.stringify(output()), input()).topics[0].id);
  const repeat = input(); repeat.topics = result.topics;
  assert.equal(validateClassificationOutput(JSON.stringify(output()), repeat).topics.length, 1);
});

test('hallucinated quotes, unknown themes, missing rows and invalid polarity are rejected', () => {
  for (const mutate of [
    result => { result.classifications[0].labels[0].evidence = 'invented quotation'; },
    result => { result.classifications[0].labels[0].topic = 'unknown'; },
    result => { result.classifications = []; },
    result => { result.classifications[0].labels[0].polarity = 'angry'; },
    result => { result.classifications[0].labels.push(result.classifications[0].labels[0]); },
  ]) { const result = output(); mutate(result); assert.throws(() => validateClassificationOutput(JSON.stringify(result), input())); }
  assert.throws(() => validateClassificationOutput('not json', input()));
});

test('model input is bounded and duplicate review keys are rejected', () => {
  assert.equal(validateClassificationInput(input()).reviews.length, 1);
  const duplicate = input(); duplicate.reviews.push(duplicate.reviews[0]);
  assert.throws(() => validateClassificationInput(duplicate));
  const long = input(); long.reviews[0].text = 'x'.repeat(16001);
  assert.throws(() => validateClassificationInput(long));
});

test('distinct aspects can share a theme without accepting identical duplicate assignments', () => {
  const body = input(); body.reviews[0].text = 'Import duplicates transactions. Please add undo.';
  const raw = output();
  raw.newTopics[0].name = 'Statement Import';
  raw.classifications[0].labels = [
    { topic: 'new-restore', polarity: 'negative', intent: 'complaint', issue: 'Imported transactions are duplicated', evidence: 'Import duplicates transactions.' },
    { topic: 'new-restore', polarity: 'neutral', intent: 'request', issue: 'Request to undo import', evidence: 'Please add undo.' },
  ];
  const result = validateClassificationOutput(JSON.stringify(raw), body);
  assert.equal(result.classifications[0].labels.length, 2);
  assert.equal(result.classifications[0].labels[0].topic.id, result.classifications[0].labels[1].topic.id);
  raw.classifications[0].labels.push({ ...raw.classifications[0].labels[0], issue: 'A differently worded duplicate summary' });
  assert.throws(() => validateClassificationOutput(JSON.stringify(raw), body), /identical aspect/);
});

test('classification cache is isolated by user, content, model and taxonomy', async () => {
  let calls = 0;
  const classify = createMarketClassifier(async prompt => { calls++; assert.match(prompt, /untrusted data/); return JSON.stringify(output()); });
  const first = await classify(input(), 'user-a', profile);
  assert.equal(first.version, CLASSIFIER_VERSION);
  assert.equal((await classify(input(), 'user-a', profile)).cached, true);
  assert.equal(calls, 1);
  await classify(input(), 'user-b', profile);
  await classify(input(), 'user-a', { ...profile, model: 'another-model' });
  const modified = input(); modified.reviews[0].text += ' again';
  await classify(modified, 'user-a', profile);
  const known = input(); known.topics = first.topics;
  await classify(known, 'user-a', profile);
  assert.equal(calls, 5);
});

test('missing configuration makes no model request and failures are not cached', async () => {
  let calls = 0;
  const classify = createMarketClassifier(async () => { calls++; throw new Error('Model unavailable'); });
  await assert.rejects(classify(input(), 'user-a', { configured: false }), /not configured/);
  assert.equal(calls, 0);
  await assert.rejects(classify(input(), 'user-a', profile), /Model unavailable/);
  await assert.rejects(classify(input(), 'user-a', profile), /Model unavailable/);
  assert.equal(calls, 2);
});

test('concurrent work for the same user is limited without blocking other users', async () => {
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const classify = createMarketClassifier(async () => { await waiting; return JSON.stringify(output()); });
  const first = classify(input(), 'user-a', profile);
  await assert.rejects(classify(input(), 'user-a', profile), /already running/);
  const second = classify(input(), 'user-b', profile);
  release();
  await Promise.all([first, second]);
});

test('provider billing and access failures are actionable without exposing SDK details', () => {
  for (const status of [400, 401, 402, 403, 404, 429, 500]) {
    const result = classificationFailure({ status, message: 'SDK response with secret-provider-details' });
    assert.doesNotMatch(result.message, /secret-provider-details/);
  }
  assert.match(classificationFailure({ status: 402 }).message, /billing credits are depleted/);
  assert.match(classificationFailure({ status: 429 }).message, /quota/);
  assert.match(classificationFailure({ status: 404 }).message, /model is unavailable/);
  assert.equal(classificationFailure({ status: 400, publicMessage: true, message: 'Invalid batch' }).message, 'Invalid batch');
});
