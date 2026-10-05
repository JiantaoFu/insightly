import { useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, Download, FlaskConical, Loader2, Search, Trash2 } from 'lucide-react';
import { SERVER_URL } from './Constants';
import { ResearchQuestionEditor } from './MarketResearch';
import type { ClassifierProfile } from './MarketModelControls';
import { getMarketTopics, type ResearchContext, type WatchApp } from '../utils/marketIntelligence';
import { illustrativeOpportunityReport, loadSavedOpportunities, OPPORTUNITY_STORAGE, OPPORTUNITY_VERSION, opportunityInputKey, opportunityMarkdown, opportunityRequest, parseOpportunityReport, saveOpportunitySnapshot, SAVED_OPPORTUNITY_STORAGE, selectOpportunityEvidence, type Opportunity, type OpportunityReport, type SavedOpportunity } from '../utils/marketOpportunities';
import { downloadFile } from '../utils/download';

const readStorage = (key: string): unknown => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };

const OpportunityRow = ({ opportunity: op, report, saved, previouslySaved, onSave, onStage, onRemove }: {
  opportunity: Opportunity; report: OpportunityReport; saved?: SavedOpportunity; onSave?: () => void;
  previouslySaved?: boolean; onStage?: (stage: SavedOpportunity['stage']) => void; onRemove?: () => void;
}) => {
  const evidence = report.evidence.filter(ref => op.evidenceKeys.includes(ref.key));
  const apps = [...new Set(evidence.map(ref => ref.appName))];
  return <article className="py-6 border-b border-gray-200 last:border-b-0">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><p className="text-xs text-teal-800 mb-2">{report.sample ? 'Illustrative hypothesis' : 'Opportunity hypothesis'}</p><h3 className="text-lg font-semibold text-gray-950 break-words">{op.title}</h3></div>
      {onSave && <button onClick={onSave} disabled={!!saved} className="inline-flex shrink-0 items-center gap-2 text-sm text-teal-800 disabled:text-gray-500">{saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}{saved ? 'Saved' : previouslySaved ? 'Update saved' : 'Save for validation'}</button>}
    </div>
    <p className="mt-2 text-xs text-gray-500 break-words">{new Set(evidence.map(ref => ref.reviewKey)).size} reviews cited · {apps.join(', ')}</p>
    <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 mt-5 text-sm">
      <div><h4 className="font-medium text-gray-900">Possible user scenario <span className="font-normal text-xs text-gray-500">· inferred</span></h4><p className="mt-1 text-gray-700 whitespace-pre-wrap break-words">{op.scenario}</p></div>
      <div><h4 className="font-medium text-gray-900">Reported obstacle</h4><p className="mt-1 text-gray-700 break-words">{op.obstacle}</p><p className="mt-2 text-gray-500 break-words"><span className="font-medium">Impact to verify: </span>{op.consequence}</p></div>
    </div>
    <div className="mt-4 text-sm"><h4 className="font-medium text-gray-900">Why investigate <span className="font-normal text-xs text-gray-500">· hypothesis</span></h4><p className="mt-1 text-gray-700 break-words">{op.hypothesis}</p></div>
    <div className="mt-4 border-l-2 border-teal-600 pl-3 text-sm"><h4 className="font-medium flex gap-2 items-center text-teal-900"><FlaskConical className="w-4 h-4 shrink-0" />Next validation</h4><p className="mt-2 break-words">{op.nextExperiment}</p></div>
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-teal-800">Evidence &amp; validation details</summary>
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
  apps: WatchApp[]; research: ResearchContext; onResearchSave: (context: ResearchContext) => void;
  profile: ClassifierProfile | null; checking: boolean; token: string | null; busy: boolean;
  onBusyChange: (busy: boolean) => void; onOpenSources: () => void;
}

