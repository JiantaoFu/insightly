import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Bookmark, Check, Download, MessageSquare, Plus, Sparkles, X } from 'lucide-react';
import type { ResearchProject } from '../utils/researchProjects';
import { type WatchApp } from '../utils/marketIntelligence';
import { buildProblems, problemHasEvidence } from '../utils/feedbackSummary';
import { filterReviews } from '../utils/reviewExplorer';
import { saveDecisionPlan, decisionPlanMarkdown } from '../utils/decisionResearch';
import { saveOpportunitySnapshot, opportunityMarkdown, type OpportunityEvidence } from '../utils/marketOpportunities';
import { downloadFile } from '../utils/download';
import type { WorkspaceView } from './VoicelyShell';
import ReviewExplorer from './ReviewExplorer';

interface LabOpportunity { id: string; title: string; proposal: string; scenario: string; rationale: string; uncertainty: string; action: string; changeMind: string; interviewQuestion?: string; success?: string; scopeLimit?: string; evidence: OpportunityEvidence[]; saved: boolean; save: () => void; exportBrief: () => void }
export function LabDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current, overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog?.showModal(); return () => { dialog?.close(); document.body.style.overflow = overflow; }; }, []);
  return <dialog ref={ref} onCancel={event => { event.preventDefault(); onClose(); }} aria-label={title} className="lab-dialog"><header><h2>{title}</h2><button className="voicely-button" title="Close dialog" aria-label="Close dialog" onClick={onClose}><X /></button></header><div className="lab-dialog-body">{children}</div></dialog>;
}

