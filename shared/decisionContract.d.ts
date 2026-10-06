export const DECISION_VERSION: string;
export interface DecisionBrief { title: string; situation: string; decision: string; searchQuery: string; assumptions: string[]; limits: string[]; originalIdea?: string }
export interface ResearchDirection {
  kind: 'observed' | 'exploratory' | 'investigate'; title: string; scenario: string; problem: string; proposal: string;
  rationale: string; uncertainty: string; action: string; changeMind: string; evidenceKeys: string[];
}
export interface DecisionClaim { text: string; evidenceKeys: string[] }
export interface DecisionResult {
  position: 'conditional' | 'insufficient'; conclusion: string; conclusionKeys: string[];
  supports: DecisionClaim[]; counters: DecisionClaim[]; unknowns: string[];
  nextStep: { action: string; success: string; changeMind: string };
  directions?: ResearchDirection[];
  originalIdea?: { status: 'not_provided' | 'retain' | 'adjust' | 'set_aside' | 'undetermined'; assessment: string; evidenceKeys: string[] };
}
export function parseDecisionBrief(value: unknown): DecisionBrief | null;
export function parseDecisionResult(value: unknown, evidenceKeys: string[], requireDirections?: boolean): DecisionResult | null;
