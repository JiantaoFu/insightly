import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Bookmark, BookmarkCheck, Download, FlaskConical, Loader2, Square, Trash2 } from 'lucide-react';
import { SERVER_URL } from './Constants';
import ResearchStart from './ResearchStart';
import type { ClassifierProfile } from './MarketModelControls';
import { getReviewAnalysis, type ResearchContext, type WatchApp } from '../utils/marketIntelligence';
import { storeAppKey, type ResearchApp, type ResearchScope } from '../utils/marketResearchFlow';
import { illustrativeOpportunityReport, OPPORTUNITY_VERSION, opportunityInputKey, opportunityMarkdown, opportunityRequest, parseOpportunityReport, saveOpportunitySnapshot, selectOpportunityEvidence, type Opportunity, type OpportunityReport, type SavedOpportunity } from '../utils/marketOpportunities';
import type { ResearchProject } from '../utils/researchProjects';
import { downloadFile } from '../utils/download';


const OpportunityRow = ({ opportunity: op, report, saved, previouslySaved, onSave, onStage, onRemove }: {
  opportunity: Opportunity; report: OpportunityReport; saved?: SavedOpportunity; onSave?: () => void;
  previouslySaved?: boolean; onStage?: (stage: SavedOpportunity['stage']) => void; onRemove?: () => void;
}) => {
  const evidence = report.evidence.filter(ref => op.evidenceKeys.includes(ref.key));
  const apps = [...new Set(evidence.map(ref => ref.appName))];
  return <article className="py-6 border-b border-gray-200 last:border-b-0">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><p className="text-xs text-teal-800 mb-2">{report.sample ? 'Illustrative problem' : 'Problem to investigate'}</p><h3 className="text-lg font-semibold text-gray-950 break-words">{op.title}</h3></div>
      {onSave && <button onClick={onSave} disabled={!!saved} className="inline-flex shrink-0 items-center gap-2 text-sm text-teal-800 disabled:text-gray-500">{saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}{saved ? 'Saved' : previouslySaved ? 'Update saved' : 'Save direction'}</button>}
    </div>
    <p className="mt-2 text-xs text-gray-500 break-words">{new Set(evidence.map(ref => ref.reviewKey)).size} reviews cited · {apps.join(', ')}</p>
    <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 mt-5 text-sm">
      <div><h4 className="font-medium text-gray-900">User scenario <span className="font-normal text-xs text-gray-500">· inferred</span></h4><p className="mt-1 text-gray-700 whitespace-pre-wrap break-words">{op.scenario}</p></div>
      <div><h4 className="font-medium text-gray-900">What gets in the way</h4><p className="mt-1 text-gray-700 break-words">{op.obstacle}</p></div>
    </div>
    {evidence[0] && <blockquote className="mt-4 border-l-2 border-gray-300 pl-3 text-sm text-gray-600"><p className="line-clamp-3 break-words">{evidence[0].quote}</p><p className="mt-1 text-xs text-gray-500">{evidence[0].appName}{evidence[0].partial ? ' · limited store sample' : ''}</p></blockquote>}
    <div className="mt-4 border-l-2 border-teal-600 pl-3 text-sm"><h4 className="font-medium flex gap-2 items-center text-teal-900"><FlaskConical className="w-4 h-4 shrink-0" />Next validation</h4><p className="mt-2 break-words">{op.nextExperiment}</p></div>
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-teal-800">Evidence &amp; validation details</summary>
      <div className="mt-4"><h4 className="font-medium">Why investigate · hypothesis</h4><p className="mt-1 text-gray-700 break-words">{op.hypothesis}</p><p className="mt-2 text-gray-500 break-words"><span className="font-medium">Impact to verify: </span>{op.consequence}</p></div>
      <dl className="mt-4 grid md:grid-cols-2 gap-4"><div><dt className="font-medium">Who to speak with · hypothesis</dt><dd className="mt-1 text-gray-700 break-words">{op.nextWho}</dd></div><div><dt className="font-medium">Question to ask</dt><dd className="mt-1 text-gray-700 break-words">{op.nextQuestion}</dd></div></dl>
      <h4 className="font-medium mt-4">Still unknown</h4><ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">{op.unknowns.map(text => <li className="break-words" key={text}>{text}</li>)}</ul>
      <h4 className="font-medium mt-4">Original review evidence</h4>
      <div className="space-y-4 mt-3 max-h-96 overflow-auto pr-2">{evidence.map(ref => <blockquote key={ref.key} className="border-l-2 border-gray-200 pl-3"><p className="text-xs text-gray-500 break-words">{ref.appName} · {ref.date ? new Date(ref.date).toLocaleDateString() : 'Undated'} · {ref.country.toUpperCase()} · {ref.source}{ref.partial ? ' · partial sample' : ''}</p><p className="mt-1 whitespace-pre-wrap break-words">{ref.quote}</p>{/^https:\/\/(apps\.apple\.com|play\.google\.com)\//.test(ref.appUrl) && <a href={ref.appUrl} target="_blank" rel="noreferrer" className="text-xs text-teal-800 mt-1 inline-block">Store listing</a>}</blockquote>)}</div>
      {saved && <p className="text-xs text-gray-500 mt-4 break-words">Saved research question: {report.context.question || 'Not set'}</p>}
    </details>
    {saved && onStage && <div className="flex flex-wrap items-center gap-3 mt-4">
      <select aria-label={`Validation status for ${op.title}`} value={saved.stage} onChange={event => onStage(event.target.value as SavedOpportunity['stage'])} className="border border-gray-300 rounded p-2 text-sm max-w-full"><option value="saved">To validate</option><option value="interview">Interview planned</option><option value="prototype">Prototype planned</option><option value="archived">Set aside</option></select>
      <button title="Export opportunity" aria-label={`Export ${op.title}`} onClick={() => downloadFile('insightly-opportunity.md', opportunityMarkdown(saved), 'text/markdown;charset=utf-8')} className="p-2 text-gray-600"><Download className="w-4 h-4" /></button>
      <button title="Remove saved opportunity" aria-label={`Remove saved ${op.title}`} onClick={onRemove} className="p-2 text-gray-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
    </div>}
  </article>;
};

interface Props {
  project: ResearchProject; onProjectChange: (patch: Partial<ResearchProject>) => void;
  apps: WatchApp[]; research: ResearchContext; onResearchSave: (context: ResearchContext) => void;
  profile: ClassifierProfile | null; checking: boolean; token: string | null; busy: boolean;
  onBusyChange: (busy: boolean) => void; onOpenSources: () => void;
  onPrepare: (apps: ResearchApp[], days: number, progress: (text: string) => void, signal: AbortSignal) => Promise<{ apps: WatchApp[]; warnings: string[] }>;
}

export default function OpportunityWorkspace({ project, onProjectChange, apps, research, onResearchSave, profile, checking, token, busy, onBusyChange, onOpenSources, onPrepare }: Props) {
  const { scope, days, report, saved } = project;
  const [scopeDirty, setScopeDirty] = useState(false);
  const [setupOpen, setSetupOpen] = useState(() => !project.report);
  const [view, setView] = useState<'opportunities' | 'saved'>('opportunities');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const [error, setError] = useState<string | null>(null);
  const sampleOnly = !scope.apps.length && !scope.query && apps.length > 0 && apps.every(app => app.sample);
  const context = useMemo(() => ({ ...research, focusTopic: 'all', question: research.question || (scope.query ? `Explore user problems in ${scope.title}` : '') }), [research, scope.query, scope.title]);
  const scopedApps = useMemo(() => apps.filter(app => sampleOnly || (!app.sample && scope.apps.some(item => item.key === storeAppKey(app.url)))), [apps, scope.apps, sampleOnly]);
  const matchingModel = (items: WatchApp[]) => items.map(app => ({ ...app, reviews: app.reviews.filter(review => app.sample || !profile?.configured || getReviewAnalysis(review)?.model === profile.model) }));
  const evidence = selectOpportunityEvidence(matchingModel(scopedApps), context, days);
  const inputKey = opportunityInputKey(context, evidence, days);
  const visibleReport = sampleOnly ? illustrativeOpportunityReport(evidence, context, days) : report;
  const stale = !!visibleReport && (scopeDirty || visibleReport.inputKey !== inputKey || (visibleReport.researchAppKeys && JSON.stringify(visibleReport.researchAppKeys) !== JSON.stringify(scope.apps.map(app => app.key))) || (!visibleReport.sample && profile?.configured && visibleReport.model !== profile.model));

  const persistScope = (next: ResearchScope) => {
    onProjectChange({ scope: next, ...(next.query !== scope.query ? { research: { mode: 'explore', question: '', product: '', focusTopic: 'all' } } : {}) });
  };

  const persistSaved = (next: SavedOpportunity[]) => {
    onProjectChange({ saved: next });
  };

  const generate = async () => {
    if (controller.current || busy || scopeDirty || !profile?.configured || !scope.apps.length || sampleOnly) return;
    const abort = new AbortController(); controller.current = abort;
    setGenerating(true); onBusyChange(true); setError(null); setWarnings([]);
    try {
      const prepared = await onPrepare(scope.apps, days, setProgress, abort.signal);
      setWarnings(prepared.warnings);
      abort.signal.throwIfAborted();
      const selectedEvidence = selectOpportunityEvidence(matchingModel(prepared.apps), context, days);
      if (!selectedEvidence.length) throw new Error(`Not enough review evidence in the last ${days} days to identify a user problem. Try another app or a wider review period.`);
      const nextInputKey = opportunityInputKey(context, selectedEvidence, days);
      if (report && report.inputKey === nextInputKey && report.model === profile.model && JSON.stringify(report.researchAppKeys) === JSON.stringify(scope.apps.map(app => app.key))) { setProgress('Research is up to date.'); setSetupOpen(false); return; }
      setProgress('Connecting feedback to user problems...');
      const marketId = project.id;
      const response = await fetch(`${SERVER_URL}/api/market/opportunities`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(opportunityRequest(marketId, context, selectedEvidence, days)), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(100000)]) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Opportunity research is unavailable.');
      const next = parseOpportunityReport({ ...data, inputKey: nextInputKey, evidence: selectedEvidence, context, days, sample: false, researchAppKeys: scope.apps.map(app => app.key) });
      if (!next || data.version !== OPPORTUNITY_VERSION || data.provider !== 'gemini' || data.model !== profile.model) throw new Error('Research returned invalid hypotheses or evidence references.');
      onProjectChange({ report: next });
      setSetupOpen(false);
      setProgress('Research complete.');
    } catch (error) { setProgress(''); setError(abort.signal.aborted ? 'Research stopped. Completed review collection and analysis have been saved.' : `${error instanceof Error ? error.message : 'Research failed.'} Any previous results are retained.`); }
    finally { controller.current = null; setGenerating(false); onBusyChange(false); }
  };

  const saveOpportunity = (op: Opportunity, from: OpportunityReport) => {
    try { persistSaved(saveOpportunitySnapshot(saved, op, from)); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save this opportunity.'); }
  };

  return <>
    {view === 'opportunities' && <>
      {report && <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-gray-600 break-words">{scope.title} · {scope.apps.length} {scope.apps.length === 1 ? 'app' : 'apps'}</p><button disabled={busy} onClick={() => setSetupOpen(value => !value)} className="text-sm text-teal-800">{setupOpen ? 'Close research setup' : 'Edit research scope'}</button></div>}
      <div hidden={!setupOpen && !!report}><ResearchStart scope={scope} onChange={persistScope} apps={apps} busy={busy} available={!!profile?.configured && !checking} unavailableReason={profile?.message || undefined} token={token} onBusyChange={onBusyChange} onDirty={setScopeDirty} /></div>
      {!sampleOnly && scope.apps.length > 0 && <div className="py-4 flex flex-wrap items-center gap-3">
        <button onClick={generate} disabled={busy || scopeDirty || checking || !profile?.configured} className="inline-flex items-center gap-2 px-4 py-3 rounded bg-teal-700 text-white text-sm font-medium disabled:opacity-40">{generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}{generating ? 'Researching...' : report && !stale ? 'Refresh research' : 'Start research'}</button>
        {generating && <button onClick={() => controller.current?.abort()} className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600"><Square className="w-4 h-4" />Stop</button>}
        <p role="status" className="text-sm text-gray-600 break-words">{progress}</p>
      </div>}
      {!!scope.apps.length && setupOpen && <details className="pb-4 text-sm text-gray-600"><summary className="cursor-pointer w-fit">Research focus <span className="text-gray-400">· optional</span></summary>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          <label>Specific question<input aria-label="Optional research question" disabled={busy} maxLength={400} value={research.question} onChange={event => onResearchSave({ ...research, question: event.target.value })} placeholder="Any user problem worth investigating" className="block w-full mt-1 px-3 py-2 border border-gray-300 rounded" /></label>
          <label>Research for<select aria-label="Research purpose" disabled={busy} value={research.mode || 'explore'} onChange={event => onResearchSave({ ...research, mode: event.target.value as ResearchContext['mode'] })} className="block w-full mt-1 px-3 py-2 border border-gray-300 rounded"><option value="explore">A new direction</option><option value="improve">My existing product</option></select></label>
          {research.mode === 'improve' && <label>My product <span className="text-gray-400">· optional</span><input disabled={busy} maxLength={600} value={research.product} onChange={event => onResearchSave({ ...research, product: event.target.value })} className="block w-full mt-1 px-3 py-2 border border-gray-300 rounded" /></label>}
          <label>Review period<select disabled={busy} aria-label="Opportunity evidence period" value={days} onChange={event => onProjectChange({ days: Number(event.target.value) })} className="block mt-1 border border-gray-300 rounded p-2"><option value={90}>Last 90 days</option><option value={30}>Last 30 days</option><option value={7}>Last 7 days</option></select></label>
        </div>
      </details>}
    </>}
    <div className="flex flex-wrap justify-between items-center gap-3 border-b border-gray-200 mt-3">
      <div role="tablist" aria-label="Opportunity views" className="flex gap-5">{(['opportunities', 'saved'] as const).map(tab => <button key={tab} role="tab" disabled={busy} aria-selected={view === tab} aria-controls="opportunity-panel" id={`opportunity-tab-${tab}`} onClick={() => setView(tab)} className={`py-3 border-b-2 text-sm font-medium ${view === tab ? 'border-teal-700 text-teal-900' : 'border-transparent text-gray-500'}`}>{tab === 'opportunities' ? 'User problems' : `Saved directions (${saved.length})`}</button>)}</div>
    </div>
    {error && <p role="alert" className="text-sm text-red-700 mt-4 break-words">{error}</p>}
    {warnings.length > 0 && <div role="status" className="text-sm text-amber-800 mt-4"><p>Some sources have incomplete feedback.</p><ul className="list-disc pl-5 mt-1">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
    <section id="opportunity-panel" role="tabpanel" aria-labelledby={`opportunity-tab-${view}`} className="pb-5">
      {view === 'saved' ? <>
        <h2 className="text-lg font-semibold mt-5">Directions to investigate</h2>
        {!saved.length && <p className="text-sm text-gray-500 mt-4">No saved directions yet.</p>}
        {saved.map(item => <OpportunityRow key={item.opportunity.id} opportunity={item.opportunity} report={item.report} saved={item}
          onStage={stage => persistSaved(saved.map(other => other.opportunity.id === item.opportunity.id ? { ...other, stage } : other))}
          onRemove={() => persistSaved(saved.filter(other => other.opportunity.id !== item.opportunity.id))} />)}
      </> : <>
        {visibleReport && <div className="mt-5"><h2 className="text-lg font-semibold">Problems worth investigating</h2><p className="text-xs text-gray-500 mt-2">{sampleOnly ? 'Illustrative sample data' : `${new Set(visibleReport.evidence.map(item => item.reviewKey)).size} reviews considered · last ${visibleReport.days} days`}</p></div>}
        {stale && <p role="status" className="text-sm text-amber-800 mt-4">Previous research. The scope or feedback has changed.</p>}
        {!visibleReport && !generating && <p className="text-sm text-gray-500 mt-5">{scope.apps.length ? 'Ready to research these apps.' : 'No research results yet.'}</p>}
        {visibleReport?.opportunities.map(op => <OpportunityRow key={op.id} opportunity={op} report={visibleReport}
          saved={saved.find(item => item.opportunity.id === op.id && item.report.inputKey === visibleReport.inputKey && item.report.model === visibleReport.model && JSON.stringify(item.opportunity) === JSON.stringify(op))}
          previouslySaved={saved.some(item => item.opportunity.id === op.id)} onSave={() => saveOpportunity(op, visibleReport)} />)}
        {visibleReport && visibleReport.opportunities.length === 0 && <p className="text-sm text-gray-600 mt-5">No supported opportunity hypotheses were found in these excerpts. This does not establish absence of demand.</p>}
        {visibleReport && <details className="mt-5 text-xs text-gray-500"><summary className="cursor-pointer">Research scope &amp; usage</summary><p className="mt-2">{visibleReport.evidence.length} selected excerpts from {new Set(visibleReport.evidence.map(item => item.reviewKey)).size} reviews · last {visibleReport.days} days · {visibleReport.provider} / {visibleReport.model}</p><p className="mt-2">{visibleReport.evidence.some(item => item.partial || item.source !== 'review-feed') ? 'Limited or unverified samples are included. ' : 'Sample completeness is not established. '}No market-wide frequency, payment intent or opportunity score is established.</p>{Number.isInteger(visibleReport.usage?.totalTokenCount) && <p className="mt-2">Problem synthesis tokens: {visibleReport.usage.totalTokenCount} · {visibleReport.usage.promptTokenCount ?? 'unknown'} input · {visibleReport.usage.candidatesTokenCount ?? 'unknown'} output{visibleReport.usage.thoughtsTokenCount !== undefined ? ` · ${visibleReport.usage.thoughtsTokenCount} thinking` : ''}. App discovery and review classification usage are additional.</p>}</details>}
        {visibleReport && <button onClick={onOpenSources} className="mt-4 text-sm text-teal-800">Review sources and collection details</button>}
      </>}
    </section>
  </>;
}
