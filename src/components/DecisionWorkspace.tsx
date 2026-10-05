import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, Search, Square, X } from 'lucide-react';
import { DECISION_VERSION, parseDecisionBrief, type DecisionBrief } from '../../shared/decisionContract.js';
import { decisionInputKey, emptyDecision, parseDecisionReport } from '../utils/decisionResearch';
import { getReviewAnalysis, type WatchApp } from '../utils/marketIntelligence';
import { parseResearchApp, storeAppKey, type ResearchApp } from '../utils/marketResearchFlow';
import { selectOpportunityEvidence, type OpportunityEvidence } from '../utils/marketOpportunities';
import type { ResearchProject } from '../utils/researchProjects';
import type { ClassifierProfile } from './MarketModelControls';
import ResearchStart from './ResearchStart';
import { SERVER_URL } from './Constants';

interface Props {
  project: ResearchProject; apps: WatchApp[]; onChange: (patch: Partial<ResearchProject>) => void;
  profile: ClassifierProfile | null; checking: boolean; token: string | null; busy: boolean;
  onBusyChange: (busy: boolean) => void; onOpenSources: () => void;
  onPrepare: (apps: ResearchApp[], days: number, progress: (text: string) => void, signal: AbortSignal) => Promise<{ apps: WatchApp[]; warnings: string[] }>;
}

function Citations({ keys, evidence }: { keys: string[]; evidence: OpportunityEvidence[] }) {
  if (!keys.length) return null;
  return <details className="mt-3 text-sm"><summary className="text-teal-800 cursor-pointer">Original evidence ({keys.length})</summary>
    <div className="mt-3 space-y-4">{evidence.filter(ref => keys.includes(ref.key)).map(ref => <blockquote key={ref.key} className="pl-3 border-l-2 border-gray-300">
      <p className="text-xs text-gray-500">{ref.appName} · {ref.country.toUpperCase()} · {ref.date ? new Date(ref.date).toLocaleDateString() : 'Undated'}{ref.partial ? ' · limited sample' : ''}</p>
      <p className="mt-1 whitespace-pre-wrap break-words">{ref.quote}</p>
      {!!storeAppKey(ref.appUrl) && <a href={ref.appUrl} target="_blank" rel="noreferrer" className="inline-block mt-1 text-xs text-teal-800">Store listing</a>}
    </blockquote>)}</div>
  </details>;
}

