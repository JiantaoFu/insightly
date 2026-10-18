import { normalizeResearchContext, type ResearchContext, type WatchApp } from './marketIntelligence';
import { loadResearchScope, SCOPE_STORAGE, storeAppKey, type ResearchScope } from './marketResearchFlow';
import { loadSavedOpportunities, OPPORTUNITY_STORAGE, parseOpportunityReport, SAVED_OPPORTUNITY_STORAGE, type OpportunityReport, type SavedOpportunity } from './marketOpportunities';
import { loadDecision, loadDecisionPlans, type DecisionPlan, type DecisionState } from './decisionResearch';

export const PROJECTS_STORAGE = 'insightly_research_projects_v1';
export interface ResearchProject {
  id: string;
  scope: ResearchScope;
  research: ResearchContext;
  report: OpportunityReport | null;
  saved: SavedOpportunity[];
  days: number;
  roles: Record<string, WatchApp['role']>;
  sample?: boolean;
  workflow?: 'decision' | 'apps';
  decision?: DecisionState;
  decisionPlans?: DecisionPlan[];
  analysisApp?: WatchApp;
}
export interface ResearchProjects { activeId: string; projects: ResearchProject[] }

export function newResearchProject(): ResearchProject {
  return { id: crypto.randomUUID(), scope: { query: '', title: 'New research', country: 'us', apps: [] },
    research: normalizeResearchContext(null), report: null, saved: [], days: 90, roles: {} };
}

export function projectSources(project: ResearchProject, apps: WatchApp[]): WatchApp[] {
  const keys = new Set(project.scope.apps.map(app => app.key));
  return apps.filter(app => app.sample ? !!project.sample && !keys.size : keys.has(storeAppKey(app.url)))
    .map(app => ({ ...app, role: project.roles[storeAppKey(app.url)] || 'competitor' }));
}

export function changeResearchProject(state: ResearchProjects, id: string, patch: Partial<ResearchProject>): ResearchProjects {
  const current = state.projects.find(item => item.id === id);
  if (!current) return state;
  if (patch.scope?.title === 'New research' && patch.scope.apps.length) patch = { ...patch, scope: { ...patch.scope, title: patch.scope.apps[0].title.slice(0, 160) } };
  // A committed new starting point creates a direction; edits within a direction stay together.
  if (current.workflow !== 'decision' && patch.scope && patch.scope.query !== current.scope.query && (current.scope.apps.length || current.report || current.saved.length)) {
    const next = { ...newResearchProject(), ...patch };
    return { activeId: next.id, projects: [...state.projects, next] };
  }
  return { ...state, projects: state.projects.map(item => item.id === id ? { ...item, ...patch } : item) };
}

// Legacy keys remain untouched so migration is reversible and shared reviews are not duplicated.
export function loadResearchProjects(storage: Pick<Storage, 'getItem'>, apps: WatchApp[]): ResearchProjects {
  const read = (key: string): unknown => { try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; } };
  const stored = read(PROJECTS_STORAGE) as ResearchProjects | null;
  if (stored && Array.isArray(stored.projects)) {
    const ids = new Set<string>();
    const projects = stored.projects.filter(item => item && typeof item.id === 'string' && item.id && !ids.has(item.id) && ids.add(item.id)).map(item => ({
      id: item.id, scope: loadResearchScope(item.scope, []), research: normalizeResearchContext(item.research),
      report: parseOpportunityReport(item.report), saved: loadSavedOpportunities(item.saved),
      days: [7, 30, 90].includes(item.days) ? item.days : 90, sample: item.sample === true,
      workflow: item.workflow === 'decision' ? 'decision' as const : item.workflow === 'apps' ? 'apps' as const : undefined, decision: item.decision ? loadDecision(item.decision) : undefined,
      decisionPlans: loadDecisionPlans(item.decisionPlans),
      analysisApp: item.analysisApp && typeof item.analysisApp.name === 'string' && typeof item.analysisApp.id === 'string' &&
        storeAppKey(item.analysisApp.url) && Array.isArray(item.analysisApp.reviews) && item.analysisApp.reviews.every(review => review && typeof review.text === 'string')
        ? item.analysisApp : undefined,
      roles: Object.fromEntries(Object.entries(item.roles || {}).filter(([, role]) => role === 'my-app' || role === 'competitor')) as ResearchProject['roles'],
    }));
    if (projects.length) return { projects, activeId: projects.some(item => item.id === stored.activeId) ? stored.activeId : projects[0].id };
  }
  const project = newResearchProject();
  const scope = read(SCOPE_STORAGE);
  project.scope = scope ? loadResearchScope(scope, []) : project.scope;
  project.research = normalizeResearchContext(read('insightly_market_research_v1'));
  project.report = parseOpportunityReport(read(OPPORTUNITY_STORAGE));
  project.sample = apps.length > 0 && apps.every(app => app.sample);
  project.days = project.report?.days || 90;
  project.roles = Object.fromEntries(apps.map(app => [storeAppKey(app.url), app.role]));
  const saved = loadSavedOpportunities(read(SAVED_OPPORTUNITY_STORAGE));
  const keys = new Set(project.scope.apps.map(app => app.key));
  const belongs = (item: SavedOpportunity) => item.report.evidence.length > 0 && item.report.evidence.every(ref => keys.has(storeAppKey(ref.appUrl)));
  project.saved = saved.filter(belongs);
  const other = saved.filter(item => !belongs(item));
  const projects = [project];
  if (other.length) projects.push({ ...newResearchProject(), scope: { ...project.scope, query: '', title: 'Previous saved directions', apps: [] }, saved: other });
  return { activeId: project.id, projects };
}
