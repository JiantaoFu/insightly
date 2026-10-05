import { getReviewAnalysis, requestedCountry, splitReviewWindows, type ModelLabel, type ResearchContext, type WatchApp } from './marketIntelligence';

export const OPPORTUNITY_VERSION = 'market-opportunities-v1';
export const OPPORTUNITY_STORAGE = 'insightly_market_opportunities_v1';
export const SAVED_OPPORTUNITY_STORAGE = 'insightly_saved_opportunities_v1';
export interface OpportunityEvidence {
  key: string; reviewKey: string; appId: string; appName: string; topic: string; quote: string;
  intent: ModelLabel['intent']; polarity: ModelLabel['polarity'];
  appUrl: string; date: string; country: string; source: string; partial: boolean; sample: boolean;
}
export interface Opportunity {
  id: string; title: string; scenario: string; obstacle: string; consequence: string; hypothesis: string;
  nextWho: string; nextQuestion: string; nextExperiment: string; unknowns: string[]; evidenceKeys: string[];
}
export interface OpportunityReport {
  version: string; inputKey: string; provider: string; model: string; generatedAt: string;
  opportunities: Opportunity[]; evidence: OpportunityEvidence[]; context: ResearchContext; days: number;
  usage: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number; thoughtsTokenCount?: number };
  sample: boolean;
  researchAppKeys?: string[];
}
export interface SavedOpportunity {
  opportunity: Opportunity; report: OpportunityReport; savedAt: string;
  stage: 'saved' | 'interview' | 'prototype' | 'archived';
}

export function selectOpportunityEvidence(apps: WatchApp[], context: ResearchContext, days = 30, now = new Date(), balanced = false): OpportunityEvidence[] {
  const sampleOnly = apps.length > 0 && apps.every(app => app.sample);
  const groups = apps.filter(app => sampleOnly || !app.sample).map(app => splitReviewWindows(app.reviews, days, now).current.flatMap((review, index) =>
    (getReviewAnalysis(review, !!app.sample)?.labels || []).filter(label => context.focusTopic === 'all' || label.topic.id === context.focusTopic)
      .map(label => ({ key: '', reviewKey: `${app.id}:${review.id || index}`.slice(0, 200), appId: app.id, appName: app.name, topic: label.topic.name,
        quote: label.evidence, intent: label.intent, polarity: label.polarity, appUrl: app.url, date: review.date || review.timestamp || '',
        country: app.reviewCountry || requestedCountry(app.url), source: app.reviewSource || 'unverified', partial: !!app.partial, sample: !!app.sample })))
    .sort((a, b) => Number(b.intent === 'complaint' || b.intent === 'request') - Number(a.intent === 'complaint' || a.intent === 'request')));
  if (balanced) for (const group of groups) {
    const problems = group.filter(item => item.intent === 'complaint' || item.intent === 'request');
    const alternatives = group.filter(item => item.intent !== 'complaint' && item.intent !== 'request');
    group.length = 0;
    while (problems.length || alternatives.length) {
      if (problems.length) group.push(problems.shift()!);
      if (alternatives.length) group.push(alternatives.shift()!);
    }
  }
  const selected: OpportunityEvidence[] = [], seen = new Set<string>();
  // Round-robin across apps so one high-volume app cannot consume the whole evidence budget.
  while (selected.length < 24 && groups.some(group => group.length)) {
    for (const group of groups) {
      let item;
      while (group.length && !item) {
        const candidate = group.shift()!;
        const signature = JSON.stringify([candidate.appId, candidate.topic, candidate.quote, candidate.intent, candidate.polarity]);
        if (!seen.has(signature)) { seen.add(signature); item = candidate; }
      }
      if (item) selected.push({ ...item, key: 'e' + selected.length });
      if (selected.length === 24) break;
    }
  }
  return selected;
}

export const opportunityInputKey = (context: ResearchContext, evidence: OpportunityEvidence[], days: number) => JSON.stringify([OPPORTUNITY_VERSION,
  { mode: context.mode || 'explore', product: context.product, question: context.question, focusTopic: context.focusTopic }, days, evidence]);
