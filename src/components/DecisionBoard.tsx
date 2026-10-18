import { Bookmark, Download, Trash2 } from 'lucide-react';
import { decisionPlanMarkdown, type DecisionPlan } from '../utils/decisionResearch';
import { downloadFile } from '../utils/download';
import { opportunityMarkdown, type SavedOpportunity } from '../utils/marketOpportunities';

export default function DecisionBoard({ plans, onChange, busy, legacy, onLegacyChange }: { plans: DecisionPlan[]; onChange: (plans: DecisionPlan[]) => void; busy: boolean; legacy: SavedOpportunity[]; onLegacyChange: (saved: SavedOpportunity[]) => void }) {
  const update = (id: string, patch: Partial<DecisionPlan>) => onChange(plans.map(plan => plan.id === id ? { ...plan, ...patch } : plan));
  return <section>
    <div className="voicely-toolbar"><div><h2 className="voicely-panel-title">Turn a direction into a small test.</h2><p className="voicely-muted">{plans.length + legacy.length} saved decisions. Status reflects your assessment, not a model verdict.</p></div>
      <button className="voicely-button" disabled={!plans.length && !legacy.length} onClick={() => downloadFile('voicely-decision-board.md', [...plans.map(decisionPlanMarkdown), ...legacy.map(opportunityMarkdown)].join('\n\n---\n\n'), 'text/markdown;charset=utf-8')}><Download />Export board</button></div>
    {!plans.length && !legacy.length && <div className="voicely-empty"><Bookmark /><h3 className="font-medium">No decisions saved yet.</h3><p className="voicely-muted mt-2">Saved research directions and their evidence will appear here.</p></div>}
    {plans.map(plan => {
      const direction = plan.report.result.directions![plan.directionIndex];
      return <article className="voicely-plan" key={plan.id}>
        <div className="voicely-toolbar"><h3>{direction.title}</h3><button className="voicely-button" disabled={busy} aria-label={`Remove decision ${direction.title}`} title="Remove from decision board" onClick={() => { if (window.confirm('Remove this decision and its notes? The original research will remain.')) onChange(plans.filter(item => item.id !== plan.id)); }}><Trash2 /></button></div>
        <p className="mt-3">{direction.proposal}</p><p className="voicely-muted mt-2">{direction.uncertainty}</p>
        <div className="voicely-plan-fields">
          <label>Status<select disabled={busy} aria-label={`Decision status for ${direction.title}`} value={plan.stage} onChange={event => update(plan.id, { stage: event.target.value as DecisionPlan['stage'] })}><option value="saved">To investigate</option><option value="testing">Testing</option><option value="supported">Supported by my validation</option><option value="set-aside">Set aside</option></select></label>
          <label>Success criterion<textarea disabled={busy} maxLength={4000} value={plan.success} onChange={event => update(plan.id, { success: event.target.value })} placeholder="What result would support this direction?" /></label>
          <label>Smallest experiment<textarea disabled={busy} maxLength={4000} value={plan.experiment} onChange={event => update(plan.id, { experiment: event.target.value })} /></label>
          <label>Findings &amp; notes<textarea disabled={busy} maxLength={4000} value={plan.notes} onChange={event => update(plan.id, { notes: event.target.value })} /></label>
        </div>
        <details className="mt-4 text-sm"><summary className="cursor-pointer text-teal-800">Saved evidence &amp; decision limits</summary><p className="mt-3">What would change this direction: {direction.changeMind}</p>
          {!direction.evidenceKeys.length && <p className="mt-3 text-amber-800">No supporting review citations. This is an exploratory suggestion.</p>}
          {plan.report.evidence.filter(ref => direction.evidenceKeys.includes(ref.key)).map(ref => <blockquote key={ref.key} className="border-l-2 border-gray-300 pl-3 mt-3"><p>{ref.quote}</p><p className="voicely-muted">{ref.appName} · {ref.country.toUpperCase()} · {ref.date}</p></blockquote>)}
        </details>
      </article>;
    })}
    {legacy.map(item => <article className="voicely-plan" key={item.opportunity.id}>
      <div className="voicely-toolbar"><h3>{item.opportunity.title}</h3><button className="voicely-button" disabled={busy} title="Remove decision" aria-label={`Remove decision ${item.opportunity.title}`} onClick={() => { if (window.confirm('Remove this saved decision and its notes?')) onLegacyChange(legacy.filter(other => other.opportunity.id !== item.opportunity.id)); }}><Trash2 /></button></div>
      <p className="mt-3">{item.opportunity.hypothesis}</p><p className="voicely-muted mt-2">Next test: {item.opportunity.nextExperiment}</p>
      <div className="voicely-plan-fields"><label>Status<select disabled={busy} aria-label={`Decision status for ${item.opportunity.title}`} value={item.stage} onChange={event => onLegacyChange(legacy.map(other => other.opportunity.id === item.opportunity.id ? { ...other, stage: event.target.value as SavedOpportunity['stage'] } : other))}><option value="saved">To investigate</option><option value="interview">Interview planned</option><option value="prototype">Testing a prototype</option><option value="archived">Set aside</option></select></label><label>Findings &amp; notes<textarea disabled={busy} maxLength={4000} value={item.notes || ''} onChange={event => onLegacyChange(legacy.map(other => other.opportunity.id === item.opportunity.id ? { ...other, notes: event.target.value } : other))} /></label></div>
      <details className="mt-4 text-sm"><summary className="cursor-pointer text-teal-800">Saved evidence &amp; decision limits</summary><p className="voicely-muted mt-3">Saved {new Date(item.savedAt).toLocaleDateString()} · last {item.report.days} days · {item.opportunity.unknowns.join(' ')}</p>{item.report.evidence.filter(ref => item.opportunity.evidenceKeys.includes(ref.key)).map(ref => <blockquote key={ref.key} className="lab-quote"><p>{ref.quote}</p><small>{ref.appName} · {ref.country.toUpperCase()} · {ref.date}</small></blockquote>)}</details>
    </article>)}
  </section>;
}
