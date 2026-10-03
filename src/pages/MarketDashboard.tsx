import React, { useMemo, useState } from 'react';
import { Activity, BarChart3, Bell, Bot, CalendarDays, Loader2, Plus, Radar, Search, Trash2 } from 'lucide-react';
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
}

const STORAGE_KEY = 'insightly_market_watchlist_v1';

const loadWatchlist = (): WatchApp[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
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
    body: JSON.stringify({ url, maxReviews: 100, months: 6 }),
  });

  if (!response.ok) {
    throw new Error('Could not sync this app. Please check the store URL.');
  }

  return response.json();
};

const buildWeeklyPreview = (apps: WatchApp[]) => {
  const allReviews = apps.flatMap(app => app.reviews.map(review => ({ ...review, appName: app.name })));
  const trends = calculateTopicTrends(allReviews).slice(0, 5);
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
  const [isAdding, setIsAdding] = useState(false);

  const persistWatchlist = (next: WatchApp[]) => {
    setWatchlist(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleAdd = async () => {
    if (!url.trim()) {
      setError('Paste an App Store or Google Play URL first.');
      return;
    }
    if (!url.includes('apps.apple.com') && !url.includes('play.google.com')) {
      setError('Use a valid App Store or Google Play URL.');
      return;
    }
    if (watchlist.some(app => app.url === url.trim())) {
      setError('This app is already in your market watchlist.');
      return;
    }

    try {
      setIsAdding(true);
      setError(null);
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
        syncedAt: new Date().toISOString(),
      };
      persistWatchlist([...watchlist, nextApp]);
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
            <h1 className="text-4xl font-extrabold text-gray-950 tracking-tight">
              Track your app and competitors in one market dashboard.
            </h1>
            <p className="mt-4 text-lg text-gray-600 max-w-3xl">
              Define your watched market, sync recent reviews, spot topic deltas, and preview the weekly intelligence digest your product team can act on.
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
          <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr_auto] gap-3">
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as WatchApp['role'])}
              className="px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="my-app">My App</option>
              <option value="competitor">Competitor</option>
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Paste App Store or Google Play URL to monitor..."
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={isAdding}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              Track app
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
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
                      <div className="text-sm text-gray-500 truncate">
                        {app.role === 'my-app' ? 'My App' : 'Competitor'} · {app.reviews.length} reviews · synced {new Date(app.syncedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <button
                    aria-label={`Remove ${app.name}`}
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
              {trends.length === 0 && <p className="text-gray-500">Sync reviews to see emerging complaints and feature gaps.</p>}
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
          <p className="mt-3 text-sm text-gray-500">
            Email and Slack delivery are intentionally not enabled yet. This preview uses the same review delta and topic trend logic that can power the scheduled digest.
          </p>
        </section>
      </main>
    </div>
  );
};

export default MarketDashboard;
