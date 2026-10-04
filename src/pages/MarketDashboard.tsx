import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Bell, Bot, CalendarDays, Loader2, Plus, Radar, Search, Trash2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { SERVER_URL } from '../components/Constants';
import { calculateTopicTrends, summarizeReviewDelta, MarketReview } from '../utils/marketIntelligence';

interface WatchApp {
  id: string;
  role: 'my-app' | 'competitor';
  url: string;
  name: string;
  icon?: string;
  developer?: string;
  platform: 'ios' | 'android';
  reviews: MarketReview[];
  syncedAt: string;
  sample?: boolean;
  reviewSource?: string;
  lastFetchedCount?: number;
}

const STORAGE_KEY = 'insightly_market_watchlist_v1';

const loadWatchlist = (): WatchApp[] => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter(app => app && Array.isArray(app.reviews) && typeof app.name === 'string') : [];
  } catch {
    return [];
  }
};

const processAppUrl = async (url: string) => {
  const endpoint = url.includes('apps.apple.com')
    ? `${SERVER_URL}/app-store/process-url`
    : `${SERVER_URL}/google-play/process-url`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, maxReviews: 500, months: 0 }),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) {
    throw new Error('Could not sync this app. Check the store URL and API connection.');
  }

  return response.json();
};

const buildWeeklyPreview = (apps: WatchApp[]) => {
  const allReviews = apps.flatMap(app => app.reviews.map(review => ({ ...review, appName: app.name })));
  const trends = calculateTopicTrends(allReviews, 7).slice(0, 5);
  const negativeEmerging = trends.filter(trend => trend.delta > 0 && trend.sentiment !== 'positive').slice(0, 3);

  return {
    title: `Weekly Product Intelligence: ${apps.find(app => app.role === 'my-app')?.name || 'Your market'}`,
    marketSize: `${apps.length} apps watched, ${allReviews.length} recent reviews scanned`,
    highlights: [
      negativeEmerging[0]
        ? `${negativeEmerging[0].topic} is rising by ${negativeEmerging[0].delta} mentions.`
        : 'No sharp negative topic spike found in the current sample.',
      trends[0]
        ? `Top moving topic: ${trends[0].topic}.`
        : 'Add at least one synced app to generate movement signals.',
      'Suggested next step: turn the strongest complaint into a roadmap hypothesis and validate it against your own support tickets.',
    ],
    trends,
  };
};

