import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, MessageSquare } from 'lucide-react';
import type { WatchApp } from '../utils/marketIntelligence';
import { filterReviews, reviewsCsv, type ReviewFilters } from '../utils/reviewExplorer';
import { downloadFile } from '../utils/download';
import { storeAppKey } from '../utils/marketResearchFlow';

export default function ReviewExplorer({ apps }: { apps: WatchApp[] }) {
  const [filters, setFilters] = useState<ReviewFilters>({ appId: 'all', platform: 'all', days: 0, query: '', intent: 'all' });
  const [page, setPage] = useState(0);
  const rows = useMemo(() => filterReviews(apps, filters), [apps, filters]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 20)), current = Math.min(page, pageCount - 1);
  const update = (patch: Partial<ReviewFilters>) => { setFilters(value => ({ ...value, ...patch })); setPage(0); };
  return <section>
    <h2 className="voicely-panel-title">Hear the problem in their own words.</h2>
    <p className="voicely-muted">Collected store reviews for this research. Coverage varies by app and region.</p>
    <div className="voicely-controls">
      <label className="voicely-search">Search reviews<input type="search" value={filters.query} onChange={event => update({ query: event.target.value })} placeholder="Search review text..." /></label>
      <label>Feedback<select value={filters.intent} onChange={event => update({ intent: event.target.value })}><option value="all">All feedback</option><option value="complaint">Complaints</option><option value="request">Requests</option><option value="praise">Praise</option><option value="unclassified">Not classified</option></select></label>
    </div>
    <div className="voicely-toolbar"><p role="status">{rows.length} matching reviews</p><button disabled={!rows.length} className="voicely-button" onClick={() => downloadFile('voicely-reviews.csv', reviewsCsv(rows), 'text/csv;charset=utf-8')}><Download />Export filtered reviews</button></div>
    {!rows.length && <div className="voicely-empty"><MessageSquare /><h3 className="font-medium">No reviews match this selection.</h3><p className="voicely-muted mt-2">No matching data is not evidence that a problem does not exist.</p><button className="voicely-button mt-4" onClick={() => update({ appId: 'all', platform: 'all', days: 0, query: '', intent: 'all' })}>Clear filters</button></div>}
    {rows.slice(current * 20, current * 20 + 20).map(({ app, review, index, analysis }) => <article className="voicely-review" key={`${app.id}-${review.id || index}`}>
      <div className="voicely-review-meta">{app.icon && <img src={app.icon} alt="" className="w-6 h-6 rounded" />}<strong>{app.name}</strong><span>{app.platform === 'ios' ? 'App Store' : 'Google Play'}</span><span>{app.reviewCountry?.toUpperCase() || 'Region unverified'}</span><span>{review.score ? `${review.score} / 5` : 'Unrated'}</span><span>{Number.isFinite(Date.parse(review.date || review.timestamp || '')) ? new Date(review.date || review.timestamp!).toLocaleDateString() : 'Undated'}</span></div>
      <blockquote>{review.text}</blockquote>
      <div className="voicely-topics">{analysis?.labels.map((label, i) => <span key={i}>{label.topic.name} · {label.intent}</span>) || <span>Not classified</span>}</div>
      <div className="voicely-review-meta mt-3"><span>{app.reviewSource === 'review-feed' ? 'Review feed sample' : 'Limited or unverified sample'}{app.partial ? ' · partial collection' : ''}</span>{storeAppKey(app.url) && <a className="text-teal-800 underline" href={app.url} target="_blank" rel="noreferrer">Store listing</a>}</div>
    </article>)}
    <div className="voicely-toolbar"><span>Page {current + 1} of {pageCount}</span><div className="flex gap-2"><button className="voicely-button" aria-label="Previous reviews" title="Previous reviews" disabled={!current} onClick={() => setPage(current - 1)}><ArrowLeft /></button><button className="voicely-button" aria-label="Next reviews" title="Next reviews" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}><ArrowRight /></button></div></div>
  </section>;
}