export default function LabWorkspace({ view, project, apps, comparisonApps, comparisonUrl, onDaysChange, onChange, onAnalyze, onCompare, onNavigate, busy }: {
  view: WorkspaceView; project: ResearchProject; apps: WatchApp[]; onChange: (patch: Partial<ResearchProject>) => void;
  comparisonApps: WatchApp[]; onDaysChange: (days: number) => void;
  comparisonUrl: string;
  onAnalyze: () => void; onCompare: () => void; onNavigate: (view: WorkspaceView) => void; busy: boolean;
}) {
  const platform = 'all', days = project.days;
  const [theme, setTheme] = useState(''), [kind, setKind] = useState('all'), [opFilter, setOpFilter] = useState('all');
  const [detailId, setDetailId] = useState<string | null>(null), [compareId, setCompareId] = useState('');
  const [showAllFeedback, setShowAllFeedback] = useState(false);
  const [problemId, setProblemId] = useState<string | null>(null);
  const [evidenceIntent, setEvidenceIntent] = useState('all');
  const [annual, setAnnual] = useState(false), [evidenceTopic, setEvidenceTopic] = useState('');
  const requestedComparison = comparisonApps.find(app => app.url === comparisonUrl)?.id || '';
  useEffect(() => { setCompareId(requestedComparison); }, [requestedComparison]);
  const active = apps.find(app => !app.sample);
  const real = [active, ...comparisonApps].filter((app): app is WatchApp => !!app && !app.sample);
  const comparison = comparisonApps.find(app => app.id === compareId) || comparisonApps[comparisonApps.length - 1];
  const filters = { appId: 'all', platform, days, query: '', intent: 'all' };
  const asOf = Date.parse(active?.syncedAt || project.report?.generatedAt || '') || Date.now();
  const rows = filterReviews(active ? [active] : [], filters, asOf);
  const classified = rows.filter(row => row.analysis);
  const problems = buildProblems(rows);
  const visibleProblems = problems.filter(problem => (!theme || problem.topicId === theme) && (kind === 'all' || problem.intent === kind));
  const selectedProblem = problems.find(problem => problem.id === problemId);
  const themes = useMemo(() => {
    const grouped = new Map<string, { id: string; name: string; count: number; complaint: number; request: number; praise: number }>();
    for (const row of classified) {
      const seen = new Set<string>();
      for (const label of row.analysis!.labels) {
        const topic = grouped.get(label.topic.id) || { id: label.topic.id, name: label.topic.name, count: 0, complaint: 0, request: 0, praise: 0 };
        if (!seen.has(label.topic.id)) { topic.count++; seen.add(label.topic.id); }
        const key = `${label.topic.id}:${label.intent}`;
        if (!seen.has(key) && label.intent !== 'observation') { topic[label.intent]++; seen.add(key); }
        grouped.set(label.topic.id, topic);
      }
    }
    return [...grouped.values()].sort((a, b) => b.count - a.count);
  }, [classified]);
  const opportunities: LabOpportunity[] = [];
  const report = project.decision?.report;
  if (report?.result.directions) report.result.directions.forEach((direction, index) => {
    const evidence = report.evidence.filter(ref => direction.evidenceKeys.includes(ref.key));
    const saved = (project.decisionPlans || []).some(plan => plan.report.inputKey === report.inputKey && plan.directionIndex === index);
    opportunities.push({ id: `decision-${index}`, ...direction, evidence, saved,
      save: () => onChange({ decisionPlans: saveDecisionPlan(project.decisionPlans || [], report, index) }),
      exportBrief: () => downloadFile('voicely-opportunity.md', decisionPlanMarkdown(saveDecisionPlan([], report, index)[0]), 'text/markdown;charset=utf-8') });
  });
  if (project.report && !project.report.sample) for (const op of project.report.opportunities) {
    const from = project.report;
    const saved = project.saved.find(item => item.opportunity.id === op.id && item.report.inputKey === from.inputKey);
    opportunities.push({ id: op.id, title: op.title, proposal: op.hypothesis, scenario: op.scenario, rationale: op.obstacle,
      uncertainty: op.unknowns.join(' '), action: saved?.experiment ?? op.nextExperiment, changeMind: saved?.changeMind ?? op.changeMind ?? '', interviewQuestion: op.nextQuestion, success: saved?.success ?? op.success, scopeLimit: saved?.scopeLimit ?? op.scopeLimit,
      evidence: from.evidence.filter(ref => op.evidenceKeys.includes(ref.key)), saved: project.saved.some(item => item.opportunity.id === op.id && item.report.inputKey === from.inputKey),
      save: () => onChange({ saved: saveOpportunitySnapshot(project.saved, op, from) }),
      exportBrief: () => downloadFile('voicely-opportunity.md', opportunityMarkdown(saved || saveOpportunitySnapshot([], op, from)[0]), 'text/markdown;charset=utf-8') });
  }
  const detail = opportunities.find(op => op.id === detailId);
  const detailTopics = new Set(detail?.evidence.map(ref => ref.topic) || []);
  const detailRows = rows.filter(row => row.analysis?.labels.some(label => detailTopics.has(label.topic.name)));
  const comparisonQuestion = themes.find(item => item.complaint > 0 || item.request > 0);
  const card = (op: LabOpportunity) => <article className="lab-opportunity" key={op.id}>
    <div className="voicely-toolbar mt-0"><span className={`lab-badge ${op.evidence.length ? '' : 'amber'}`}>{op.evidence.length ? 'Review-backed problem' : 'Exploratory direction'}</span><button disabled={busy || op.saved} className="voicely-button" aria-label={`Save ${op.title}`} title={op.saved ? 'Saved' : 'Save opportunity'} onClick={op.save}>{op.saved ? <Check /> : <Bookmark />}</button></div>
    <h3>{op.title}</h3><p>{op.proposal}</p><div className="mb-4"><small className="voicely-muted">Source themes</small>{[...new Set(op.evidence.map(ref => ref.topic))].map(name => <button key={name} className="block text-left text-teal-800 underline text-xs mt-2" onClick={() => { setEvidenceTopic(themes.find(item => item.name === name)?.id || ''); setEvidenceIntent('all'); onNavigate('reviews'); }}>{name}</button>)}</div><footer><span>{new Set(op.evidence.map(ref => ref.reviewKey)).size} cited reviews</span><button className="voicely-button" onClick={() => setDetailId(op.id)}>Explore <ArrowRight /></button></footer>
  </article>;
  const appStrip = <section className="lab-app-strip" aria-label="Analysis scope">
    <div className="flex items-center gap-3 min-w-0">{active?.icon ? <img src={active.icon} alt="" className="w-11 h-11 rounded-lg" /> : <MessageSquare className="w-8 h-8 text-teal-800 shrink-0" />}
      {active ? <button disabled={busy} onClick={onAnalyze} className="text-left min-w-0" aria-label="Change app"><strong className="block break-words">{active.name}</strong><span className="voicely-muted">{active.developer} · {active.platform === 'ios' ? 'App Store' : 'Google Play'} · {active.reviewCountry?.toUpperCase()}</span></button> : <button disabled={busy} onClick={onAnalyze} className="voicely-button">Choose an app <Plus /></button>}</div>
    <div className="flex flex-wrap gap-3"><label>Time range<select aria-label="Time range" disabled={busy || !active} value={days} onChange={event => onDaysChange(Number(event.target.value))}><option value={90}>Last 90 days</option><option value={30}>Last 30 days</option></select></label>{project.report && <span className="voicely-muted self-end">Analyzed {new Date(project.report.generatedAt).toLocaleDateString()}</span>}</div>
  </section>;
  return <>
    {['next', 'reviews', 'opportunities', 'compare'].includes(view) && appStrip}
    {view === 'next' && <>
      {opportunities.length > 0 && <p className="voicely-muted mt-4">{active?.name} · last {days} days · problems and evidence from the same completed analysis.</p>}
      <section className="voicely-metrics"><div><p>Reviews in scope</p><strong>{rows.length}</strong><small>Collected sample</small></div><div><p>Sample average</p><strong>{rows.some(row => row.review.score) ? (rows.reduce((n, row) => n + (row.review.score || 0), 0) / rows.filter(row => row.review.score).length).toFixed(1) : '—'}</strong><small>Out of 5</small></div><div><p>Pain-point reviews</p><strong>{classified.filter(row => row.analysis?.labels.some(label => label.intent === 'complaint')).length}</strong><small>{classified.length} classified in scope</small></div><div><p>Problems to investigate</p><strong>{problems.length}</strong><small>Extracted from classified reviews</small></div></section>
      <p className="lab-notice">{classified.length} of {rows.length} collected reviews classified · {rows.length - classified.length} not yet classified. Theme counts describe this classified sample, not all users. A review can mention multiple themes.</p>
      <section className="lab-signals">
        <div className="voicely-toolbar"><div><h2 className="voicely-panel-title">Problems worth exploring</h2><p className="voicely-muted">Ordered by supporting review count, not business priority.</p></div>
          <label>Theme<select aria-label="Filter problem theme" value={theme} onChange={event => { setTheme(event.target.value); setShowAllFeedback(false); }}><option value="">All themes</option>{themes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        </div>
        <div className="lab-theme-tabs" role="group" aria-label="Problem type">{[['all', 'All problems'], ['complaint', 'Pain points'], ['request', 'Feature requests']].map(([id, label]) => <button key={id} aria-pressed={kind === id} onClick={() => { setKind(id); setShowAllFeedback(false); }}>{label}</button>)}</div>
        {!visibleProblems.length && <div className="voicely-empty"><h3>No specific problems in this selection.</h3><p>Unclassified reviews and positive feedback may still contain useful context.</p><button className="voicely-button" onClick={() => { setEvidenceTopic(''); setEvidenceIntent('all'); onNavigate('reviews'); }}>Review the source material<ArrowRight /></button></div>}
        <div className="feedback-grid">{(showAllFeedback ? visibleProblems : visibleProblems.slice(0, 6)).map(problem => {
          const linked = opportunities.filter(op => problemHasEvidence(problem, op.evidence));
          return <article className="feedback-card problem-card" data-kind={problem.intent} key={problem.id}>
            <span className="problem-category">{problem.topic} · {problem.intent === 'complaint' ? 'Pain point' : 'Request'}</span>
            <h3>{problem.title}</h3>
            <p className="feedback-count">{problem.rows.length} supporting review{problem.rows.length === 1 ? '' : 's'} · model-extracted problem</p>
            <blockquote className="problem-excerpt">{problem.quotes[0] || 'No exact excerpt saved. Open the original reviews.'}</blockquote>
            <footer><p className="voicely-muted">{linked.length ? `${linked.length} possible direction${linked.length === 1 ? '' : 's'} to test` : 'No proposed solution yet'}</p>{linked.slice(0, 1).map(op => <h4 className="text-sm mb-4" key={op.id}>{op.title}</h4>)}<button className="voicely-button feedback-evidence" onClick={() => setProblemId(problem.id)}>Investigate problem<ArrowRight /></button></footer>
          </article>;
        })}</div>
        {visibleProblems.length > 6 && <button className="voicely-button mt-4" onClick={() => setShowAllFeedback(value => !value)}>{showAllFeedback ? 'Show fewer problems' : `Show all ${visibleProblems.length} problems`}</button>}
        <p className="voicely-muted mt-4">Descriptions with identical wording are grouped within a theme. Similar wording may describe the same problem; counts are reviews, not unique people.</p>
      </section>

    </>}
    {view === 'opportunities' && <><p className="lab-notice">{active ? `${active.name} · last ${days} days. ` : ''}Evidence-backed problems, proposed solutions. Demand and outcomes still need validation.</p><div className="lab-theme-tabs" role="group" aria-label="Opportunity type">{[['all', 'All opportunities'], ['backed', 'Review-backed'], ['exploratory', 'Exploratory']].map(([id, label]) => <button key={id} aria-pressed={opFilter === id} onClick={() => setOpFilter(id)}>{label}</button>)}</div><div className="lab-opportunity-grid">{opportunities.filter(op => opFilter === 'all' || (opFilter === 'backed' ? op.evidence.length > 0 : !op.evidence.length)).map(card)}</div>{!opportunities.length && <div className="voicely-empty"><Sparkles /><h2>No researched opportunities yet.</h2><button className="voicely-button primary mt-4" onClick={onAnalyze}>Analyze an app <ArrowRight /></button></div>}</>}
    {view === 'reviews' && <ReviewExplorer key={`${active?.id}-${platform}-${days}-${evidenceTopic}-${evidenceIntent}`} initialTopic={evidenceTopic} initialIntent={evidenceIntent} apps={active ? [{ ...active, reviews: rows.map(row => row.review) }] : []} />}
    {view === 'compare' && <><div className="voicely-controls lab-compare-controls"><label>Compare with<select aria-label="Choose comparison app" value={comparison?.id || ''} onChange={event => setCompareId(event.target.value)}><option value="" disabled>Select another collected app</option>{real.filter(app => app.id !== active?.id).map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label><button className="voicely-button" onClick={onCompare}>Add an app <Plus /></button></div><p className="lab-notice">Compare sample patterns, not market share. App cohorts can differ in size, region and collection coverage.</p><div className="lab-dashboard-grid lab-comparison-grid">{[active, comparison].filter((app): app is WatchApp => !!app).map(app => {
      const cohort = filterReviews([app], filters, asOf), analyzed = cohort.filter(row => row.analysis), counts = new Map<string, number>();
      for (const row of analyzed) for (const name of new Set(row.analysis!.labels.map(label => label.topic.name))) counts.set(name, (counts.get(name) || 0) + 1);
      return <section className="lab-compare" key={app.id}><div className="flex gap-3 items-center">{app.icon && <img src={app.icon} alt="" className="w-11 h-11 rounded-lg" />}<h2>{app.name}</h2></div><p className="voicely-muted mt-3">{app.reviewCountry?.toUpperCase() || 'Region unverified'} · collected {new Date(app.syncedAt).toLocaleString()} · {app.partial ? 'partial sample' : app.reviewSource || 'unverified source'}</p><div className="voicely-metrics"><div><strong>{cohort.length}</strong><small>Sample reviews</small></div><div><strong>{analyzed.length}</strong><small>Classified</small></div><div><strong>{cohort.some(row => row.review.score) ? `${Math.round(cohort.filter(row => row.review.score && row.review.score <= 2).length / cohort.filter(row => row.review.score).length * 100)}%` : 'Unknown'}</strong><small>1-2 star share of rated sample</small></div></div>{[...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, count]) => <div className="lab-comparison-topic" key={name}><div className="voicely-toolbar"><span>{name}</span><span>{Math.round(count / analyzed.length * 100)}%</span></div><div className="lab-bar"><div style={{ width: `${count / analyzed.length * 100}%` }} /></div></div>)}{!analyzed.length && <p className="voicely-muted mt-4">No classified evidence in this scope.</p>}</section>;
    })}</div>{!comparison && <p className="voicely-muted mt-5">Collect another related app to compare.</p>}</>}
    {view === 'compare' && comparison && comparisonQuestion && <section className="lab-signals lab-compare-takeaway"><h2 className="voicely-panel-title">A differentiation question to test</h2><p>Can a narrower product solve "{comparisonQuestion.name}" more reliably for the users reporting this problem in {active?.name}?</p><p className="voicely-muted mt-3">{comparisonQuestion.complaint} complaint mentions and {comparisonQuestion.request} request mentions in the primary app's classified sample; a review may contain both. This is a research question, not a confirmed gap in {comparison.name}. Missing mentions do not mean a feature is absent.</p><p className="mt-3">Next test: observe the same task in both apps with affected users, then test the smallest alternative.</p><button className="voicely-button mt-4" onClick={() => { setEvidenceTopic(comparisonQuestion.id); setEvidenceIntent('all'); onNavigate('reviews'); }}>Inspect the reported problem<ArrowRight /></button></section>}
    {view === 'plans' && <><p className="lab-notice">Proposed pricing from the design prototype. New plans are not available for purchase; no existing subscription is changed.</p><div className="lab-theme-tabs" role="group" aria-label="Billing period"><button aria-pressed={!annual} onClick={() => setAnnual(false)}>Monthly</button><button aria-pressed={annual} onClick={() => setAnnual(true)}>Yearly</button></div><div className="lab-opportunity-grid">{[{ name: 'Free', price: 0, purpose: 'Discover a signal', items: ['Explore review samples', 'Save a decision to investigate'] }, { name: 'Indie Research', price: annual ? 15 : 19, purpose: 'Validate your next product move', items: ['Full evidence exploration', 'App comparison', 'Decision briefs and review exports'] }, { name: 'Team Intelligence', price: annual ? 79 : 99, purpose: 'Keep up with changing feedback', items: ['Planned: recurring monitoring', 'Planned: weekly briefs', 'Planned: theme-change alerts'] }].map(plan => <article className="lab-opportunity" key={plan.name}><h2>{plan.name}</h2><p>{plan.purpose}</p><strong className="lab-price">${plan.price}<small> / month</small></strong>{annual && plan.price > 0 && <p>${plan.price * 12} per year · proposed</p>}<ul className="space-y-3 mt-5 text-sm">{plan.items.map(item => <li key={item}>{item}</li>)}</ul><span className="lab-badge mt-6">Not yet on sale</span></article>)}</div></>}
    {selectedProblem && <LabDialog title="Investigate problem" onClose={() => setProblemId(null)}>
      <span className="lab-badge">{selectedProblem.topic}</span><h2 className="lab-detail-title">{selectedProblem.title}</h2>
      <p className="lab-notice">{selectedProblem.rows.length} supporting reviews in this sample. This establishes a reported issue, not market demand or willingness to pay.</p>
      <h3 className="voicely-panel-title">What users reported</h3>
      {selectedProblem.quotes.map(quote => <blockquote key={quote} className="lab-quote"><p>{quote}</p></blockquote>)}
      <details className="mt-4"><summary className="cursor-pointer text-teal-800">Read {selectedProblem.rows.length} original reviews</summary><ReviewExplorer apps={active ? [{ ...active, reviews: selectedProblem.rows.map(row => row.review) }] : []} /></details>
      <h3 className="voicely-panel-title">Possible next steps</h3>
      {opportunities.filter(op => problemHasEvidence(selectedProblem, op.evidence)).map(op => <section key={op.id} className="problem-direction">
        <h4>{op.title}</h4><p className="voicely-muted">Proposed interpretation · not yet validated</p>
        <p><strong>Who and when: </strong>{op.scenario}</p><p><strong>Possible solution: </strong>{op.proposal}</p><p><strong>Smallest experiment: </strong>{op.action}</p>
        <button className="voicely-button" onClick={() => { setProblemId(null); setDetailId(op.id); }}>Explore direction<ArrowRight /></button>
      </section>)}
      {!opportunities.some(op => problemHasEvidence(selectedProblem, op.evidence)) && <><p>No solution has been proposed for this problem yet.</p><p className="mt-3">Next investigation: ask an affected user to show when this happens, their current workaround, and the consequence. Establish whether it blocks an important task before designing a solution.</p></>}
    </LabDialog>}
    {detail && <LabDialog title="Opportunity brief" onClose={() => setDetailId(null)}>
      <span className="lab-badge">{detail.evidence.length ? 'Review-backed problem · solution unvalidated' : 'Exploratory · demand unverified'}</span><h2 className="lab-detail-title">{detail.title}</h2><p className="voicely-muted">{detail.proposal}</p>
      <h3 className="voicely-panel-title">Who and when</h3><p>{detail.scenario}</p><h3 className="voicely-panel-title">What people are telling you</h3><p>{detail.rationale}</p>
      {detail.evidence.map(ref => <blockquote key={ref.key} className="lab-quote"><p>{ref.quote}</p><small>{ref.appName} · {ref.country.toUpperCase()} · {ref.date}{ref.partial ? ' · limited sample' : ''}</small></blockquote>)}
      {!detail.evidence.length && <p className="lab-notice">No supporting review citations.</p>}
      {!!detailRows.length && <details className="mt-5"><summary className="cursor-pointer text-teal-800">Explore all {detailRows.length} reviews in related themes</summary><p className="voicely-muted mt-3">Same app and analysis period. Related themes are broader than the cited claim.</p><ReviewExplorer key={detail.id} apps={active ? [{ ...active, reviews: detailRows.map(row => row.review) }] : []} /></details>}
      <h3 className="voicely-panel-title">A test you can run</h3><p>{detail.action}</p>
      {detail.interviewQuestion && <><h3 className="voicely-panel-title">Interview question</h3><p>{detail.interviewQuestion}</p></>}
      <h3 className="voicely-panel-title">Success criterion</h3><p>{detail.success || 'Not defined yet.'}</p>
      <h3 className="voicely-panel-title">Keep scope small</h3><p>{detail.scopeLimit || 'Not defined yet.'}</p>
      <h3 className="voicely-panel-title">What would change this direction</h3><p>{detail.changeMind || 'Not defined yet.'}</p>
      <p className="lab-notice">{detail.uncertainty}</p><div className="voicely-toolbar"><button disabled={busy || detail.saved} className="voicely-button primary" onClick={detail.save}><Bookmark />{detail.saved ? 'Saved to decision board' : 'Save to decision board'}</button><button className="voicely-button" onClick={() => { setDetailId(null); onNavigate('board'); }}>Open decision board<ArrowRight /></button><button className="voicely-button" onClick={detail.exportBrief}><Download />Export brief</button></div>
    </LabDialog>}
  </>;
}
