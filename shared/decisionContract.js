export const DECISION_VERSION = 'decision-research-v2';
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const strings = (value, min, max, length) => Array.isArray(value) && value.length >= min && value.length <= max && value.every(item => text(item, length));

export function parseDecisionBrief(value) {
  if (!value || typeof value !== 'object') return null;
  const fields = { title: 120, situation: 800, decision: 400, searchQuery: 400 };
  if (Object.entries(fields).some(([key, max]) => !text(value[key], max)) || !strings(value.assumptions, 0, 4, 300) || !strings(value.limits, 1, 4, 300)) return null;
  if (value.originalIdea !== undefined && (typeof value.originalIdea !== 'string' || value.originalIdea.length > 600)) return null;
  return { ...Object.fromEntries(Object.keys(fields).map(key => [key, value[key].trim()])), assumptions: value.assumptions, limits: value.limits,
    ...(value.originalIdea !== undefined ? { originalIdea: value.originalIdea.trim() } : {}) };
}

export function parseDecisionResult(value, evidenceKeys, requireDirections = false) {
  if (!value || !['conditional', 'insufficient'].includes(value.position) || !text(value.conclusion, 1000)) return null;
  const refs = new Set(evidenceKeys);
  const validKeys = (keys, min) => Array.isArray(keys) && keys.length >= min && keys.length <= 6 && new Set(keys).size === keys.length && keys.every(key => refs.has(key));
  if (!validKeys(value.conclusionKeys, value.position === 'conditional' ? 1 : 0)) return null;
  const claims = items => Array.isArray(items) && items.length <= 4 && items.every(item => item && text(item.text, 700) && validKeys(item.evidenceKeys, 1));
  if (!claims(value.supports) || !claims(value.counters) || !strings(value.unknowns, 1, 6, 500)) return null;
  if (!value.nextStep || ['action', 'success', 'changeMind'].some(key => !text(value.nextStep[key], 600))) return null;
  if (!evidenceKeys.length && value.position !== 'insufficient') return null;
  if (requireDirections || value.directions !== undefined) {
    if (!Array.isArray(value.directions) || value.directions.length < 1 || value.directions.length > 3) return null;
    const titles = new Set();
    for (const item of value.directions) {
      if (!item || !['observed', 'exploratory', 'investigate'].includes(item.kind) || !text(item.title, 140)
        || ['scenario', 'problem', 'proposal', 'rationale', 'uncertainty', 'action', 'changeMind'].some(key => !text(item[key], 600))
        || !validKeys(item.evidenceKeys, item.kind === 'observed' ? 1 : 0) || titles.has(item.title.trim().toLowerCase())) return null;
      titles.add(item.title.trim().toLowerCase());
    }
    if (!value.originalIdea || !['not_provided', 'retain', 'adjust', 'set_aside', 'undetermined'].includes(value.originalIdea.status)
      || !text(value.originalIdea.assessment, 800) || !validKeys(value.originalIdea.evidenceKeys, 0)) return null;
    if (!evidenceKeys.length && ['retain', 'set_aside'].includes(value.originalIdea.status)) return null;
  }
  return { position: value.position, conclusion: value.conclusion, conclusionKeys: value.conclusionKeys,
    supports: value.supports.map(({ text, evidenceKeys }) => ({ text, evidenceKeys })), counters: value.counters.map(({ text, evidenceKeys }) => ({ text, evidenceKeys })),
    unknowns: value.unknowns, nextStep: { action: value.nextStep.action, success: value.nextStep.success, changeMind: value.nextStep.changeMind },
    ...(value.directions !== undefined ? { directions: value.directions.map(item => Object.fromEntries(['kind', 'title', 'scenario', 'problem', 'proposal', 'rationale', 'uncertainty', 'action', 'changeMind', 'evidenceKeys'].map(key => [key, item[key]]))),
      originalIdea: { status: value.originalIdea.status, assessment: value.originalIdea.assessment, evidenceKeys: value.originalIdea.evidenceKeys } } : {}) };
}
