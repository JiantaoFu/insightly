export const DECISION_VERSION: string;
export interface DecisionBrief { title: string; situation: string; decision: string; searchQuery: string; assumptions: string[]; limits: string[] }
export interface DecisionClaim { text: string; evidenceKeys: string[] }
export interface DecisionResult {
  position: 'conditional' | 'insufficient'; conclusion: string; conclusionKeys: string[];
  supports: DecisionClaim[]; counters: DecisionClaim[]; unknowns: string[];
  nextStep: { action: string; success: string; changeMind: string };
}
export function parseDecisionBrief(value: unknown): DecisionBrief | null;
export function parseDecisionResult(value: unknown, evidenceKeys: string[]): DecisionResult | null;
