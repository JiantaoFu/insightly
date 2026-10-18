import { DECISION_VERSION, parseDecisionBrief, parseDecisionResult, type DecisionBrief, type DecisionResult } from '../../shared/decisionContract.js';
import { OPPORTUNITY_VERSION, parseOpportunityReport, type OpportunityEvidence } from './marketOpportunities';

export interface DecisionReport {
  version: string; provider: string; model: string; generatedAt: string; inputKey: string;
  input: string; brief: DecisionBrief; days: number; appKeys: string[];
  evidence: OpportunityEvidence[]; result: DecisionResult; usage: { totalTokenCount?: number };
  basis?: 'context' | 'reviews';
}
export interface DecisionState { input: string; briefInput: string; brief: DecisionBrief | null; report: DecisionReport | null }
export interface DecisionPlan {
  id: string; directionIndex: number; report: DecisionReport; savedAt: string;
  stage: 'saved' | 'testing' | 'supported' | 'set-aside'; experiment: string; success: string; notes: string;
}
export function loadDecisionPlans(value: unknown): DecisionPlan[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.flatMap((item: DecisionPlan) => {
    if (!item || typeof item.id !== 'string' || item.id.length > 100 || ids.has(item.id)) return [];
    const report = parseDecisionReport(item.report);
    if (!report?.result.directions?.[item.directionIndex] || !Number.isInteger(item.directionIndex)
      || !['saved', 'testing', 'supported', 'set-aside'].includes(item.stage)
      || typeof item.savedAt !== 'string' || !Number.isFinite(Date.parse(item.savedAt))
      || ![item.experiment, item.success, item.notes].every(text => typeof text === 'string' && text.length <= 4000)) return [];
    ids.add(item.id);
    return [{ id: item.id, report, directionIndex: item.directionIndex, savedAt: item.savedAt, stage: item.stage,
      experiment: item.experiment, success: item.success, notes: item.notes }];
  });
}
export function saveDecisionPlan(plans: DecisionPlan[], report: DecisionReport, directionIndex: number): DecisionPlan[] {
  const direction = report.result.directions?.[directionIndex];
  if (!direction || !parseDecisionReport(report)) throw new Error('Only a valid research direction can be saved.');
  if (plans.some(plan => plan.report.inputKey === report.inputKey && plan.directionIndex === directionIndex)) return plans;
  return [...plans, { id: crypto.randomUUID(), directionIndex, report, savedAt: new Date().toISOString(), stage: 'saved',
    experiment: direction.action, success: '', notes: '' }];
}
export function decisionPlanMarkdown(plan: DecisionPlan): string {
  const direction = plan.report.result.directions![plan.directionIndex];
  return [`# ${direction.title}`, `Research: ${plan.report.brief.decision}`, `Saved: ${plan.savedAt}`,
    `Status: ${plan.stage} (user recorded, not automatically validated)`, `## Proposal\n${direction.proposal}`,
    `## User scenario\n${direction.scenario}`, `## Limits\n${direction.uncertainty}`,
    `## Experiment\n${plan.experiment}`, `## Success criterion\n${plan.success || 'Not defined'}`,
    `## What would change this direction\n${direction.changeMind}`, `## Notes\n${plan.notes}`,
    `## Evidence\n${plan.report.evidence.filter(ref => direction.evidenceKeys.includes(ref.key)).map(ref => `${ref.appName} | ${ref.country} | ${ref.date}\n${ref.quote}\n${ref.appUrl}`).join('\n\n') || 'No supporting review citations.'}`].join('\n\n');
}
export const emptyDecision = (): DecisionState => ({ input: '', briefInput: '', brief: null, report: null });
export const decisionInputKey = (input: string, brief: DecisionBrief, days: number, appKeys: string[], evidence: OpportunityEvidence[], model: string) =>
  JSON.stringify([DECISION_VERSION, input, brief, days, appKeys, evidence, model]);

export function parseDecisionReport(value: unknown): DecisionReport | null {
  if (!value || typeof value !== 'object') return null;
  const report = value as DecisionReport;
  const brief = parseDecisionBrief(report.brief);
  if (![DECISION_VERSION, 'decision-research-v1'].includes(report.version) || !brief || typeof report.input !== 'string' || report.input.length > 4000 || typeof report.inputKey !== 'string' || report.inputKey.length > 200000
    || !Array.isArray(report.appKeys) || report.appKeys.length > 5 || report.appKeys.some(key => typeof key !== 'string' || key.length > 200)) return null;
  const evidenceReport = parseOpportunityReport({ ...report, version: OPPORTUNITY_VERSION, opportunities: [], sample: false,
    context: { mode: 'improve', product: '', question: brief.decision, focusTopic: 'all' } });
  if (!evidenceReport || report.evidence.some(item => item.sample)) return null;
  if (report.basis !== undefined && !['context', 'reviews'].includes(report.basis)) return null;
  if (report.basis === 'context' && (report.evidence.length || report.appKeys.length)) return null;
  const result = parseDecisionResult(report.result, report.evidence.map(item => item.key), report.version === DECISION_VERSION);
  return result ? { ...report, brief, result } : null;
}

export function loadDecision(value: unknown): DecisionState {
  if (!value || typeof value !== 'object') return emptyDecision();
  const state = value as DecisionState;
  return { input: typeof state.input === 'string' ? state.input.slice(0, 4000) : '', briefInput: typeof state.briefInput === 'string' ? state.briefInput.slice(0, 4000) : '',
    brief: parseDecisionBrief(state.brief), report: parseDecisionReport(state.report) };
}
