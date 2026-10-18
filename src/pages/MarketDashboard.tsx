import { useEffect, useRef, useState } from 'react';
import { Bell, Download, Loader2, Plus, RefreshCw, Square, Trash2 } from 'lucide-react';
import VoicelyShell, { type WorkspaceView } from '../components/VoicelyShell';
import LabWorkspace, { LabDialog } from '../components/LabWorkspace';
import MonitorSignals from '../components/MonitorSignals';
import AnalyzeAppDialog from '../components/AnalyzeAppDialog';
import DecisionBoard from '../components/DecisionBoard';
import SavedDecisionBrief from '../components/SavedDecisionBrief';
import { opportunityMarkdown, type SavedOpportunity } from '../utils/marketOpportunities';
import { decisionPlanMarkdown } from '../utils/decisionResearch';
import { downloadFile } from '../utils/download';
import { useAuth } from '../components/AuthContext';
import { SERVER_URL } from '../components/Constants';
import { analyzeApplication, analysisId, marketRequest } from '../utils/appAnalysis';
import { parseResearchApp, storeAppKey, type ResearchApp } from '../utils/marketResearchFlow';
import { loadResearchProjects, newResearchProject, PROJECTS_STORAGE, type ResearchProject, type ResearchProjects } from '../utils/researchProjects';
import type { WatchApp } from '../utils/marketIntelligence';

