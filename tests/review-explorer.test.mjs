import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const options = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const compile = name => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(readFileSync(new URL(`../src/utils/${name}.ts`, import.meta.url), 'utf8'), { compilerOptions: options }).outputText.replace(/from '\.\/marketIntelligence'/g, `from '${market}'`)).toString('base64');
let market = '';
market = compile('marketIntelligence');
const { filterReviews, reviewsCsv } = await import(compile('reviewExplorer'));
const now = Date.parse('2026-10-17T12:00:00Z');
const filters = { appId: 'all', platform: 'all', days: 0, query: '', intent: 'all' };
const apps = [{ id: 'a', name: '=APP()', platform: 'ios', url: 'https://apps.apple.com/us/app/id1', reviews: [
  { id: '1', text: 'Backup fails', date: '2026-10-16T12:00:00Z' },
  { id: '2', text: 'Older backup', date: '2026-01-01' },
  { id: '3', text: '=FORMULA()', date: 'bad' },
  { id: '4', text: 'Future date', date: '2027-01-01' },
] }, { id: 'b', platform: 'android', name: 'Second app', reviews: [{ text: 'Restore works', date: '2026-10-16' }] },
{ id: 'sample', sample: true, reviews: [{ text: 'Fake review' }] }];
test('review explorer scopes source, dates and platform without substituting demo data', () => {
  assert.equal(filterReviews(apps, filters, now).length, 5);
  assert.equal(filterReviews(apps, { ...filters, days: 7 }, now).length, 2);
  assert.equal(filterReviews(apps, { ...filters, days: 7, platform: 'ios' }, now).length, 1);
  assert.equal(filterReviews(apps, { ...filters, appId: 'a', query: 'BACKUP' }, now).length, 2);
  assert.equal(filterReviews(apps, { ...filters, intent: 'complaint' }, now).length, 0);
  assert.equal(filterReviews(apps, { ...filters, intent: 'unclassified' }, now).length, 5);
});
test('review CSV preserves provenance and neutralizes spreadsheet formulas', () => {
  const csv = reviewsCsv(filterReviews(apps.slice(0, 1), filters, now));
  assert.match(csv, /"'\=APP\(\)"/);
  assert.match(csv, /"'\=FORMULA\(\)"/);
  assert.match(csv, /unverified/);
  assert.match(csv, /app_url/);
});

test('rating filter composes with query and excludes unrated reviews from rated results', () => {
  const rated = [{ ...apps[0], reviews: apps[0].reviews.map((review, index) => ({ ...review, score: index === 0 ? 2 : undefined })) }];
  const matching = filterReviews(rated, { ...filters, rating: '2', query: 'backup' }, now);
  assert.equal(matching.length, 1);
  assert.equal(filterReviews(rated, { ...filters, rating: '5' }, now).length, 0);
  assert.equal(filterReviews(rated, { ...filters, topic: 'missing' }, now).length, 0);
  assert.match(reviewsCsv(matching), /Backup fails/);
  assert.doesNotMatch(reviewsCsv(matching), /Older backup/);
});
