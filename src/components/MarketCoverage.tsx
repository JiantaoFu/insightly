import { Download } from 'lucide-react';
import { requestedCountry, WatchApp } from '../utils/marketIntelligence';
import { downloadFile } from '../utils/download';

const sourceName = (source?: string) => source === 'store-page-sample' ? 'Limited webpage sample' : source === 'review-feed' ? 'Review feed sample' : 'Unverified';

const MarketCoverage = ({ apps }: { apps: WatchApp[] }) => {
  const realApps = apps.filter(app => !app.sample);
  const observations = realApps.flatMap(app => (app.syncHistory || []).map(run => ({ app, run })))
    .sort((a, b) => b.run.finishedAt.localeCompare(a.run.finishedAt));
  const successful = observations.filter(item => item.run.status === 'success').length;
  return <section className="border-t border-gray-200 mt-6 pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold text-gray-900">Data quality log</h3>
      <button disabled={!observations.length} onClick={() => downloadFile('insightly-data-quality.json', JSON.stringify({
        generatedAt: new Date().toISOString(), mode: 'manual-browser-observations',
        retention: 'Last 20 sync attempts per app. No automated monitoring or completeness guarantee.',
        apps: realApps.map(app => ({ name: app.name, url: app.url, platform: app.platform, requestedCountry: requestedCountry(app.url),
          country: app.reviewCountry || null, savedReviews: app.reviews.length, lastSuccessfulSync: app.syncedAt, observations: app.syncHistory || [] })),
      }, null, 2), 'application/json')} className="inline-flex items-center gap-2 text-sm px-3 py-2 border border-gray-300 rounded disabled:opacity-40"><Download className="w-4 h-4" />Export quality log</button>
    </div>
    <p className="text-sm text-gray-600 mt-3">{observations.length} recorded attempts · {successful} succeeded · {observations.length - successful} failed</p>
    <p className="text-xs text-gray-500 mt-1">Manual sync history · up to 20 attempts per app · older syncs not reconstructed · success does not establish completeness</p>
    {!realApps.length && <p className="text-sm text-gray-500 mt-4">Illustrative apps have no real sync history.</p>}
    {realApps.map(app => {
      const history = app.syncHistory || [];
      const latest = history[history.length - 1];
      return <details key={app.id} className="py-4 border-b border-gray-200">
        <summary className="cursor-pointer text-sm font-medium break-words">{app.name} <span className={`font-normal ml-2 ${latest?.status === 'failed' ? 'text-red-700' : 'text-gray-500'}`}>{latest ? latest.status === 'failed' ? 'Latest attempt failed' : latest.fetched === 0 ? 'Latest attempt returned no data' : sourceName(latest.source) : 'No recorded attempts'}</span></summary>
        <p className="text-xs text-gray-500 mt-3">Requested region: {requestedCountry(app.url).toUpperCase()} · saved review region: {app.reviewCountry?.toUpperCase() || 'Unverified'}</p>
        {history.length === 0 && <p className="text-sm text-gray-500 mt-2">Previous reviews retained. No historical sync measurements are available.</p>}
        {[...history].reverse().map((run, index) => <div key={`${run.startedAt}-${index}`} className="mt-3 pl-3 border-l-2 border-gray-200 text-sm">
          <p className="text-gray-700">{new Date(run.finishedAt).toLocaleString()} · {run.kind === 'baseline' ? 'Initial baseline' : 'Refresh'} · {run.status} · {Math.max(0, Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000))}s</p>
          {run.status === 'failed' ? <div className="mt-1"><p className="text-red-700 break-words">{run.error} Previous reviews retained.</p>{run.country && <p className="text-xs text-gray-500 mt-1">Returned region: {run.country.toUpperCase()}</p>}</div> : <>
            <p className="text-gray-600 mt-1">{run.fetched} returned · {run.discovered} first discovered · {run.updated} updated · {run.undated} undated · {run.futureDated} future-dated</p>
            <p className="text-xs text-gray-500 mt-1">{sourceName(run.source)} · {run.country?.toUpperCase() || 'Region unverified'}{run.partial ? ' · partial coverage' : ''}{run.limitReached ? ' · collection limit reached' : ''}</p>
            <p className="text-xs text-gray-500 mt-1">Returned date range: {run.oldestDate ? new Date(run.oldestDate).toLocaleDateString() : 'Unknown'} to {run.newestDate ? new Date(run.newestDate).toLocaleDateString() : 'Unknown'}</p>
          </>}
        </div>)}
      </details>;
    })}
  </section>;
};

export default MarketCoverage;
