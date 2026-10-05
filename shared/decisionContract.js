export const DECISION_VERSION = 'decision-research-v1';
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const strings = (value, min, max, length) => Array.isArray(value) && value.length >= min && value.length <= max && value.every(item => text(item, length));

export function parseDecisionBrief(value) {
  if (!value || typeof value !== 'object') return null;
  const fields = { title: 120, situation: 800, decision: 400, searchQuery: 400 };
  if (Object.entries(fields).some(([key, max]) => !text(value[key], max)) || !strings(value.assumptions, 1, 4, 300) || !strings(value.limits, 1, 4, 300)) return null;
  return { ...Object.fromEntries(Object.keys(fields).map(key => [key, value[key].trim()])), assumptions: value.assumptions, limits: value.limits };
}

export function parseDecisionResult(value, evidenceKeys) {
  if (!value || !['conditional', 'insufficient'].includes(value.position) || !text(value.conclusion, 1000)) return null;
  const refs = new Set(evidenceKeys);
  const validKeys = (keys, min) => Array.isArray(keys) && keys.length >= min && keys.length <= 6 && new Set(keys).size === keys.length && keys.every(key => refs.has(key));
  if (!validKeys(value.conclusionKeys, value.position === 'conditional' ? 1 : 0)) return null;
  const claims = items => Array.isArray(items) && items.length <= 4 && items.every(item => item && text(item.text, 700) && validKeys(item.evidenceKeys, 1));
  if (!claims(value.supports) || !claims(value.counters) || !strings(value.unknowns, 1, 6, 500)) return null;
  if (!value.nextStep || ['action', 'success', 'changeMind'].some(key => !text(value.nextStep[key], 600))) return null;
  return { position: value.position, conclusion: value.conclusion, conclusionKeys: value.conclusionKeys,
    supports: value.supports.map(({ text, evidenceKeys }) => ({ text, evidenceKeys })), counters: value.counters.map(({ text, evidenceKeys }) => ({ text, evidenceKeys })),
    unknowns: value.unknowns, nextStep: { action: value.nextStep.action, success: value.nextStep.success, changeMind: value.nextStep.changeMind } };
}
