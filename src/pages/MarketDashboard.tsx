import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Radar, Search } from 'lucide-react';

import Navigation from '../components/Navigation';
import { SERVER_URL } from '../components/Constants';
import { mergeMarketReviews, MarketReview, WatchApp } from '../utils/marketIntelligence';
import MarketInsights from '../components/MarketInsights';


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

  const data = await response.json();
  if (!data.details || !Array.isArray(data.reviews?.reviews)) throw new Error('The review service returned an invalid response. Previous data retained.');
  return data;
};

const MarketDashboard: React.FC = () => {
  const [watchlist, setWatchlist] = useState<WatchApp[]>(loadWatchlist);
  const watchlistRef = useRef(watchlist);
  const [syncingAll, setSyncingAll] = useState(false);
  const [url, setUrl] = useState('');
  const [role, setRole] = useState<WatchApp['role']>(watchlist.some(app => app.role === 'my-app') ? 'competitor' : 'my-app');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

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
    persistWatchlist(['Focus Notes', 'Quick Notes', 'Team Notes'].map((name, appIndex) => ({
      id: 'sample-' + appIndex, name, role: appIndex === 0 ? 'my-app' : 'competitor',
      url: '', platform: 'ios', syncedAt: date(0), sample: true,
      reviews: [0, 1, 2].flatMap(period => Array.from({ length: 12 }, (_, index) => ({
        id: 'sample-' + appIndex + '-' + period + '-' + index,
        userName: 'Sample reviewer ' + (index + 1),
        text: index < (period === 0 ? 7 - appIndex : 2)
          ? 'App crashes while loading my notebook.'
          : index < 9 ? 'Please add offline export. This feature is missing.'
          : 'Great design and helpful support.',
        score: index < 9 ? 2 : 5,
        date: date((period === 0 ? 1 : period === 1 ? 8 : 31) + index % 6),
      }))),
    })));
    setRole('competitor');
  };

  const refreshApp = async (app: WatchApp) => {
    setSyncingId(app.id);
    setError(null);
    setSyncErrors(previous => ({ ...previous, [app.id]: '' }));
    try {
      const data = await processAppUrl(app.url);
      const incoming: MarketReview[] = data.reviews?.reviews || [];
      const current = watchlistRef.current.find(item => item.id === app.id) || app;
      const merged = mergeMarketReviews(current.reviews, incoming);
      const added = Math.max(0, merged.length - current.reviews.length);
      persistWatchlist(watchlistRef.current.map(item => item.id === app.id ? {
        ...item, reviews: merged, syncedAt: new Date().toISOString(),
        reviewSource: data.reviews?.source || (app.platform === 'android' ? 'review-feed' : undefined),
        lastFetchedCount: incoming.length, lastAddedCount: added, partial: !!data.reviews?.partial,
      } : item));
      setNotice(app.name + ': ' + incoming.length + ' fetched, ' + added + ' newly saved. ' + (data.reviews?.source === 'store-page-sample' ? 'Limited sample; trend comparison withheld.' : 'Previously saved reviews retained.'));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed.';
      setError(app.name + ': ' + message);
      setSyncErrors(previous => ({ ...previous, [app.id]: message }));
      return false;
    } finally {
      setSyncingId(null);
    }
  };

  const syncAll = async () => {
    setSyncingAll(true);
    setNotice(null);
    const apps = watchlistRef.current.filter(app => !app.sample);
    let successful = 0;
    try {
      for (const app of apps) {
        if (await refreshApp(app)) successful++;
      }
      setNotice('Sync complete: ' + successful + ' of ' + apps.length + ' apps updated. ' + (successful < apps.length ? 'Failed apps retain their previous reviews; see Watchlist.' : ''));
    } finally {
      setSyncingAll(false);
    }
  };

  const persistWatchlist = (next: WatchApp[]) => {
    watchlistRef.current = next;
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
      setError('A My App is already assigned. This app can be added as a competitor.');
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
        reviewSource: data.reviews?.source || (parsed.hostname === 'play.google.com' ? 'review-feed' : undefined),
        lastFetchedCount: data.reviews?.reviews?.length || 0,
        lastAddedCount: 0,
        partial: !!data.reviews?.partial,
        syncedAt: new Date().toISOString(),
      };
      persistWatchlist([...watchlistRef.current, nextApp]);
      setRole('competitor');
      setNotice(nextApp.reviews.length ? `${nextApp.name} added with ${nextApp.reviews.length} reviews. Your market results are below.` : `${nextApp.name} added, but its public store feed returned no reviews. Try another store region or platform.`);
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add app.');
    } finally {
      setIsAdding(false);
    }
  };

  const busy = isAdding || syncingId !== null || syncingAll;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        <div className="flex items-center gap-2 text-teal-800 text-sm font-medium"><Radar className="w-4 h-4" />Product intelligence</div>
        <h1 className="text-3xl font-semibold text-gray-950 mt-2">Your market</h1>
        <p className="mt-2 text-sm text-gray-500">{watchlist.some(app => app.sample) ? 'Sample market · illustrative reviews' : 'Manual monitoring preview · saved in this browser'}</p>

        <section className="mt-5 border-b border-gray-200 pb-5">
          {watchlist.length === 0 && <button onClick={loadSample} className="mb-4 text-blue-700 font-semibold">Explore a sample market</button>}
          <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr_auto] gap-3">
            <select
              aria-label="New app role"
              disabled={busy}
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
                disabled={busy}
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
              disabled={busy}
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

        <MarketInsights apps={watchlist} busy={busy} syncingId={syncingId} syncErrors={syncErrors}
          onSync={refreshApp} onSyncAll={syncAll}
          onRemove={id => persistWatchlist(watchlistRef.current.filter(app => app.id !== id))}
          onRoleChange={(id, nextRole) => persistWatchlist(watchlistRef.current.map(app => ({
            ...app, role: app.id === id ? nextRole : nextRole === 'my-app' ? 'competitor' : app.role,
          })))}
        />
      </main>
    </div>
  );
};

export default MarketDashboard;
