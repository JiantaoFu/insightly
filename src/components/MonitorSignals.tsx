import { Download } from 'lucide-react';
import { buildMarketSignals, getAppCoverage, type WatchApp } from '../utils/marketIntelligence';
import { downloadFile } from '../utils/download';

export default function MonitorSignals({ app, threshold }: { app: WatchApp; threshold: number }) {
  const now = new Date();
  const coverage = getAppCoverage(app, 7, now);
  const signals = buildMarketSignals([app], 7, now).slice(0, 3);
  const summary = signals.map(signal => `${signal.topic}: ${signal.currentMentions} mentions this week; ${signal.previousMentions} last week. ${signal.changePp === null ? `Change withheld: ${signal.comparisonReason}.` : `${signal.changePp > 0 ? '+' : ''}${signal.changePp} percentage points in sample share.`}`);
  return <section className="mt-4">
    <div className="voicely-toolbar"><h3 className="font-medium">Weekly signal preview</h3><button className="voicely-button" onClick={() => downloadFile('voicely-weekly-brief.md', [
      `# ${app.name}: weekly feedback brief`, `Generated: ${now.toISOString()}`, `Last collection: ${app.syncedAt}`, `Region: ${app.reviewCountry || 'Unverified'}`,
      '', 'Local snapshot, not live monitoring. No email sent. Sample patterns do not establish market-wide demand.',
      `Current / previous week: ${coverage.current.length} / ${coverage.previous.length} dated reviews.`,
      ...summary, '', coverage.reason || 'Comparable observed samples; not a statistical significance test.',
      '', 'Next check: inspect the original reviews and validate the workflow with affected users.',
    ].join('\n\n'), 'text/markdown;charset=utf-8')}><Download />Export weekly brief</button></div>
    <p className="voicely-muted">Last 7 days vs preceding 7 days · {coverage.current.length} / {coverage.previous.length} dated reviews</p>
    {signals.map(signal => <div className="py-3 border-b" key={signal.key}><strong>{signal.topic}</strong><p>{signal.currentMentions} current mentions · {signal.previousMentions} previous mentions</p><p className="voicely-muted">{signal.changePp === null ? `Comparison withheld: ${signal.comparisonReason}` : `${signal.changePp > 0 ? '+' : ''}${signal.changePp} pp in sample share · ${signal.changePp >= threshold ? 'Review threshold reached' : 'Below review threshold'}`}</p></div>)}
    {!signals.length && <p className="voicely-muted mt-3">No classified themes in these two weeks. {coverage.reason}</p>}
  </section>;
}
