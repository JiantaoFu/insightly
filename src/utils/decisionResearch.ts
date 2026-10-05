import { DECISION_VERSION, parseDecisionBrief, parseDecisionResult, type DecisionBrief, type DecisionResult } from '../../shared/decisionContract.js';
import { OPPORTUNITY_VERSION, parseOpportunityReport, type OpportunityEvidence } from './marketOpportunities';

export interface DecisionReport {
  version: string; provider: string; model: string; generatedAt: string; inputKey: string;
  input: string; brief: DecisionBrief; days: number; appKeys: string[];
  evidence: OpportunityEvidence[]; result: DecisionResult; usage: { totalTokenCount?: number };
}
export interface DecisionState { input: string; briefInput: string; brief: DecisionBrief | null; report: DecisionReport | null }
export const emptyDecision = (): DecisionState => ({ input: '', briefInput: '', brief: null, report: null });
export const decisionInputKey = (input: string, brief: DecisionBrief, days: number, appKeys: string[], evidence: OpportunityEvidence[], model: string) =>
  JSON.stringify([DECISION_VERSION, input, brief, days, appKeys, evidence, model]);

export function parseDecisionReport(value: unknown): DecisionReport | null {
  if (!value || typeof value !== 'object') return null;
  const report = value as DecisionReport;
  const brief = parseDecisionBrief(report.brief);
  if (report.version !== DECISION_VERSION || !brief || typeof report.input !== 'string' || report.input.length > 4000 || typeof report.inputKey !== 'string' || report.inputKey.length > 200000
    || !Array.isArray(report.appKeys) || report.appKeys.length > 5 || report.appKeys.some(key => typeof key !== 'string' || key.length > 200)) return null;
  const evidenceReport = parseOpportunityReport({ ...report, version: OPPORTUNITY_VERSION, opportunities: [], sample: false,
    context: { mode: 'improve', product: '', question: brief.decision, focusTopic: 'all' } });
  if (!evidenceReport || report.evidence.some(item => item.sample)) return null;
  const result = parseDecisionResult(report.result, report.evidence.map(item => item.key));
  return result ? { ...report, brief, result } : null;
}

export function loadDecision(value: unknown): DecisionState {
  if (!value || typeof value !== 'object') return emptyDecision();
  const state = value as DecisionState;
  return { input: typeof state.input === 'string' ? state.input.slice(0, 4000) : '', briefInput: typeof state.briefInput === 'string' ? state.briefInput.slice(0, 4000) : '',
    brief: parseDecisionBrief(state.brief), report: parseDecisionReport(state.report) };
}