export default function DecisionWorkspace({ project, apps, onChange, profile, checking, token, busy, onBusyChange, onPrepare, onOpenSources }: Props) {
  const state = project.decision || emptyDecision(), brief = state.brief, report = state.report;
  const [editing, setEditing] = useState(!report);
  const [editSources, setEditSources] = useState(false);
  const [sourceDirty, setSourceDirty] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const available = !!profile?.configured && !checking;
  const validBrief = parseDecisionBrief(brief);
  const briefCurrent = !!validBrief && state.input.trim() === state.briefInput;
  const context = { mode: 'improve' as const, product: '', question: brief?.decision || '', focusTopic: 'all' };
  const evidenceFor = (items: WatchApp[]) => selectOpportunityEvidence(items.filter(app => !app.sample).map(app => ({ ...app,
    reviews: app.reviews.filter(review => getReviewAnalysis(review)?.model === profile?.model) })), context, project.days, new Date(), true);
  const appKeys = project.scope.apps.map(app => app.key);
  const currentEvidence = evidenceFor(apps.filter(app => appKeys.includes(storeAppKey(app.url))));
  const stale = !!report && (!briefCurrent || !brief || report.inputKey !== decisionInputKey(state.input.trim(), brief, project.days, appKeys, currentEvidence, profile?.model || ''));
  const updateBrief = (patch: Partial<DecisionBrief>) => { if (brief) onChange({ decision: { ...state, brief: { ...brief, ...patch } } }); };
  const post = async (endpoint: string, body: unknown, signal: AbortSignal) => {
    const response = await fetch(`${SERVER_URL}/api/market/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.any([signal, AbortSignal.timeout(endpoint === 'decision/report' ? 200000 : 100000)]) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Research service unavailable.');
    return data;
  };
  const run = async (operation: (signal: AbortSignal) => Promise<void>) => {
    if (busy || controller.current || !available) return;
    const abort = new AbortController(); controller.current = abort;
    onBusyChange(true); setError(''); setWarnings([]);
    try { await operation(abort.signal); }
    catch (error) { setError(abort.signal.aborted ? 'Stopped. Completed collection is saved; an already-running model request may still incur usage.' : `${error instanceof Error ? error.message : 'Research failed.'} Previous results are retained.`); setProgress(''); }
    finally { controller.current = null; onBusyChange(false); }
  };
  const understand = () => run(async signal => {
    setProgress('Understanding your decision...');
    const data = await post('decision/brief', { input: state.input }, signal);
    const next = parseDecisionBrief(data.brief);
    if (!next || data.version !== DECISION_VERSION || data.provider !== 'gemini' || data.model !== profile?.model) throw new Error('The research brief was invalid.');
    onChange({ workflow: 'decision', decision: { ...state, brief: next, briefInput: state.input.trim() },
      scope: { ...project.scope, title: next.title, query: next.searchQuery, apps: [] }, research: { ...context, question: next.decision } });
    setProgress(''); setEditing(true); setEditSources(false);
  });
  const discover = () => run(async signal => {
    if (!validBrief || !briefCurrent) return;
    setProgress('Finding relevant evidence sources...');
    const data = await post('discover', { query: validBrief.searchQuery, country: project.scope.country }, signal);
    if (!Array.isArray(data.apps)) throw new Error('Source discovery returned an invalid response.');
    const selected = data.apps.map(parseResearchApp).filter((app: ResearchApp | null): app is ResearchApp => !!app);
    if (!selected.length) throw new Error('No relevant store apps were found. Adjust the search phrase or add sources manually.');
    onChange({ scope: { ...project.scope, title: validBrief.title, query: validBrief.searchQuery, apps: selected.slice(0, 5) } });
    if (data.partial) setWarnings(['Some store searches failed. The source selection may be incomplete.']);
    setProgress('');
  });
  const research = () => run(async signal => {
    if (!validBrief || !briefCurrent || !appKeys.length || (editSources && sourceDirty)) return;
    const prepared = await onPrepare(project.scope.apps, project.days, setProgress, signal);
    setWarnings(prepared.warnings); signal.throwIfAborted();
    const evidence = evidenceFor(prepared.apps);
    if (!evidence.length) throw new Error('No usable classified review evidence was found in this period. The decision cannot be judged from these sources. Try other sources or a longer period.');
    const inputKey = decisionInputKey(state.input.trim(), validBrief, project.days, appKeys, evidence, profile!.model);
    if (report?.inputKey === inputKey) { setEditing(false); setProgress('Research is up to date.'); return; }
    setProgress('Weighing evidence for your decision...');
    const data = await post('decision/report', { marketId: project.id, input: state.input, brief: validBrief, days: project.days, evidence }, signal);
    const next = parseDecisionReport({ ...data, inputKey, input: state.input.trim(), brief: validBrief, days: project.days, appKeys, evidence, result: data.report });
    if (!next || data.provider !== 'gemini' || data.model !== profile?.model) throw new Error('Research returned invalid evidence references.');
    onChange({ decision: { ...state, report: next }, research: { ...context, question: validBrief.decision } });
    setEditing(false); setProgress('Research complete.');
  });

  return <section className="mt-6 min-w-0">
    {report && <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><h2 className="text-lg font-semibold">Decision research</h2><button disabled={busy} onClick={() => setEditing(value => !value)} className="text-sm text-teal-800">{editing ? 'Back to result' : 'Edit research'}</button></div>}
    {editing && <>
      <label className="block text-lg font-semibold" htmlFor="decision-input">What are you considering?</label>
      <textarea id="decision-input" value={state.input} disabled={busy} maxLength={4000} rows={5} onChange={event => onChange({ workflow: 'decision', decision: { ...state, input: event.target.value } })}
        placeholder="My product is not growing. I am considering focusing on one job instead of offering everything..." className="block mt-3 w-full resize-y rounded border border-gray-300 p-3 text-base font-normal focus:ring-2 focus:ring-teal-600" />
      <button disabled={busy || !available || state.input.trim().length < 10} onClick={understand} className="mt-3 inline-flex items-center gap-2 bg-teal-700 text-white rounded px-4 py-2 text-sm disabled:opacity-40"><ArrowRight className="w-4 h-4" />{brief ? 'Update understanding' : 'Shape my research'}</button>
      {brief && <section className="mt-6 py-5 border-y border-gray-200">
        <h2 className="text-lg font-semibold">Is this the decision?</h2>
        <p className="text-xs text-gray-500 mt-2">Your situation · self-reported</p><p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">{brief.situation}</p>
        <label className="block text-sm font-medium mt-4">Research question<textarea aria-label="Decision to investigate" disabled={busy} rows={3} maxLength={400} value={brief.decision} onChange={event => updateBrief({ decision: event.target.value })} className="block w-full border border-gray-300 rounded mt-2 p-3 font-normal" /></label>
        <h3 className="text-sm font-medium mt-4">Assumptions to test</h3><ul className="mt-2 list-disc pl-5 space-y-2 text-sm text-gray-700">{brief.assumptions.map((item, i) => <li key={i} className="break-words">{item}</li>)}</ul>
        <details className="mt-4 text-sm"><summary className="text-teal-800 cursor-pointer">Correct context and assumptions</summary>
          <label className="block mt-3">Situation<textarea aria-label="Research situation" disabled={busy} rows={3} maxLength={800} value={brief.situation} onChange={event => updateBrief({ situation: event.target.value })} className="block w-full border rounded p-2 mt-1" /></label>
          {brief.assumptions.map((item, i) => <label key={i} className="block mt-3">Assumption {i + 1}<textarea disabled={busy} maxLength={300} value={item} onChange={event => updateBrief({ assumptions: brief.assumptions.map((text, index) => index === i ? event.target.value : text) })} className="block w-full border rounded p-2 mt-1" /></label>)}
        </details>
        <h3 className="text-sm font-medium mt-4">Outside what reviews can establish</h3><ul className="mt-2 list-disc pl-5 space-y-2 text-sm text-gray-600">{brief.limits.map((item, i) => <li key={i} className="break-words">{item}</li>)}</ul>
        {!briefCurrent && <p role="status" className="text-sm text-amber-800 mt-3">Your input or understanding has changed. Complete the fields or update understanding before researching.</p>}
        <div className="mt-4 flex flex-wrap gap-3 items-center"><button disabled={busy || !available || !briefCurrent} onClick={discover} className="inline-flex gap-2 items-center rounded border border-teal-700 px-3 py-2 text-sm text-teal-800 disabled:opacity-40"><Search className="w-4 h-4" />{project.scope.apps.length ? 'Find other sources' : 'Confirm & find sources'}</button>
          <button disabled={busy} onClick={() => setEditSources(value => !value)} className="text-sm text-teal-800">{editSources ? 'Close source editor' : 'Choose sources manually'}</button></div>
        <details className="mt-3 text-sm"><summary className="cursor-pointer text-gray-600">Search &amp; review period</summary>
          <label className="block mt-3">Source search<input aria-label="Decision source search" disabled={busy} maxLength={400} value={brief.searchQuery} onChange={event => updateBrief({ searchQuery: event.target.value })} className="block border rounded w-full mt-1 p-2" /></label>
          <div className="flex flex-wrap gap-4 mt-3"><label>Region<select aria-label="Decision region" disabled={busy} value={project.scope.country} onChange={event => onChange({ scope: { ...project.scope, country: event.target.value, apps: [] } })} className="border rounded ml-2 p-2">{[...new Set([project.scope.country, 'us', 'gb', 'ca', 'au', 'de', 'fr', 'jp', 'cn'])].map(code => <option key={code} value={code}>{code.toUpperCase()}</option>)}</select></label>
          <label>Review period<select aria-label="Decision review period" disabled={busy} value={project.days} onChange={event => onChange({ days: Number(event.target.value) })} className="border rounded ml-2 p-2"><option value={90}>90 days</option><option value={30}>30 days</option><option value={7}>7 days</option></select></label></div>
        </details>
      </section>}
      {brief && editSources && <ResearchStart key={project.scope.query + project.scope.country} scope={project.scope} apps={apps} onChange={scope => onChange({ scope: { ...scope, title: brief.title } })} busy={busy} available={available} token={token} onBusyChange={onBusyChange} onDirty={setSourceDirty} />}
      {brief && !editSources && project.scope.apps.length > 0 && <section className="py-5"><h3 className="font-medium text-sm">Selected evidence sources</h3><ul className="divide-y divide-gray-200 mt-2">{project.scope.apps.map(app => <li key={app.key} className="py-3 flex gap-3 items-center">
        {app.icon && <img src={app.icon} alt="" className="w-9 h-9 rounded object-cover shrink-0" />}<div className="min-w-0 flex-1"><p className="text-sm font-medium break-words">{app.title}</p><p className="text-xs text-gray-500 break-words">{app.reason}</p></div>
        <button title={`Remove ${app.title} from research`} aria-label={`Remove ${app.title} from research`} disabled={busy} onClick={() => onChange({ scope: { ...project.scope, apps: project.scope.apps.filter(item => item.key !== app.key) } })} className="p-2"><X className="w-4 h-4" /></button>
      </li>)}</ul></section>}
      {brief && <button disabled={busy || !available || !briefCurrent || !appKeys.length || (editSources && sourceDirty)} onClick={research} className="inline-flex gap-2 items-center px-4 py-3 rounded bg-teal-700 text-white text-sm disabled:opacity-40"><ArrowRight className="w-4 h-4" />Research this decision</button>}
    </>}
    {!available && <p role="status" className="mt-4 text-sm text-amber-800">{checking ? 'Checking research service...' : profile?.message || 'Research service unavailable. Check the model connection in Sources.'}</p>}
    <div role="status" className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">{controller.current && <Loader2 className="w-4 h-4 animate-spin" />}{progress}{controller.current && <button onClick={() => controller.current?.abort()} className="inline-flex items-center gap-2"><Square className="w-4 h-4" />Stop</button>}</div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700 break-words">{error}</p>}
    {!!warnings.length && <ul role="status" className="mt-3 text-sm text-amber-800 list-disc pl-5">{warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
    {report && <article className="mt-6 border-t border-gray-200 pt-5">
      {stale && <p role="status" className="text-sm text-amber-800 mb-4">Previous result. The question, sources, feedback or model has changed.</p>}
      <p className="text-xs text-gray-500">{report.result.position === 'insufficient' ? 'Insufficient evidence to decide' : 'Conditional interpretation · not a validated strategy'}</p>
      <h2 className="mt-2 text-xl font-semibold break-words">{report.brief.decision}</h2>
      <p className="mt-4 text-gray-800 whitespace-pre-wrap break-words">{report.result.conclusion}</p><Citations keys={report.result.conclusionKeys} evidence={report.evidence} />
      <div className="grid md:grid-cols-2 gap-6 mt-6">{(['supports', 'counters'] as const).map(side => <section key={side}><h3 className="font-semibold">{side === 'supports' ? 'Evidence supporting the hypothesis' : 'Evidence challenging the hypothesis'}</h3>
        {!report.result[side].length && <p className="text-sm text-gray-500 mt-3">No direct evidence identified in these excerpts. This is not proof of absence.</p>}
        {report.result[side].map((claim, i) => <div key={i} className="mt-4 text-sm"><p className="break-words">{claim.text}</p><Citations keys={claim.evidenceKeys} evidence={report.evidence} /></div>)}
      </section>)}</div>
      <section className="mt-6 border-t border-gray-200 pt-5"><h3 className="font-semibold">What remains unknown</h3><ul className="mt-3 list-disc pl-5 space-y-2 text-sm">{report.result.unknowns.map((item, i) => <li key={i} className="break-words">{item}</li>)}</ul></section>
      <section className="mt-6 border-l-2 border-teal-700 pl-4"><h3 className="font-semibold">Next validation</h3><p className="mt-2 text-sm break-words">{report.result.nextStep.action}</p><dl className="mt-4 grid md:grid-cols-2 gap-4 text-sm"><div><dt className="font-medium">Finding that would support it</dt><dd className="mt-1 break-words">{report.result.nextStep.success}</dd></div><div><dt className="font-medium">Finding that would change the decision</dt><dd className="mt-1 break-words">{report.result.nextStep.changeMind}</dd></div></dl></section>
      <p className="mt-6 text-xs text-gray-500">{new Set(report.evidence.map(item => item.reviewKey)).size} reviews considered · {report.appKeys.length} selected apps · last {report.days} days · public review sample, not market validation</p>
      <details className="mt-3 text-xs text-gray-500"><summary className="cursor-pointer">Scope &amp; usage</summary><p className="mt-2">{report.evidence.some(item => item.partial || item.source !== 'review-feed') ? 'Limited or unverified samples included. ' : ''}Only classified excerpts were considered. Growth analytics, interviews and brand effects were not checked.</p><p className="mt-2">{report.model} · synthesis and evidence-check tokens: {report.usage?.totalTokenCount ?? 'unavailable'}. Understanding, discovery and classification are additional.</p></details>
      <button onClick={onOpenSources} className="mt-4 text-sm text-teal-800">Review collected sources</button>
    </article>}
  </section>;
}
