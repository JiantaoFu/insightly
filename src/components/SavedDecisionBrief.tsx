import { Download } from 'lucide-react';
import { LabDialog } from './LabWorkspace';
import { opportunityMarkdown, type SavedOpportunity } from '../utils/marketOpportunities';
import { downloadFile } from '../utils/download';

export default function SavedDecisionBrief({ item, onClose }: { item: SavedOpportunity; onClose: () => void }) {
  const op = item.opportunity;
  return <LabDialog title="Saved opportunity brief" onClose={onClose}>
    <h2 className="lab-detail-title">{op.title}</h2>
    <p className="voicely-muted">Saved {new Date(item.savedAt).toLocaleDateString()} · last {item.report.days} days · original analysis snapshot</p>
    {[
      ['Proposed direction', op.hypothesis], ['Who and when', op.scenario], ['Reported obstacle', op.obstacle],
      ['Consequence to verify', op.consequence], ['Who to speak with', op.nextWho], ['Interview question', op.nextQuestion],
      ['Smallest experiment', item.experiment ?? op.nextExperiment], ['Success criterion', item.success || 'Not defined yet.'],
      ['Keep scope small', item.scopeLimit || 'Not defined yet.'], ['What would change this direction', item.changeMind || 'Not defined yet.'],
      ['Findings & notes', item.notes || 'No findings recorded.'],
    ].map(([title, content]) => <section key={title} className="mt-5"><h3 className="voicely-panel-title">{title}</h3><p className="whitespace-pre-wrap break-words">{content}</p></section>)}
    <p className="lab-notice">{op.unknowns.join(' ')}</p>
    <h3 className="voicely-panel-title">Original evidence</h3>
    {item.report.evidence.filter(ref => op.evidenceKeys.includes(ref.key)).map(ref => <blockquote key={ref.key} className="lab-quote"><p>{ref.quote}</p><small>{ref.appName} · {ref.country.toUpperCase()} · {ref.date}</small></blockquote>)}
    <button className="voicely-button mt-4" onClick={() => downloadFile('voicely-opportunity.md', opportunityMarkdown(item), 'text/markdown;charset=utf-8')}><Download />Export saved brief</button>
  </LabDialog>;
}