const WATCH_STORAGE = 'insightly_market_watchlist_v1';
const MONITOR_STORAGE = 'voicely_monitored_apps_v1';
const THRESHOLD_STORAGE = 'voicely_monitor_threshold_v1';
function readThreshold() { try { const value = Number(localStorage.getItem(THRESHOLD_STORAGE)); return [15, 25, 50].includes(value) ? value : 25; } catch { return 25; } }
function readApps(): WatchApp[] {
  try { const value = JSON.parse(localStorage.getItem(WATCH_STORAGE) || '[]'); return Array.isArray(value) ? value.filter(app => app && !app.sample && typeof app.name === 'string' && storeAppKey(app.url) && Array.isArray(app.reviews)) : []; }
  catch { return []; }
}
function readMonitors(): string[] {
  try { const value = JSON.parse(localStorage.getItem(MONITOR_STORAGE) || '[]'); return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string'))] : []; }
  catch { return []; }
}
const titles: Record<WorkspaceView, string> = { next: 'From reviews to your next move.', reviews: 'Review explorer', opportunities: 'Find your next opportunity.', compare: 'Compare apps', board: 'Your decision board', sources: 'Watchlist', plans: 'Plans & usage' };
const routes: Record<WorkspaceView, string> = { next: 'overview', reviews: 'reviews', opportunities: 'opportunities', compare: 'compare', board: 'board', sources: 'watchlist', plans: 'plans' };
const readView = (): WorkspaceView => (Object.keys(routes) as WorkspaceView[]).find(key => routes[key] === window.location.hash.slice(1)) || 'next';

export default function MarketDashboard() {
  const { token } = useAuth();
  const [apps, setApps] = useState(readApps), appsRef = useRef(apps);
  const [projects, setProjects] = useState(() => loadResearchProjects(localStorage, apps)), projectsRef = useRef(projects);
  const [view, setCurrentView] = useState<WorkspaceView>(readView), [chooser, setChooser] = useState(false);
  const setView = (next: WorkspaceView) => {
    if (window.location.hash !== `#${routes[next]}`) window.history.pushState(null, '', `#${routes[next]}`);
    setCurrentView(next);
  };
  useEffect(() => {
    const restore = () => { setCurrentView(readView()); setChooser(false); };
    window.addEventListener('popstate', restore);
    window.addEventListener('hashchange', restore);
    return () => { window.removeEventListener('popstate', restore); window.removeEventListener('hashchange', restore); };
  }, []);
  const [suggestedApp, setSuggestedApp] = useState<ResearchApp | null>(null);
  const [savedBrief, setSavedBrief] = useState<SavedOpportunity | null>(null);
  const [comparisonPicker, setComparisonPicker] = useState(false);
  const [monitors, setMonitors] = useState(readMonitors);
  const [threshold, setThreshold] = useState(readThreshold), [draftThreshold, setDraftThreshold] = useState(readThreshold);
  const [monitorSetup, setMonitorSetup] = useState<string | null>(null);
  const [progress, setProgress] = useState(''), [error, setError] = useState(''), [storageError, setStorageError] = useState('');
  const [running, setRunning] = useState(false), [retry, setRetry] = useState<{ app: ResearchApp; days: number; compare: boolean } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const [related, setRelated] = useState<ResearchApp[]>([]), [relatedStatus, setRelatedStatus] = useState('');
  const [relatedRetry, setRelatedRetry] = useState(0);
  const [comparisonUrl, setComparisonUrl] = useState('');
  const completed = projects.projects.filter(project => project.id.startsWith('analysis:') && project.report && project.analysisApp);
  const selected = completed.find(project => project.id === projects.activeId) || null;
  const empty = useRef(newResearchProject()).current;
  const project = selected || empty;
  const primary = selected?.scope.apps[0];
  const persist = (key: string, value: unknown) => {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { setStorageError('Browser storage is full or unavailable. Keep this page open; changes are not saved.'); }
  };
  const saveProjects = (next: ResearchProjects) => { projectsRef.current = next; setProjects(next); persist(PROJECTS_STORAGE, next); };
  const patch = (id: string, changes: Partial<ResearchProject>) => saveProjects({ ...projectsRef.current, projects: projectsRef.current.projects.map(item => item.id === id ? { ...item, ...changes } : item) });
  const retain = (app: WatchApp) => {
    const next = [...appsRef.current.filter(item => storeAppKey(item.url) !== storeAppKey(app.url)), app];
    appsRef.current = next; setApps(next); persist(WATCH_STORAGE, next);
  };
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    setRelated([]); setRelatedStatus('');
    if (view !== 'compare' || !primary) return;
    const abort = new AbortController(); setRelatedStatus('Finding related apps...');
    marketRequest(SERVER_URL, '/api/market/discover', token, abort.signal, { query: primary.appUrl, country: primary.key.split(':')[1] }).then(data => {
      if (!Array.isArray(data.apps)) throw new Error('Related-app search returned invalid results.');
      if (!abort.signal.aborted) {
        const matches = data.apps.map(parseResearchApp).filter((app: ResearchApp | null): app is ResearchApp => !!app && app.key !== primary.key);
        setRelated(matches); setRelatedStatus(data.partial ? 'Some stores are unavailable. Available suggestions are below.' : matches.length ? '' : 'No related apps found. You can choose one by name or store link.');
      }
    }).catch(e => { if (!abort.signal.aborted) setRelatedStatus(e.message || 'Related-app search unavailable.'); });
    return () => abort.abort();
  }, [view, primary, token, relatedRetry]);

  const run = async (app: ResearchApp, days = 90, compare = false, force = false) => {
    if (controller.current) return;
    setChooser(false); setError(''); setRetry(null);
    const previous = projectsRef.current.projects.find(item => item.id === analysisId(app));
    if (!force && previous?.report && previous.days === days && previous.analysisApp) {
      if (compare) setComparisonUrl(app.appUrl);
      if (!compare) { saveProjects({ ...projectsRef.current, activeId: previous.id }); setView('next'); }
      return;
    }
    const abort = new AbortController(); controller.current = abort; setRunning(true);
    try {
      const result = await analyzeApplication({ app, days, previous, savedApps: appsRef.current, server: SERVER_URL, token, signal: abort.signal, progress: setProgress, retain });
      const state = projectsRef.current;
      saveProjects({ activeId: compare && selected ? state.activeId : result.id, projects: [...state.projects.filter(item => item.id !== result.id), result] });
      if (compare) setComparisonUrl(app.appUrl);
      setView(compare ? 'compare' : force ? view : 'next');
    } catch (e) {
      setError(abort.signal.aborted ? 'Analysis stopped. Completed collection is saved; the last completed analysis is unchanged.' : e instanceof Error ? e.message : 'Analysis failed.');
      setRetry({ app, days, compare });
    } finally { controller.current = null; setRunning(false); setProgress(''); }
  };
  const navigate = (next: WorkspaceView) => { setView(next); setError(''); };
  const openChooser = () => { if (!controller.current) { setSuggestedApp(null); setComparisonPicker(false); setChooser(true); } };
  const openComparison = () => { if (!controller.current) { setSuggestedApp(null); setComparisonPicker(true); setChooser(true); } };
  const recent = [...new Map(apps.map(app => {
    const parsed = parseResearchApp({ title: app.name, appUrl: app.url, icon: app.icon, developer: app.developer });
    return [parsed?.key, parsed] as const;
  }).filter((entry): entry is [string, ResearchApp] => !!entry[0] && !!entry[1])).values()];
  const saveMonitor = (id: string) => { const next = [...new Set([...monitors, id])]; setMonitors(next); persist(MONITOR_STORAGE, next); setView('sources'); };
  const savedCount = projects.projects.reduce((sum, item) => sum + item.saved.length + (item.decisionPlans?.length || 0), 0);

  return <VoicelyShell view={view} onNavigate={navigate} onAnalyze={openChooser} busy={running} savedCount={savedCount}>
    <main id="voicely-main" className="voicely-main">
      <div className="flex flex-wrap items-center justify-between gap-4"><h1>{titles[view]}</h1><div className="flex flex-wrap gap-2">
        {primary && view === 'next' && <button disabled={running} className="voicely-button" onClick={() => { if (monitors.includes(project.id)) navigate('sources'); else { setDraftThreshold(threshold); setMonitorSetup(project.id); } }}><Bell />{monitors.includes(project.id) ? 'View monitor' : 'Set up monitor'}</button>}
        {primary && view === 'next' && <button disabled={running} className="voicely-button" aria-label="Refresh analysis" title="Refresh analysis" onClick={() => void run(primary, project.days, false, true)}><RefreshCw /></button>}
        <button disabled={running} className="voicely-button primary" onClick={openChooser}><Plus />Analyze an app</button>
      </div></div>
      {storageError && <p role="alert" className="lab-notice text-red-700">{storageError}</p>}
      {running && <section className="lab-notice" aria-live="polite"><div className="flex items-center justify-between gap-3"><p role="status" className="flex items-center gap-2"><Loader2 className="animate-spin shrink-0" />{progress}</p><button className="voicely-button" onClick={() => controller.current?.abort()}><Square />Stop analysis</button></div></section>}
      {error && <div className="lab-notice"><p role="alert" className="text-red-700">{error}</p>{retry && <button className="voicely-button mt-3" onClick={() => void run(retry.app, retry.days, retry.compare, true)}><RefreshCw />Retry analysis</button>}</div>}
      {view === 'plans' && <section className="voicely-metrics" aria-label="Local workspace usage"><div><strong>{completed.length}</strong><small>Completed app analyses</small></div><div><strong>{savedCount}</strong><small>Saved decisions</small></div><div><strong>{monitors.length}</strong><small>Manually watched apps</small></div><div><strong>{apps.reduce((sum, app) => sum + app.reviews.length, 0)}</strong><small>Stored review records on this device</small></div></section>}
      {['next','reviews','opportunities','compare','plans'].includes(view) && <LabWorkspace key={project.id} view={view} project={project} apps={selected?.analysisApp ? [selected.analysisApp] : []}
        comparisonApps={completed.filter(item => item.id !== project.id && item.days === project.days).map(item => item.analysisApp!)}
        comparisonUrl={comparisonUrl}
        onDaysChange={days => { if (primary) void run(primary, days, false, true); }}
        onChange={changes => patch(project.id, changes)} onAnalyze={openChooser} onCompare={openComparison} onNavigate={navigate} busy={running} />}
      {view === 'compare' && <section className="lab-signals"><div className="voicely-toolbar"><h2 className="voicely-panel-title">Related apps</h2><button className="voicely-button" disabled={running} onClick={openComparison}><Plus />Choose another app</button></div>
        {relatedStatus && <p role="status" className="voicely-muted">{relatedStatus}</p>}
        {primary && <button className="voicely-button mt-3" disabled={running || relatedStatus === 'Finding related apps...'} onClick={() => setRelatedRetry(value => value + 1)} title="Refresh suggestions" aria-label="Refresh suggestions"><RefreshCw /></button>}
        <div className="divide-y">{related.map(app => <div key={app.key} className="flex gap-3 py-4 items-center">{app.icon && <img src={app.icon} alt="" className="w-10 h-10 rounded" />}<div className="flex-1 min-w-0"><h3 className="font-medium">{app.title}</h3><p className="voicely-muted">{app.reason}</p></div><button disabled={running} className="voicely-button" onClick={() => { setSuggestedApp(app); setComparisonPicker(true); setChooser(true); }}>Analyze for comparison</button></div>)}</div>
      </section>}
      {view === 'board' && <><div className="voicely-toolbar"><p>{savedCount} saved decisions across all apps</p><button disabled={!savedCount} className="voicely-button" onClick={() => downloadFile('voicely-all-decisions.md', projects.projects.flatMap(item => [...item.saved.map(opportunityMarkdown), ...(item.decisionPlans || []).map(decisionPlanMarkdown)]).join('\n\n---\n\n'), 'text/markdown;charset=utf-8')}><Download />Export all decisions</button></div>{!savedCount && <div className="voicely-empty"><p>No decisions saved yet.</p><button className="voicely-button mt-4" onClick={() => primary ? navigate('opportunities') : openChooser()}>Find an opportunity</button></div>}{projects.projects.filter(item => item.saved.length || item.decisionPlans?.length).map(item => <section key={item.id}><h2 className="voicely-panel-title">{item.scope.title}</h2><DecisionBoard compact busy={running} plans={item.decisionPlans || []} onChange={decisionPlans => patch(item.id, { decisionPlans })} legacy={item.saved} onLegacyChange={saved => patch(item.id, { saved })} onRevisit={setSavedBrief} /></section>)}</>}
      {view === 'sources' && <section><p className="lab-notice">Manual monitoring · saved in this browser · automatic refresh and email delivery are not scheduled.</p>
        <div className="voicely-toolbar"><span>Review threshold: +{threshold} percentage points in theme sample share</span><button className="voicely-button" onClick={() => { setDraftThreshold(threshold); setMonitorSetup('settings'); }}>Monitor settings</button></div>
        {!monitors.length && <div className="voicely-empty"><p>No monitored apps yet.</p>{primary ? <button className="voicely-button mt-4" onClick={() => { setDraftThreshold(threshold); setMonitorSetup(project.id); }}><Bell />Monitor {primary.title}</button> : <button className="voicely-button mt-4" onClick={openChooser}>Choose an app</button>}</div>}
        {monitors.map(id => projects.projects.find(item => item.id === id)).filter((item): item is ResearchProject => !!item).map(item => <article key={item.id} className="voicely-review"><div className="voicely-toolbar"><div><h2 className="font-semibold">{item.scope.title}</h2><p className="voicely-muted">Last completed analysis: {item.report ? new Date(item.report.generatedAt).toLocaleString() : 'None'} · last {item.days} days</p></div><div className="flex gap-2"><button disabled={running} className="voicely-button" onClick={() => { saveProjects({ ...projectsRef.current, activeId: item.id }); setView('next'); }}>View analysis</button><button disabled={running} className="voicely-button" title={`Refresh ${item.scope.title}`} aria-label={`Refresh ${item.scope.title}`} onClick={() => void run(item.scope.apps[0], item.days, false, true)}><RefreshCw /></button><button disabled={running} className="voicely-button" title="Stop monitoring" aria-label={`Stop monitoring ${item.scope.title}`} onClick={() => { const next = monitors.filter(value => value !== item.id); setMonitors(next); persist(MONITOR_STORAGE, next); }}><Trash2 /></button></div></div>{item.analysisApp && <MonitorSignals app={item.analysisApp} threshold={threshold} />}</article>)}
      </section>}
      {chooser && <AnalyzeAppDialog token={token} recent={recent} initialApp={suggestedApp} initialDays={project.days} onClose={() => setChooser(false)} onSelect={(app, days) => void run(app, days, comparisonPicker && !!primary)} />}
      {savedBrief && <SavedDecisionBrief item={savedBrief} onClose={() => setSavedBrief(null)} />}
      {monitorSetup && <LabDialog title={monitorSetup === 'settings' ? 'Monitor settings' : 'Set up monitor'} onClose={() => setMonitorSetup(null)}><p className="lab-notice">Manual refresh only. Weekly previews use saved reviews; no background collection or email is scheduled.</p><label className="block">Theme sample-share increase<select className="block border rounded p-3 mt-2" value={draftThreshold} onChange={event => setDraftThreshold(Number(event.target.value))}>{[15,25,50].map(value => <option key={value} value={value}>+{value} percentage points</option>)}</select></label><p className="voicely-muted mt-4">Applies to all watched apps. Changes are withheld when collection or classification is insufficient for comparison.</p><div className="voicely-toolbar"><button className="voicely-button" onClick={() => setMonitorSetup(null)}>Cancel</button><button className="voicely-button primary" onClick={() => { setThreshold(draftThreshold); persist(THRESHOLD_STORAGE, draftThreshold); if (monitorSetup !== 'settings') saveMonitor(monitorSetup); setMonitorSetup(null); }}>Save monitor</button></div></LabDialog>}
    </main>
  </VoicelyShell>;
}
