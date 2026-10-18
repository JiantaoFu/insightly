import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Bookmark, Check, Download, MessageSquare, Plus, Sparkles, X } from 'lucide-react';
import type { ResearchProject } from '../utils/researchProjects';
import { getReviewAnalysis, type WatchApp } from '../utils/marketIntelligence';
import { filterReviews } from '../utils/reviewExplorer';
import { saveDecisionPlan, decisionPlanMarkdown } from '../utils/decisionResearch';
import { saveOpportunitySnapshot, opportunityMarkdown, type OpportunityEvidence } from '../utils/marketOpportunities';
import { downloadFile } from '../utils/download';
import type { WorkspaceView } from './VoicelyShell';
import ReviewExplorer from './ReviewExplorer';

interface LabOpportunity { id: string; title: string; proposal: string; scenario: string; rationale: string; uncertainty: string; action: string; changeMind: string; evidence: OpportunityEvidence[]; saved: boolean; save: () => void; exportBrief: () => void }
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
  const [theme, setTheme] = useState(''), [kind, setKind] = useState('complaint'), [opFilter, setOpFilter] = useState('all');
  const [detailId, setDetailId] = useState<string | null>(null), [compareId, setCompareId] = useState('');
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
    opportunities.push({ id: op.id, title: op.title, proposal: op.hypothesis, scenario: op.scenario, rationale: op.obstacle,
      uncertainty: op.unknowns.join(' '), action: op.nextExperiment, changeMind: op.nextQuestion,
      evidence: from.evidence.filter(ref => op.evidenceKeys.includes(ref.key)), saved: project.saved.some(item => item.opportunity.id === op.id && item.report.inputKey === from.inputKey),
      save: () => onChange({ saved: saveOpportunitySnapshot(project.saved, op, from) }),
      exportBrief: () => downloadFile('voicely-opportunity.md', opportunityMarkdown(saveOpportunitySnapshot([], op, from)[0]), 'text/markdown;charset=utf-8') });
  }
  const priority = opportunities[0], detail = opportunities.find(op => op.id === detailId);
  const chosenTheme = themes.find(item => item.id === theme) || themes[0];
  const series = Array.from({ length: 6 }, (_, index) => {
    const end = asOf - (5 - index) * 7 * 86400000, start = end - 7 * 86400000;
    const week = classified.filter(({ review }) => { const date = Date.parse(review.date || review.timestamp || ''); return date > start && date <= end; });
    const mentions = week.filter(row => row.analysis?.labels.some(label => label.topic.id === chosenTheme?.id)).length;
    return { label: new Date(end).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), count: week.length, share: week.length ? mentions / week.length * 100 : null };
  });
  const card = (op: LabOpportunity) => <article className="lab-opportunity" key={op.id}>
    <div className="voicely-toolbar mt-0"><span className={`lab-badge ${op.evidence.length ? '' : 'amber'}`}>{op.evidence.length ? 'Review-backed problem' : 'Exploratory direction'}</span><button disabled={busy || op.saved} className="voicely-button" aria-label={`Save ${op.title}`} title={op.saved ? 'Saved' : 'Save opportunity'} onClick={op.save}>{op.saved ? <Check /> : <Bookmark />}</button></div>
    <h3>{op.title}</h3><p>{op.proposal}</p><footer><span>{new Set(op.evidence.map(ref => ref.reviewKey)).size} cited reviews</span><button className="voicely-button" onClick={() => setDetailId(op.id)}>Explore <ArrowRight /></button></footer>
  </article>;
  const appStrip = <section className="lab-app-strip" aria-label="Analysis scope">
    <div className="flex items-center gap-3 min-w-0">{active?.icon ? <img src={active.icon} alt="" className="w-11 h-11 rounded-lg" /> : <MessageSquare className="w-8 h-8 text-teal-800 shrink-0" />}
      {active ? <button disabled={busy} onClick={onAnalyze} className="text-left min-w-0" aria-label="Change app"><strong className="block break-words">{active.name}</strong><span className="voicely-muted">{active.developer} · {active.platform === 'ios' ? 'App Store' : 'Google Play'} · {active.reviewCountry?.toUpperCase()}</span></button> : <button disabled={busy} onClick={onAnalyze} className="voicely-button">Choose an app <Plus /></button>}</div>
    <div className="flex flex-wrap gap-3"><label>Time range<select aria-label="Time range" disabled={busy || !active} value={days} onChange={event => onDaysChange(Number(event.target.value))}><option value={90}>Last 90 days</option><option value={30}>Last 30 days</option></select></label>{project.report && <span className="voicely-muted self-end">Analyzed {new Date(project.report.generatedAt).toLocaleDateString()}</span>}</div>
  </section>;
  return <>
    {['next', 'reviews', 'opportunities', 'compare'].includes(view) && appStrip}
    {view === 'next' && <>
      {opportunities.length > 0 && <p className="voicely-muted mt-4">{active?.name} · last {days} days · opportunities and evidence from the same completed analysis.</p>}
      <section className="voicely-metrics"><div><p>Reviews in scope</p><strong>{rows.length}</strong><small>Collected sample</small></div><div><p>Sample average</p><strong>{rows.some(row => row.review.score) ? (rows.reduce((n, row) => n + (row.review.score || 0), 0) / rows.filter(row => row.review.score).length).toFixed(1) : '—'}</strong><small>Out of 5</small></div><div><p>Pain-point reviews</p><strong>{classified.filter(row => row.analysis?.labels.some(label => label.intent === 'complaint')).length}</strong><small>{classified.length} classified in scope</small></div><div><p>Product opportunities</p><strong>{opportunities.length}</strong><small>Saved research snapshot</small></div></section>
      <div className="lab-dashboard-grid"><section className="lab-priority"><span className="lab-eyebrow"><Sparkles />Your priority to investigate</span><h2>{priority?.title || 'Your next move starts with a real signal.'}</h2><p>{priority?.proposal || 'No research result yet.'}</p>{priority && <p className="voicely-muted mt-4">{priority.evidence.length ? `${new Set(priority.evidence.map(ref => ref.reviewKey)).size} cited reviews · proposed solution unvalidated` : 'Exploratory suggestion · demand unverified'}</p>}<div className="voicely-toolbar"><button className="voicely-button primary" onClick={() => priority ? setDetailId(priority.id) : onAnalyze()}>{priority ? 'Explore the opportunity' : 'Analyze an app'}<ArrowRight /></button>{priority && <button disabled={busy || priority.saved} className="voicely-button" aria-label="Save priority opportunity" title="Save priority opportunity" onClick={priority.save}>{priority.saved ? <Check /> : <Bookmark />}</button>}</div></section>
      <section className="lab-signal"><h2>A signal worth watching</h2><p className="voicely-muted">Weekly share of classified reviews mentioning a theme</p><div className="lab-theme-tabs">{themes.slice(0, 3).map(item => <button key={item.id} aria-pressed={chosenTheme?.id === item.id} onClick={() => setTheme(item.id)}>{item.name}</button>)}</div>
        {chosenTheme ? <><div className="lab-chart" role="img" aria-label={`Weekly observed sample share for ${chosenTheme.name}`}>
          {series.map((week, index) => <div key={index} className="lab-chart-column"><span>{week.share === null ? 'No data' : `${Math.round(week.share)}%`}</span><div className="lab-chart-track"><div style={{ height: `${week.share || 0}%` }} /></div><small>{week.label}</small><small>n={week.count}</small></div>)}
        </div><p className="voicely-muted">{active?.partial || active?.reviewSource !== 'review-feed' ? 'Partial sample: no trend conclusion.' : 'Observed sample only. Changes in collection or classification can change the chart.'}</p></> : <div className="voicely-empty"><p className="voicely-muted">No classified themes in this scope yet.</p></div>}
      </section></div>
      <div className="voicely-toolbar"><div><h2 className="voicely-panel-title">Opportunities. One next step.</h2><p className="voicely-muted">Saved research with traceable evidence and a way to test it.</p></div><button className="voicely-button" onClick={() => onNavigate('opportunities')}>View all <ArrowRight /></button></div><div className="lab-opportunity-grid">{opportunities.slice(0, 3).map(card)}</div>
      <section className="lab-signals"><h2 className="voicely-panel-title">Listen to what keeps coming up</h2><div className="lab-theme-tabs" role="group" aria-label="Review themes">{[['complaint', 'Pain points'], ['request', 'Feature requests'], ['praise', 'What users love']].map(([id, label]) => <button key={id} aria-pressed={kind === id} onClick={() => setKind(id)}>{label}</button>)}</div>
        <div className="overflow-x-auto"><table className="lab-table"><thead><tr><th>Theme</th><th>Mentions</th><th>Classified sample share</th><th>Evidence</th></tr></thead><tbody>{themes.filter(item => item[kind as 'complaint' | 'request' | 'praise'] > 0).map(item => <tr key={item.id}><td>{item.name}</td><td>{item[kind as 'complaint' | 'request' | 'praise']}</td><td>{Math.round(item[kind as 'complaint' | 'request' | 'praise'] / classified.length * 100)}%</td><td><button className="text-teal-800 underline" onClick={() => { setEvidenceTopic(item.id); onNavigate('reviews'); }}>See evidence</button></td></tr>)}</tbody></table></div>{!themes.length && <p className="voicely-muted py-4">No classified evidence yet.</p>}
      </section>
    </>}
    {view === 'opportunities' && <><p className="lab-notice">{active ? `${active.name} · last ${days} days. ` : ''}Evidence-backed problems, proposed solutions. Demand and outcomes still need validation.</p><div className="lab-theme-tabs" role="group" aria-label="Opportunity type">{[['all', 'All opportunities'], ['backed', 'Review-backed'], ['exploratory', 'Exploratory']].map(([id, label]) => <button key={id} aria-pressed={opFilter === id} onClick={() => setOpFilter(id)}>{label}</button>)}</div><div className="lab-opportunity-grid">{opportunities.filter(op => opFilter === 'all' || (opFilter === 'backed' ? op.evidence.length > 0 : !op.evidence.length)).map(card)}</div>{!opportunities.length && <div className="voicely-empty"><Sparkles /><h2>No researched opportunities yet.</h2><button className="voicely-button primary mt-4" onClick={onAnalyze}>Analyze an app <ArrowRight /></button></div>}</>}
    {view === 'reviews' && <>{evidenceTopic && <div className="voicely-toolbar"><p className="voicely-muted">Theme: {themes.find(item => item.id === evidenceTopic)?.name || 'Selected theme'}</p><button className="voicely-button" onClick={() => setEvidenceTopic('')}>Clear theme filter<X /></button></div>}<ReviewExplorer key={`${active?.id}-${platform}-${days}-${evidenceTopic}`} apps={active ? [{ ...active, reviews: rows.map(row => row.review).filter(review => !evidenceTopic || getReviewAnalysis(review)?.labels.some(label => label.topic.id === evidenceTopic)) }] : []} /></>}
    {view === 'compare' && <><div className="voicely-controls"><label>Compare with<select aria-label="Choose comparison app" value={comparison?.id || ''} onChange={event => setCompareId(event.target.value)}><option value="" disabled>Select another collected app</option>{real.filter(app => app.id !== active?.id).map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label><button className="voicely-button" onClick={onCompare}>Add an app <Plus /></button></div><p className="lab-notice">Compare sample patterns, not market share. App cohorts can differ in size, region and collection coverage.</p><div className="lab-dashboard-grid">{[active, comparison].filter((app): app is WatchApp => !!app).map(app => {
      const cohort = filterReviews([app], filters, asOf), analyzed = cohort.filter(row => row.analysis), counts = new Map<string, number>();
      for (const row of analyzed) for (const name of new Set(row.analysis!.labels.map(label => label.topic.name))) counts.set(name, (counts.get(name) || 0) + 1);
      return <section className="lab-compare" key={app.id}><div className="flex gap-3 items-center">{app.icon && <img src={app.icon} alt="" className="w-11 h-11 rounded-lg" />}<h2>{app.name}</h2></div><div className="voicely-metrics"><div><strong>{cohort.length}</strong><small>Sample reviews</small></div><div><strong>{analyzed.length}</strong><small>Classified</small></div></div>{[...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, count]) => <div className="lab-comparison-topic" key={name}><div className="voicely-toolbar"><span>{name}</span><span>{Math.round(count / analyzed.length * 100)}%</span></div><div className="lab-bar"><div style={{ width: `${count / analyzed.length * 100}%` }} /></div></div>)}{!analyzed.length && <p className="voicely-muted mt-4">No classified evidence in this scope.</p>}</section>;
    })}</div>{!comparison && <p className="voicely-muted mt-5">Collect another related app to compare.</p>}</>}
    {view === 'plans' && <><p className="lab-notice">Proposed pricing from the design prototype. New plans are not available for purchase; no existing subscription is changed.</p><div className="lab-theme-tabs" role="group" aria-label="Billing period"><button aria-pressed={!annual} onClick={() => setAnnual(false)}>Monthly</button><button aria-pressed={annual} onClick={() => setAnnual(true)}>Yearly</button></div><div className="lab-opportunity-grid">{[{ name: 'Free', price: 0, purpose: 'Discover a signal', items: ['Explore review samples', 'Save a decision to investigate'] }, { name: 'Indie Research', price: annual ? 15 : 19, purpose: 'Validate your next product move', items: ['Full evidence exploration', 'App comparison', 'Decision briefs and review exports'] }, { name: 'Team Intelligence', price: annual ? 79 : 99, purpose: 'Keep up with changing feedback', items: ['Planned: recurring monitoring', 'Planned: weekly briefs', 'Planned: theme-change alerts'] }].map(plan => <article className="lab-opportunity" key={plan.name}><h2>{plan.name}</h2><p>{plan.purpose}</p><strong className="lab-price">${plan.price}<small> / month</small></strong>{annual && plan.price > 0 && <p>${plan.price * 12} per year · proposed</p>}<ul className="space-y-3 mt-5 text-sm">{plan.items.map(item => <li key={item}>{item}</li>)}</ul><span className="lab-badge mt-6">Not yet on sale</span></article>)}</div></>}
    {detail && <LabDialog title="Opportunity brief" onClose={() => setDetailId(null)}><span className="lab-badge">{detail.evidence.length ? 'Review-backed problem · solution unvalidated' : 'Exploratory · demand unverified'}</span><h2 className="lab-detail-title">{detail.title}</h2><p className="voicely-muted">{detail.proposal}</p><h3 className="voicely-panel-title">Who and when</h3><p>{detail.scenario}</p><h3 className="voicely-panel-title">What people are telling you</h3><p>{detail.rationale}</p>{detail.evidence.map(ref => <blockquote key={ref.key} className="lab-quote"><p>{ref.quote}</p><small>{ref.appName} · {ref.country.toUpperCase()} · {ref.date}{ref.partial ? ' · limited sample' : ''}</small></blockquote>)}{!detail.evidence.length && <p className="lab-notice">No supporting review citations.</p>}<h3 className="voicely-panel-title">A test you can run</h3><p>{detail.action}</p><h3 className="voicely-panel-title">What would change this direction</h3><p>{detail.changeMind}</p><p className="lab-notice">{detail.uncertainty}</p><div className="voicely-toolbar"><button disabled={busy || detail.saved} className="voicely-button primary" onClick={detail.save}><Bookmark />{detail.saved ? 'Saved to decision board' : 'Save to decision board'}</button><button className="voicely-button" onClick={detail.exportBrief}><Download />Export brief</button></div></LabDialog>}
  </>;
}
