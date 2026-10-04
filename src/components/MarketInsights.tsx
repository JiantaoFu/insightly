import { useMemo, useState } from 'react';
import { ArrowUpRight, RefreshCw, Trash2, ExternalLink, Smartphone } from 'lucide-react';
import { buildMarketSignals, buildResearchBrief, getAppCoverage, requestedCountry, summarizeReviewDelta, MarketSignal, ResearchContext, WatchApp } from '../utils/marketIntelligence';
import { ResearchBriefPanel } from './MarketResearch';
import MarketCoverage from './MarketCoverage';

interface Props {
  apps: WatchApp[];
  research: ResearchContext;
  busy: boolean;
  syncingId: string | null;
  syncErrors: Record<string, string>;
  onSync: (app: WatchApp) => void;
  onSyncAll: () => void;
  onRemove: (id: string) => void;
  onRoleChange: (id: string, role: WatchApp['role']) => void;
}

const Evidence = ({ signal, days }: { signal: MarketSignal; days: number }) => (
  <details className="mt-3">
    <summary className="cursor-pointer text-sm font-medium text-teal-800">Review evidence ({signal.evidence.length})</summary>
    <div className="mt-3 max-h-80 overflow-auto space-y-4 pr-2">
      {signal.evidence.map(({ review, period }, index) => (
        <blockquote key={`${review.id || index}-${period}`} className="border-l-2 border-gray-200 pl-3 text-sm">
          <p className="text-xs text-gray-500 mb-1">{signal.appName} · {review.userName || 'Anonymous'} · {review.score || 'Unrated'} / 5 · {new Date(review.date || review.timestamp || '').toLocaleDateString()} · {period === 'current' ? `Last ${days} days` : `Previous ${days} days`}</p>
          <p className="whitespace-pre-wrap break-words text-gray-700">{review.text}</p>
          {(review.url || signal.appUrl) && /^https:\/\/(apps\.apple\.com|itunes\.apple\.com|play\.google\.com)\//.test(review.url || signal.appUrl) && <a href={review.url || signal.appUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-teal-800">{review.url ? 'Store review' : 'Store listing'} <ExternalLink className="w-3 h-3" /></a>}
        </blockquote>
      ))}
    </div>
  </details>
);

const SignalRow = ({ signal, days, action = false }: { signal: MarketSignal; days: number; action?: boolean }) => (
  <article className="py-5 border-b border-gray-200 last:border-b-0">
    <div className="flex flex-wrap justify-between gap-2">
      <div><p className="text-xs text-gray-500 mb-1">{signal.appName}</p><h3 className="font-semibold text-gray-950">{signal.topic}</h3></div>
      <span className={`text-sm font-medium ${signal.comparable ? 'text-gray-800' : 'text-amber-800'}`}>
        {signal.changePp === null ? 'Observation only' : `${signal.changePp > 0 ? '+' : ''}${signal.changePp} pp in sample share`}
      </span>
    </div>
    <p className="text-sm text-gray-600 mt-2">{signal.currentMentions} mentions in last {days} days · {signal.previousMentions} in preceding {days} days · {signal.sentiment} review ratings</p>
    {signal.comparable ? <p className="mt-1 text-xs text-gray-500">{signal.previousShare.toFixed(1)}% to {signal.currentShare.toFixed(1)}% of sampled reviews. Sample change, not total market volume.</p> : <p className="mt-1 text-xs text-amber-800">{signal.comparisonReason}. No trend conclusion.</p>}
    {action && <p className="text-sm text-gray-700 mt-3"><span className="font-medium">Next check: </span>{signal.nextStep}</p>}
    <Evidence signal={signal} days={days} />
  </article>
);

const MarketInsights = ({ apps, research, busy, syncingId, syncErrors, onSync, onSyncAll, onRemove, onRoleChange }: Props) => {
  const [view, setView] = useState<'overview' | 'brief' | 'weekly' | 'ask' | 'watchlist'>('overview');
  const [days, setDays] = useState(30);
  const [appId, setAppId] = useState('all');
  const [question, setQuestion] = useState('changes');
  const selected = useMemo(() => apps.filter(app => appId === 'all' || app.id === appId || !apps.some(item => item.id === appId)).sort((a, b) => Number(b.role === 'my-app') - Number(a.role === 'my-app')), [apps, appId]);
  const signals = useMemo(() => buildMarketSignals(selected, days), [selected, days]);
  const weekly = useMemo(() => buildMarketSignals(selected, 7), [selected]);
  const brief = useMemo(() => buildResearchBrief(selected, research, days), [selected, research, days]);
  const coverages = selected.map(app => ({ app, coverage: getAppCoverage(app, days) }));
  const comparable = coverages.filter(item => item.coverage.comparable).length;
  const currentCount = coverages.reduce((sum, item) => sum + item.coverage.current.length, 0);
  const savedCount = selected.reduce((sum, app) => sum + app.reviews.length, 0);
  const weeklyCount = selected.reduce((sum, app) => sum + getAppCoverage(app, 7).current.length, 0);
  const findings = signals.filter(signal => signal.changePp === null ? signal.currentMentions > 0 : signal.changePp !== 0);
  const asked = signals.filter(signal => question === 'features' ? signal.topic === 'Feature requests'
    : question === 'complaints' ? signal.sentiment === 'negative' : true);

  return (
    <div className="mt-7">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200">
        <div role="tablist" aria-label="Market views" className="flex flex-wrap gap-5">
          {(['overview', 'brief', 'weekly', 'ask', 'watchlist'] as const).map(tab => <button key={tab} id={`market-tab-${tab}`} role="tab" aria-selected={view === tab} aria-controls="market-panel" onClick={() => setView(tab)} className={`py-3 text-sm font-medium border-b-2 ${view === tab ? 'border-teal-700 text-teal-900' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>{({ overview: 'Overview', brief: 'Research brief', weekly: 'Weekly brief', ask: 'Ask market', watchlist: 'Watchlist' })[tab]}</button>)}
        </div>
        <div className="flex gap-3 items-center pb-2 flex-wrap">
          {view !== 'watchlist' && <select aria-label="Filter by app" value={appId} onChange={event => setAppId(event.target.value)} className="border border-gray-300 rounded p-2 text-sm max-w-52"><option value="all">All apps</option>{apps.map(app => <option value={app.id} key={app.id}>{app.name}</option>)}</select>}
          {view !== 'weekly' && view !== 'watchlist' && <select aria-label="Comparison period" value={days} onChange={event => setDays(Number(event.target.value))} className="border border-gray-300 rounded p-2 text-sm"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></select>}
          <button onClick={onSyncAll} disabled={busy || !apps.some(app => !app.sample)} className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"><RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />Sync all</button>
        </div>
      </div>
      <div id="market-panel" role="tabpanel" aria-labelledby={`market-tab-${view}`}>
        {view !== 'watchlist' && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-5 border-b border-gray-200">
          <div><p className="text-xs text-gray-500">Selected apps</p><p className="text-2xl font-semibold">{selected.length}</p></div>
          <div><p className="text-xs text-gray-500">Saved reviews</p><p className="text-2xl font-semibold">{savedCount}</p></div>
          <div><p className="text-xs text-gray-500">Dated reviews · last {view === 'weekly' ? 7 : days} days</p><p className="text-2xl font-semibold">{view === 'weekly' ? weeklyCount : currentCount}</p></div>
          <div><p className="text-xs text-gray-500">Apps with comparable samples</p><p className="text-2xl font-semibold">{view === 'weekly' ? selected.filter(app => getAppCoverage(app, 7).comparable).length : comparable} / {selected.length}</p></div>
        </div>}
        {view === 'overview' && <>
          <section className="py-5">
            <h2 className="text-lg font-semibold">Changes worth checking</h2>
            {!findings.length && <p className="mt-3 text-sm text-gray-500">{savedCount ? 'No topic share changes to highlight in available samples. Review app comparison for coverage.' : 'Add your app or a competitor with reviews to build a market baseline.'}</p>}
            {findings.slice(0, 5).map(signal => <SignalRow key={signal.key} signal={signal} days={days} action />)}
          </section>
          <section className="border-t border-gray-200 py-5">
            <h2 className="text-lg font-semibold mb-4">App comparison</h2>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm min-w-[620px]"><thead className="text-xs text-gray-500 border-b"><tr><th className="py-3">App</th><th>Current / previous reviews</th><th>Sample rating</th><th>Leading topic</th><th>Coverage</th></tr></thead><tbody>
              {coverages.map(({ app, coverage }) => { const summary = summarizeReviewDelta(app.reviews, days); const top = signals.filter(signal => signal.appId === app.id).sort((a, b) => b.currentMentions - a.currentMentions)[0]; return <tr key={app.id} className="border-b border-gray-100"><td className="py-4 pr-3"><p className="font-medium">{app.name}</p><p className="text-xs text-gray-500">{app.role === 'my-app' ? 'My App' : 'Competitor'}</p></td><td>{coverage.current.length} / {coverage.previous.length}</td><td>{summary.currentAverage?.toFixed(1) || 'N/A'} / 5</td><td>{top?.topic || 'No dated evidence'}</td><td className="max-w-48 text-xs pr-2"><span className={coverage.comparable ? 'text-teal-800' : 'text-amber-800'}>{coverage.comparable ? 'Comparable samples' : coverage.reason}</span></td></tr>; })}
            </tbody></table></div>
          </section>
        </>}
        {view === 'brief' && <ResearchBriefPanel brief={brief}>{brief.findings.map(signal => <SignalRow key={signal.key} signal={signal} days={days} action />)}</ResearchBriefPanel>}
        {view === 'weekly' && <section className="py-5">
          <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-semibold">Weekly product brief</h2><p className="mt-1 text-sm text-gray-500">Last 7 days versus the preceding 7 days · internal preview · delivery not scheduled</p></div><button className="text-sm text-teal-800 inline-flex items-center gap-1" onClick={() => setView('watchlist')}>Review coverage <ArrowUpRight className="w-4 h-4" /></button></div>
          {weekly.length === 0 && <p className="mt-5 text-gray-500 text-sm">Not enough dated review evidence to generate a brief for this week.</p>}
          {weekly.slice(0, 5).map(signal => <SignalRow key={signal.key} signal={signal} days={7} action />)}
        </section>}
        {view === 'ask' && <section className="py-5">
          <h2 className="text-lg font-semibold">Ask your watched market</h2>
          <div className="flex gap-2 flex-wrap my-4" role="group" aria-label="Market questions">{[{ id: 'changes', title: 'What changed?' }, { id: 'complaints', title: 'Negative feedback' }, { id: 'features', title: 'Feature requests' }].map(item => <button key={item.id} aria-pressed={question === item.id} onClick={() => setQuestion(item.id)} className={`px-3 py-2 text-sm rounded border ${question === item.id ? 'bg-teal-50 text-teal-900 border-teal-600' : 'border-gray-300'}`}>{item.title}</button>)}</div>
          <p className="text-xs text-gray-500">Evidence from {selected.length} watched apps · last {days} days. Requested features are hypotheses to validate, not proven competitive gaps.</p>
          {!asked.length && <p className="mt-5 text-sm text-gray-500">No matching review evidence for this question and selection.</p>}
          {asked.slice(0, 8).map(signal => <SignalRow key={signal.key} signal={signal} days={days} action />)}
        </section>}
        {view === 'watchlist' && <section className="py-5">
          <h2 className="text-lg font-semibold mb-1">Watchlist</h2><p className="text-sm text-gray-500 mb-4">Manual monitoring · saved in this browser · next sync not scheduled</p>
          {!apps.length && <p className="text-sm text-gray-500">No watched apps yet.</p>}
          {apps.map(app => <div key={app.id} className="grid grid-cols-[36px_minmax(0,1fr)] md:grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3 py-4 border-b border-gray-200">
            <div className="w-9 h-9">{app.icon ? <img src={app.icon} alt="" className="w-9 h-9 rounded" /> : <Smartphone className="w-5 h-5 text-gray-400 m-2" />}</div>
            <div className="flex-1 min-w-0"><p className="font-medium text-sm break-words">{app.name}</p><p className="text-xs text-gray-500 mt-1">{app.platform === 'ios' ? 'App Store' : 'Google Play'} · {app.reviews.length} saved · last fetch {app.lastFetchedCount ?? 'unknown'} · first discoveries {app.lastAddedCount ?? 'unknown'}</p><p className="mt-1 text-xs text-gray-500">Last successful sync: {new Date(app.syncedAt).toLocaleString()} · {app.sample ? 'Illustrative data' : app.reviewSource === 'store-page-sample' ? 'Limited webpage sample' : app.reviewSource === 'review-feed' ? 'Review feed sample' : 'Unverified source'}</p>
              {!app.sample && <p className="mt-1 text-xs text-gray-500">Requested region: {requestedCountry(app.url).toUpperCase()} · review region: {app.reviewCountry?.toUpperCase() || 'Unverified'}</p>}
              {app.reviewSource === 'store-page-sample' && <p className="mt-1 text-xs text-amber-800">Sample only; trend comparisons are withheld.</p>}
              {!app.reviews.length && <p className="mt-1 text-xs text-amber-800">No review data returned; not evidence of zero market feedback.</p>}
              {syncErrors[app.id] && <p role="alert" className="mt-1 text-xs text-red-700">{syncErrors[app.id]} Previous reviews retained.</p>}
              {syncingId === app.id && <p role="status" className="mt-1 text-xs text-teal-800">Fetching reviews...</p>}
            </div>
            <div className="col-start-2 md:col-start-auto flex items-center gap-2"><select disabled={busy} value={app.role} aria-label={`Role for ${app.name}`} onChange={event => onRoleChange(app.id, event.target.value as WatchApp['role'])} className="border border-gray-300 rounded p-1.5 text-xs"><option value="my-app">My App</option><option value="competitor">Competitor</option></select>
            <button title={`Sync ${app.name}`} aria-label={`Sync ${app.name}`} disabled={busy || app.sample} onClick={() => onSync(app)} className="p-2 hover:bg-gray-100 rounded disabled:opacity-40"><RefreshCw className={`w-4 h-4 ${syncingId === app.id ? 'animate-spin' : ''}`} /></button>
            <button title={`Remove ${app.name}`} aria-label={`Remove ${app.name}`} disabled={busy} onClick={() => { if (appId === app.id) setAppId('all'); onRemove(app.id); }} className="p-2 text-gray-500 hover:text-red-700 disabled:opacity-40"><Trash2 className="w-4 h-4" /></button></div>
          </div>)}
          <MarketCoverage apps={apps} />
        </section>}
      </div>
    </div>
  );
};

export default MarketInsights;