export default function OpportunityWorkspace({ apps, research, onResearchSave, profile, checking, token, busy, onBusyChange, onOpenSources }: Props) {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState(() => parseOpportunityReport(readStorage(OPPORTUNITY_STORAGE)));
  const [saved, setSaved] = useState(() => loadSavedOpportunities(readStorage(SAVED_OPPORTUNITY_STORAGE)));
  const [view, setView] = useState<'opportunities' | 'saved'>('opportunities');
  const [generating, setGenerating] = useState(false);
  const [questionDirty, setQuestionDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const evidence = useMemo(() => selectOpportunityEvidence(apps, research, days), [apps, research, days]);
  const inputKey = opportunityInputKey(research, evidence, days);
  const sampleOnly = apps.length > 0 && apps.every(app => app.sample);
  const visibleReport = sampleOnly ? illustrativeOpportunityReport(evidence, research, days) : report;
  const stale = !!visibleReport && (visibleReport.inputKey !== inputKey || (!visibleReport.sample && profile?.configured && visibleReport.model !== profile.model));
  const current = !!visibleReport && !stale;

  const persistSaved = (next: SavedOpportunity[]) => {
    setSaved(next);
    try { localStorage.setItem(SAVED_OPPORTUNITY_STORAGE, JSON.stringify(next)); } catch { setError('Browser storage is unavailable or full. Saved changes will be lost when this page closes.'); }
  };

  const generate = async () => {
    if (busy || questionDirty || !profile?.configured || !research.question.trim() || !evidence.length || sampleOnly) return;
    setGenerating(true); onBusyChange(true); setError(null);
    try {
      const marketId = localStorage.getItem('insightly_market_id_v1') || crypto.randomUUID();
      localStorage.setItem('insightly_market_id_v1', marketId);
      const response = await fetch(`${SERVER_URL}/api/market/opportunities`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(opportunityRequest(marketId, research, evidence, days)), signal: AbortSignal.timeout(100000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Opportunity research is unavailable.');
      const next = parseOpportunityReport({ ...data, inputKey, evidence, context: research, days, sample: false });
      if (!next || data.version !== OPPORTUNITY_VERSION || data.provider !== 'gemini' || data.model !== profile.model) throw new Error('Research returned invalid hypotheses or evidence references.');
      setReport(next);
      try { localStorage.setItem(OPPORTUNITY_STORAGE, JSON.stringify(next)); } catch { setError('Research is available until this page closes; browser storage is full or unavailable.'); }
    } catch (error) { setError(error instanceof Error ? error.message : 'Research failed. Previous research retained.'); }
    finally { setGenerating(false); onBusyChange(false); }
  };

  const saveOpportunity = (op: Opportunity, from: OpportunityReport) => {
    try { persistSaved(saveOpportunitySnapshot(saved, op, from)); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save this opportunity.'); }
  };

  return <>
    <ResearchQuestionEditor context={research} topics={getMarketTopics(apps)} busy={busy} onSave={onResearchSave} onDirty={setQuestionDirty} />
    <div className="flex flex-wrap justify-between items-center gap-3 border-b border-gray-200 mt-3">
      <div role="tablist" aria-label="Opportunity views" className="flex gap-5">{(['opportunities', 'saved'] as const).map(tab => <button key={tab} role="tab" aria-selected={view === tab} aria-controls="opportunity-panel" id={`opportunity-tab-${tab}`} onClick={() => setView(tab)} className={`py-3 border-b-2 text-sm font-medium ${view === tab ? 'border-teal-700 text-teal-900' : 'border-transparent text-gray-500'}`}>{tab === 'opportunities' ? 'Opportunities' : `Saved (${saved.length})`}</button>)}</div>
      <div className="flex gap-3 items-center pb-2 flex-wrap">
        {view === 'opportunities' && <select disabled={busy} aria-label="Opportunity evidence period" value={days} onChange={event => setDays(Number(event.target.value))} className="border border-gray-300 rounded p-2 text-sm"><option value={30}>Last 30 days</option><option value={7}>Last 7 days</option></select>}
        {view === 'opportunities' && !sampleOnly && <button onClick={generate} disabled={busy || questionDirty || checking || !profile?.configured || !research.question.trim() || !evidence.length || current} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-teal-700 text-white text-sm disabled:opacity-40">{generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}{generating ? 'Researching...' : stale ? 'Update opportunities' : current ? 'Up to date' : 'Find opportunities'}</button>}
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-red-700 mt-4 break-words">{error}</p>}
    <section id="opportunity-panel" role="tabpanel" aria-labelledby={`opportunity-tab-${view}`} className="pb-5">
      {view === 'saved' ? <>
        <h2 className="text-lg font-semibold mt-5">Validation shortlist</h2>
        {!saved.length && <p className="text-sm text-gray-500 mt-4">No saved opportunities yet.</p>}
        {saved.map(item => <OpportunityRow key={item.opportunity.id} opportunity={item.opportunity} report={item.report} saved={item}
          onStage={stage => persistSaved(saved.map(other => other.opportunity.id === item.opportunity.id ? { ...other, stage } : other))}
          onRemove={() => persistSaved(saved.filter(other => other.opportunity.id !== item.opportunity.id))} />)}
      </> : <>
        <div className="mt-5"><h2 className="text-lg font-semibold">Problems worth validating</h2><p className="text-xs text-gray-500 mt-2">{sampleOnly ? 'Illustrative sample data' : 'Research hypotheses, not validated business opportunities'}</p></div>
        {stale && <p role="status" className="text-sm text-amber-800 mt-4">The question, evidence or model has changed. These are previous hypotheses.</p>}
        {!sampleOnly && !evidence.length && <div className="mt-5 text-sm"><p className="text-gray-600">{apps.length ? 'No classified, dated evidence in this research scope.' : 'No app review sources yet.'}</p><button onClick={onOpenSources} className="inline-flex gap-2 items-center mt-3 text-teal-800"><Search className="w-4 h-4" />{apps.length ? 'Prepare evidence' : 'Add apps'}</button></div>}
        {!visibleReport && !!evidence.length && <p className="text-sm text-gray-600 mt-5">{!research.question.trim() ? 'No research question saved yet.' : checking ? 'Checking research service...' : !profile?.configured ? profile?.message || 'Research service unavailable.' : 'No opportunity research generated for this question yet.'}</p>}
        {visibleReport?.opportunities.map(op => <OpportunityRow key={op.id} opportunity={op} report={visibleReport}
          saved={saved.find(item => item.opportunity.id === op.id && item.report.inputKey === visibleReport.inputKey && item.report.model === visibleReport.model && JSON.stringify(item.opportunity) === JSON.stringify(op))}
          previouslySaved={saved.some(item => item.opportunity.id === op.id)} onSave={() => saveOpportunity(op, visibleReport)} />)}
        {visibleReport && visibleReport.opportunities.length === 0 && <p className="text-sm text-gray-600 mt-5">No supported opportunity hypotheses were found in these excerpts. This does not establish absence of demand.</p>}
        {visibleReport && <details className="mt-5 text-xs text-gray-500"><summary className="cursor-pointer">Research scope &amp; usage</summary><p className="mt-2">{visibleReport.evidence.length} selected excerpts from {new Set(visibleReport.evidence.map(item => item.reviewKey)).size} reviews · last {visibleReport.days} days · {visibleReport.provider} / {visibleReport.model}</p><p className="mt-2">{visibleReport.evidence.some(item => item.partial || item.source !== 'review-feed') ? 'Limited or unverified samples are included. ' : 'Sample completeness is not established. '}No market-wide frequency, payment intent or opportunity score is established.</p>{Number.isInteger(visibleReport.usage?.totalTokenCount) && <p className="mt-2">Provider-reported tokens: {visibleReport.usage.totalTokenCount} total · {visibleReport.usage.promptTokenCount ?? 'unknown'} input · {visibleReport.usage.candidatesTokenCount ?? 'unknown'} output{visibleReport.usage.thoughtsTokenCount !== undefined ? ` · ${visibleReport.usage.thoughtsTokenCount} thinking` : ''}</p>}</details>}
      </>}
    </section>
  </>;
}