export const opportunityRequest = (marketId: string, context: ResearchContext, evidence: OpportunityEvidence[], days: number) => ({
  marketId, mode: context.mode || 'explore', product: context.product, question: context.question, days,
  evidence: evidence.map(({ key, reviewKey, appId, appName, topic, quote, intent, polarity }) => ({ key, reviewKey, appId, appName, topic, quote, intent, polarity })),
});

const bounded = (value: unknown, max: number, empty = false) => typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0);
export function parseOpportunityReport(value: unknown): OpportunityReport | null {
  if (!value || typeof value !== 'object') return null;
  const report = value as OpportunityReport;
  if (report.version !== OPPORTUNITY_VERSION || !bounded(report.inputKey, 150000) || !bounded(report.provider, 100) || !bounded(report.model, 100)
    || !Number.isFinite(new Date(report.generatedAt).getTime()) || typeof report.sample !== 'boolean' || ![7, 30, 90].includes(report.days)
    || !report.context || !bounded(report.context.product, 600, true) || !bounded(report.context.question, 400, true)
    || !['explore', 'improve'].includes(report.context.mode || 'explore') || !Array.isArray(report.evidence) || report.evidence.length > 24
    || !Array.isArray(report.opportunities) || report.opportunities.length > 5) return null;
  const refs = new Set<string>();
  if (report.researchAppKeys && (!Array.isArray(report.researchAppKeys) || report.researchAppKeys.length > 5 || report.researchAppKeys.some(key => !bounded(key, 200)))) return null;
  for (const item of report.evidence) {
    if (!item || !bounded(item.key, 100) || refs.has(item.key) || !bounded(item.quote, 1000) || !bounded(item.appName, 200)
      || !bounded(item.reviewKey, 200) || !bounded(item.appId, 100) || !bounded(item.topic, 100)
      || typeof item.appUrl !== 'string' || typeof item.date !== 'string' || typeof item.source !== 'string' || typeof item.country !== 'string'
      || typeof item.partial !== 'boolean' || typeof item.sample !== 'boolean'
      || !['positive', 'negative', 'mixed', 'neutral'].includes(item.polarity) || !['complaint', 'request', 'praise', 'observation'].includes(item.intent)) return null;
    refs.add(item.key);
  }
  const ids = new Set();
  const fields = { title: 140, scenario: 700, obstacle: 400, consequence: 400, hypothesis: 600, nextWho: 200, nextQuestion: 400, nextExperiment: 400 };
  for (const item of report.opportunities) {
    if (!item || !/^opportunity-[a-f0-9]{16}$/.test(item.id) || ids.has(item.id)
      || Object.entries(fields).some(([key, max]) => !bounded(item[key as keyof Opportunity], max))
      || !Array.isArray(item.unknowns) || item.unknowns.length < 1 || item.unknowns.length > 4 || item.unknowns.some(text => !bounded(text, 200))
      || !Array.isArray(item.evidenceKeys) || item.evidenceKeys.length < 1 || item.evidenceKeys.length > 6
      || new Set(item.evidenceKeys).size !== item.evidenceKeys.length || item.evidenceKeys.some(key => !refs.has(key))) return null;
    ids.add(item.id);
  }
  return report;
}

export function loadSavedOpportunities(value: unknown): SavedOpportunity[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((item): item is SavedOpportunity => {
    if (!item || !parseOpportunityReport(item.report) || !['saved', 'interview', 'prototype', 'archived'].includes(item.stage)
      || !Number.isFinite(new Date(item.savedAt).getTime()) || !item.opportunity
      || !item.report.opportunities.some((opportunity: Opportunity) => JSON.stringify(opportunity) === JSON.stringify(item.opportunity)) || seen.has(item.opportunity.id)) return false;
    seen.add(item.opportunity.id); return true;
  }).slice(0, 50);
}