const MarketDashboard: React.FC = () => {
  const [watchlist, setWatchlist] = useState<WatchApp[]>(loadWatchlist);
  const [url, setUrl] = useState('');
  const [role, setRole] = useState<WatchApp['role']>('competitor');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [question, setQuestion] = useState('What changed?');
  const [suggestions, setSuggestions] = useState<{ title: string; appUrl: string; icon?: string; developer?: string; platform: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  useEffect(() => {
    const query = url.trim();
    setSuggestions([]);
    setActiveSuggestion(-1);
    setSearchError('');
    setSearching(false);
    if (query.length < 2 || /^https?:\/\//i.test(query)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`${SERVER_URL}/api/search-apps?query=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Search unavailable. Paste a store URL or try again.');
        const data = await response.json();
        if (!controller.signal.aborted) {
          setSuggestions(data.results || []);
          setSearchError(data.results?.length ? '' : 'No matching apps found.');
        }
      } catch (err) {
        if (!controller.signal.aborted) setSearchError(err instanceof Error ? err.message : 'Search unavailable.');
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [url]);

  const pickSuggestion = (appUrl: string) => {
    setUrl(appUrl);
    setShowSuggestions(false);
    setSuggestions([]);
    setError(null);
  };

  const loadSample = () => {
    const date = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
    persistWatchlist(['Focus Notes', 'Quick Notes', 'Team Notes'].map((name, index) => ({
      id: `sample-${index}`, name, role: index === 0 ? 'my-app' : 'competitor',
      url: '', platform: 'ios', syncedAt: date(0), sample: true,
      reviews: [
        { text: 'The subscription is expensive and the paywall blocks export.', score: 1, date: date(1) },
        { text: 'Please add offline sync. Data is lost after login.', score: 2, date: date(2) },
        { text: 'App crashes when loading a large notebook.', score: 1, date: date(4) },
        { text: 'Great design, easy to use.', score: 5, date: date(10) },
        { text: 'Helpful support response.', score: 4, date: date(40) },
      ],
    })));
  };

  const refreshApp = async (app: WatchApp) => {
    setSyncingId(app.id);
    setError(null);
    setNotice(null);
    setSyncErrors(previous => ({ ...previous, [app.id]: '' }));
    try {
      const data = await processAppUrl(app.url);
      const incoming: MarketReview[] = data.reviews?.reviews || [];
      const merged = new Map([...app.reviews, ...incoming].map(review => [
        review.id || `${review.userName || ''}|${review.date || review.timestamp || ''}|${review.text}`, review,
      ]));
      persistWatchlist(watchlist.map(item => item.id === app.id ? {
        ...item, reviews: [...merged.values()].slice(-2000), syncedAt: new Date().toISOString(), reviewSource: data.reviews?.source, lastFetchedCount: incoming.length,
      } : item));
      setNotice(incoming.length ? `${app.name}: fetched ${incoming.length} reviews this time${data.reviews?.source === 'store-page-sample' ? ' from a limited webpage sample because Apple review feeds returned no reviews' : ' from the review feed'}. Previously saved reviews are retained.` : `${app.name}: the public store feed returned no reviews. This does not mean the app has no ratings or reviews.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed.';
      setError(`${app.name}: ${message}`);
      setSyncErrors(previous => ({ ...previous, [app.id]: message }));
    } finally {
      setSyncingId(null);
    }
  };

  const persistWatchlist = (next: WatchApp[]) => {
    setWatchlist(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setError('Browser storage is full or unavailable. Changes are available until you close this page.');
    }
  };

  const handleAdd = async () => {
    if (!url.trim()) {
      setError('Paste an App Store or Google Play URL first.');
      return;
    }
    let parsed: URL;
    try { parsed = new URL(url.trim()); } catch { setError('Use a valid store URL.'); return; }
    if (parsed.protocol !== 'https:' || !['apps.apple.com', 'play.google.com'].includes(parsed.hostname)) {
      setError('Use a valid App Store or Google Play URL.');
      return;
    }
    if (watchlist.some(app => app.url === url.trim())) {
      setError('This app is already in your market watchlist.');
      return;
    }
    if (role === 'my-app' && watchlist.some(app => app.role === 'my-app')) {
      setError('Remove your current app before assigning a new My App.');
      return;
    }

    try {
      setIsAdding(true);
      setError(null);
      setNotice(null);
      const data = await processAppUrl(url.trim());
      const nextApp: WatchApp = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role,
        url: url.trim(),
        name: data.details?.title || 'Untitled app',
        icon: data.details?.icon,
        developer: data.details?.developer,
        platform: url.includes('apps.apple.com') ? 'ios' : 'android',
        reviews: data.reviews?.reviews || [],
        reviewSource: data.reviews?.source,
        lastFetchedCount: data.reviews?.reviews?.length || 0,
        syncedAt: new Date().toISOString(),
      };
      persistWatchlist([...watchlist, nextApp]);
      setNotice(nextApp.reviews.length ? `${nextApp.name} added with ${nextApp.reviews.length} reviews. Your market results are below.` : `${nextApp.name} added, but its public store feed returned no reviews. Try another store region or platform.`);
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add app.');
    } finally {
      setIsAdding(false);
    }
  };

  const allReviews = useMemo(() => watchlist.flatMap(app => app.reviews), [watchlist]);
  const trends = useMemo(() => calculateTopicTrends(allReviews).slice(0, 6), [allReviews]);
  const delta = useMemo(() => summarizeReviewDelta(allReviews), [allReviews]);
  const weeklyPreview = useMemo(() => buildWeeklyPreview(watchlist), [watchlist]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 text-blue-700 font-semibold mb-3">
              <Radar className="w-5 h-5" />
              Market monitoring
            </div>
            <h1 className="text-3xl font-bold text-gray-950">
              Your market
            </h1>
            <p className="mt-4 text-lg text-gray-600 max-w-3xl">
              {watchlist.some(app => app.sample) ? 'Sample market · illustrative reviews' : 'Market preview · manual sync · saved in this browser'}
            </p>
          </div>
          <Link
            to={`/chat?prompt=${encodeURIComponent('What changed in my market this week? Focus on emerging complaints, feature gaps, and competitor weaknesses.')}`}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gray-950 text-white rounded-lg font-semibold hover:bg-gray-800"
          >
            <Bot className="w-5 h-5" />
            Ask Your Market
          </Link>
        </div>

        <section className="mt-8 bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          {watchlist.length === 0 && <button onClick={loadSample} className="mb-4 text-blue-700 font-semibold">Explore a sample market</button>}
          <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr_auto] gap-3">
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as WatchApp['role'])}
              className="px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="my-app">My App</option>
              <option value="competitor">Competitor</option>
            </select>
            <div className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setShowSuggestions(false); }}>
              <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <input
                value={url}
                onChange={(event) => { setUrl(event.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                role="combobox"
                aria-label="Search apps or paste a store URL"
                aria-expanded={showSuggestions && (searching || suggestions.length > 0 || !!searchError)}
                aria-controls="market-app-suggestions"
                aria-autocomplete="list"
                aria-activedescendant={activeSuggestion >= 0 ? `market-suggestion-${activeSuggestion}` : undefined}
                onKeyDown={event => {
                  if (event.key === 'Escape') setShowSuggestions(false);
                  if (event.key === 'ArrowDown' && suggestions.length) { event.preventDefault(); setShowSuggestions(true); setActiveSuggestion(index => Math.min(index + 1, suggestions.length - 1)); }
                  if (event.key === 'ArrowUp') { event.preventDefault(); setActiveSuggestion(index => Math.max(index - 1, 0)); }
                  if (event.key === 'Enter' && showSuggestions && activeSuggestion >= 0 && suggestions[activeSuggestion]) { event.preventDefault(); pickSuggestion(suggestions[activeSuggestion].appUrl); }
                }}
                placeholder="Search an app name or paste a store URL..."
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showSuggestions && (searching || suggestions.length > 0 || searchError) && (
                <div id="market-app-suggestions" role="listbox" className="absolute z-50 mt-1 w-full max-h-72 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                  {searching && <p role="status" className="p-3 text-sm text-gray-500">Searching...</p>}
                  {!searching && searchError && <p role="status" className="p-3 text-sm text-gray-500">{searchError}</p>}
                  {!searching && suggestions.map((app, index) => (
                    <button key={`${app.platform}-${app.appUrl}`} id={`market-suggestion-${index}`} role="option" aria-selected={activeSuggestion === index} type="button"
                      onMouseDown={event => event.preventDefault()} onClick={() => pickSuggestion(app.appUrl)}
                      className={`flex items-center gap-3 w-full text-left p-3 hover:bg-blue-50 ${activeSuggestion === index ? 'bg-blue-50' : ''}`}>
                      {app.icon && <img src={app.icon} alt="" className="w-9 h-9 rounded shrink-0" />}
                      <span className="min-w-0"><span className="block truncate font-medium">{app.title}</span><span className="block text-xs text-gray-500 truncate">{app.developer} · {app.platform === 'app-store' ? 'App Store' : 'Google Play'}</span></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleAdd}
              disabled={isAdding || syncingId !== null}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              {isAdding ? 'Syncing reviews...' : 'Track app'}
            </button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
          {notice && <p role="status" className="mt-3 text-sm text-green-700">{notice}</p>}
          {isAdding && <p role="status" className="mt-3 text-sm text-gray-500">Fetching app details and recent reviews...</p>}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <Activity className="w-6 h-6 text-blue-600 mb-3" />
            <div className="text-3xl font-bold text-gray-950">{watchlist.length}</div>
            <div className="text-gray-500">apps monitored</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <BarChart3 className="w-6 h-6 text-blue-600 mb-3" />
            <div className="text-3xl font-bold text-gray-950">{delta.currentReviews}</div>
            <div className="text-gray-500">reviews in current window</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <CalendarDays className="w-6 h-6 text-blue-600 mb-3" />
            <div className="text-3xl font-bold text-gray-950">
              {delta.ratingDelta === null ? 'N/A' : `${delta.ratingDelta > 0 ? '+' : ''}${delta.ratingDelta}`}
            </div>
            <div className="text-gray-500">rating delta vs previous window</div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 mt-6">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-xl font-bold text-gray-950 mb-4">Watchlist</h2>
            <div className="space-y-3">
              {watchlist.length === 0 && (
                <p className="text-gray-500">Add your app and two competitors to start monitoring market movement.</p>
              )}
              {watchlist.map(app => (
                <div key={app.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {app.icon && <img src={app.icon} alt="" className="w-10 h-10 rounded-lg" />}
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{app.name}</div>
                      <div className="text-sm text-gray-500">
                        {app.role === 'my-app' ? 'My App' : 'Competitor'} · {app.reviews.length} saved reviews · synced {new Date(app.syncedAt).toLocaleString()}
                      </div>
                      {syncingId === app.id && <p role="status" className="mt-1 text-sm text-blue-700">Syncing reviews...</p>}
                      {app.lastFetchedCount !== undefined && <p className="mt-1 text-xs text-gray-500">Last fetch: {app.lastFetchedCount} reviews · {app.reviewSource === 'store-page-sample' ? 'webpage sample' : 'review feed'}</p>}
                      {app.reviews.length === 0 && <p className="mt-1 text-sm text-amber-700">Public review feed returned no data · retry sync or another region</p>}
                      {app.reviewSource === 'store-page-sample' && <p className="mt-1 text-sm text-amber-700">Apple review feeds returned no data · limited webpage sample, not complete coverage</p>}
                      {app.reviews.length > 0 && summarizeReviewDelta(app.reviews).currentReviews === 0 && <p className="mt-1 text-sm text-amber-700">Historical reviews available · none dated in the last 30 days</p>}
                      {syncErrors[app.id] && <p role="alert" className="mt-1 text-sm text-red-600">Sync failed: {syncErrors[app.id]} Previous data retained.</p>}
                    </div>
                  </div>
                  <button
                    title={app.sample ? 'Sample data' : 'Sync reviews'}
                    aria-label={`Sync ${app.name}`}
                    disabled={app.sample || syncingId !== null || isAdding}
                    onClick={() => refreshApp(app)}
                    className="p-2 text-gray-500 hover:text-blue-600 disabled:opacity-40"
                  ><RefreshCw className={`w-5 h-5 ${syncingId === app.id ? 'animate-spin' : ''}`} /></button>
                  <button
                    aria-label={`Remove ${app.name}`}
                    disabled={isAdding || syncingId !== null}
                    onClick={() => persistWatchlist(watchlist.filter(item => item.id !== app.id))}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-xl font-bold text-gray-950 mb-4">Topic Trends</h2>
            <div className="space-y-3">
              {trends.length === 0 && <p className="text-gray-500">{watchlist.length === 0 ? 'Add an app to see trends.' : allReviews.length === 0 ? 'Your apps are tracked, but no reviews were returned. Add a competitor with reviews or try another store region.' : 'No matching topics in reviews from the last 60 days. Older reviews do not produce current trends.'}</p>}
              {trends.map(trend => (
                <div key={trend.topic} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-gray-900">{trend.topic}</span>
                    <span className={`text-sm font-semibold ${trend.delta >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {trend.delta >= 0 ? '+' : ''}{trend.delta}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {trend.currentMentions} current mentions · {trend.sentiment} sentiment
                  </div>
                  {trend.example && <p className="mt-2 text-sm text-gray-600 line-clamp-2">"{trend.example}"</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-950">Weekly Intelligence Preview</h2>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-bold text-gray-950">{weeklyPreview.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{weeklyPreview.marketSize}</p>
            <ul className="mt-4 space-y-2 text-gray-700">
              {weeklyPreview.highlights.map(highlight => <li key={highlight}>- {highlight}</li>)}
            </ul>
          </div>
          <p className="mt-3 text-sm text-gray-500">Last 7 days compared with the preceding 7 days. Based on sampled reviews.</p>
        </section>
        <section className="mt-6 border-t border-gray-200 pt-5">
          <h2 className="text-xl font-bold mb-3">Ask Your Market</h2>
          <select aria-label="Market question" value={question} onChange={event => setQuestion(event.target.value)} className="border border-gray-300 rounded-lg p-3 mb-4 max-w-full">
            <option>What changed?</option><option>Emerging complaints</option><option>Feature gaps</option>
          </select>
          <div className="space-y-3">
            {(question === 'Feature gaps' ? trends.filter(trend => trend.topic === 'Feature requests') : question === 'Emerging complaints' ? trends.filter(trend => trend.delta > 0 && trend.sentiment !== 'positive') : trends).slice(0, 3).map(trend => (
              <div key={trend.topic}><p className="font-semibold">{trend.topic}: {trend.currentMentions} mentions, {trend.delta > 0 ? '+' : ''}{trend.delta} vs previous 30 days</p><p className="text-gray-600">{trend.example}</p></div>
            ))}
            {!trends.length && <p className="text-gray-500">No review evidence yet.</p>}
          </div>
          <Link className="inline-flex mt-4 text-blue-700" to={`/chat?prompt=${encodeURIComponent(`${question} Focus on these apps: ${watchlist.map(app => app.name).join(', ')}. Use cited review evidence.`)}`}>Open AI research</Link>
        </section>
      </main>
    </div>
  );
};

export default MarketDashboard;
