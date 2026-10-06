import type { DecisionReport } from '../utils/decisionResearch';
import { storeAppKey } from '../utils/marketResearchFlow';

export default function DecisionEvidence({ report }: { report: DecisionReport | null }) {
  if (!report) return <p className="py-6 text-sm text-gray-600">No next-step research has been generated yet. Collected reviews are available in Source management.</p>;
  return <section className="py-6 min-w-0">
    <h2 className="text-lg font-semibold">Evidence behind your saved suggestions</h2>
    <p className="mt-2 text-sm text-gray-600">Saved {new Date(report.generatedAt).toLocaleString()} · {new Set(report.evidence.map(item => item.reviewKey)).size} reviews considered · {report.appKeys.length} apps · {report.days}-day window</p>
    <p className="mt-3 text-sm text-amber-800">{report.basis === 'context' ? 'Based on your description only. No review evidence establishes demand.' : 'Public review sample, not market validation. Growth causes and willingness to pay remain unverified.'}</p>
    {!!report.result.directions?.length && <div className="mt-5">{report.result.directions.map((direction, index) => <section key={index} className="py-4 border-b border-gray-200">
      <h3 className="font-medium break-words">{direction.title}</h3>
      <p className="mt-2 text-sm break-words">{direction.rationale}</p>
      <p className="mt-2 text-sm text-gray-600 break-words">{direction.uncertainty}</p>
      <div className="mt-2 text-xs text-teal-800 flex flex-wrap gap-3">{direction.evidenceKeys.length ? direction.evidenceKeys.map(key => {
        const number = report.evidence.findIndex(ref => ref.key === key) + 1;
        return <a key={key} href={`#saved-evidence-${number}`} className="underline">Evidence {number}</a>;
      }) : 'Exploratory suggestion without supporting review citations'}</div>
    </section>)}</div>}
    <h3 className="mt-6 font-medium">Original excerpts used in this result</h3>
    {!report.evidence.length && <p className="mt-3 text-sm text-gray-500">No review excerpts were used.</p>}
    {report.evidence.map((ref, index) => <blockquote id={`saved-evidence-${index + 1}`} key={ref.key} className="mt-4 border-l-2 border-gray-300 pl-3 text-sm scroll-mt-24">
      <p className="text-xs text-gray-500 break-words">Evidence {index + 1} · {ref.appName} · {ref.country.toUpperCase()} · {ref.date ? new Date(ref.date).toLocaleDateString() : 'Undated'}{ref.partial ? ' · limited sample' : ''}</p>
      <p className="mt-2 whitespace-pre-wrap break-words">{ref.quote}</p>
      {!!storeAppKey(ref.appUrl) && <a href={ref.appUrl} target="_blank" rel="noreferrer" className="inline-block mt-2 text-teal-800">Store listing</a>}
    </blockquote>)}
  </section>;
}