export function saveOpportunitySnapshot(saved: SavedOpportunity[], opportunity: Opportunity, report: OpportunityReport, now = new Date()): SavedOpportunity[] {
  const existing = saved.find(item => item.opportunity.id === opportunity.id);
  if (existing) return saved.map(item => item.opportunity.id === opportunity.id ? { ...item, opportunity, report } : item);
  if (saved.length >= 50) throw new Error('Saved opportunity limit reached (50). Remove an older item before saving another.');
  return [...saved, { opportunity, report, savedAt: now.toISOString(), stage: 'saved' }];
}

export function illustrativeOpportunityReport(evidence: OpportunityEvidence[], context: ResearchContext, days: number): OpportunityReport {
  const opportunities: Opportunity[] = [
    { id: 'opportunity-0000000000000001', title: 'Open a notebook without losing the workflow',
      scenario: 'A note-taking user opens a notebook to access their notes. The exact setting and urgency need confirmation.',
      obstacle: 'The notebook crashes during loading.', consequence: 'Access is interrupted; time lost or data loss has not been established.',
      hypothesis: 'Reliable access may matter more than additional editing features for users who encounter this failure.',
      nextWho: context.mode === 'improve' ? 'Current users who encountered a loading crash' : 'People who recently abandoned a note app after a crash',
      nextQuestion: 'Tell me about the last time you could not open a notebook. What did you do next?',
      nextExperiment: 'Observe the notebook-opening workflow and test a small reliable-access prototype.',
      unknowns: ['How often the failure interrupts an important task', 'Whether users would switch or pay for a different solution'],
      evidenceKeys: evidence.filter(item => item.topic === 'Notebook loading reliability').slice(0, 3).map(item => item.key) },
    { id: 'opportunity-0000000000000002', title: 'Export notes without an internet connection',
      scenario: 'A note-taking user wants to export notes while offline. Travel and professional use are possible contexts to verify, not reported facts.',
      obstacle: 'Reviews request an offline export option.', consequence: 'The reason export is needed and the effect of waiting are not yet known.',
      hypothesis: 'Offline export could solve a specific portability problem if existing workarounds are inconvenient.',
      nextWho: context.mode === 'improve' ? 'Current users who export notes offline' : 'Note app users who currently work around online-only export',
      nextQuestion: 'When did you last need to export offline, and how did you complete the task?',
      nextExperiment: 'Test a minimal offline export prototype with users who have a concrete recent example.',
      unknowns: ['Which export formats and destinations are required', 'Whether this belongs in an existing app or supports a standalone product'],
      evidenceKeys: evidence.filter(item => item.topic === 'Offline export').slice(0, 3).map(item => item.key) },
  ].filter(item => item.evidenceKeys.length);
  return { version: OPPORTUNITY_VERSION, inputKey: opportunityInputKey(context, evidence, days), provider: 'sample', model: 'illustrative',
    generatedAt: new Date().toISOString(), opportunities, evidence, context, days, usage: {}, sample: true };
}

export function opportunityMarkdown(item: SavedOpportunity): string {
  const { opportunity: op, report } = item;
  return [`# ${op.title}`, '', report.sample ? 'ILLUSTRATIVE SAMPLE DATA' : 'AI-generated hypothesis, not a validated business opportunity.',
    `Research question: ${report.context.question || 'Not set'}`, `Task: ${report.context.mode || 'explore'}`, `Validation status: ${item.stage}`,
    '', '## Possible scenario', op.scenario, '', '## Reported obstacle', op.obstacle, '', '## Consequence to verify', op.consequence,
    '', '## Why investigate (hypothesis)', op.hypothesis, '', '## Unknowns', ...op.unknowns.map(text => '- ' + text),
    '', '## Next validation', `Who: ${op.nextWho}`, `Ask: ${op.nextQuestion}`, `Experiment: ${op.nextExperiment}`,
    '', '## Original evidence', ...report.evidence.filter(ref => op.evidenceKeys.includes(ref.key)).flatMap(ref => [
      '', `${ref.appName} | ${ref.date} | ${ref.country} | ${ref.source}${ref.partial ? ' | partial sample' : ''}`,
      ...ref.quote.split('\n').map(line => '> ' + line),
    ]), '', 'Only selected review excerpts were used. These do not establish market size, frequency, willingness to pay or competitive gaps.',
  ].join('\n');
}
