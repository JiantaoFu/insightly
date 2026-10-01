import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Star, ExternalLink, AlertCircle } from 'lucide-react';
import { useAuth } from './AuthContext';

interface SearchResult {
  title: string;
  appUrl: string;
  icon: string;
  developer: string;
  platform: 'app-store' | 'google-play';
}

interface FoundData {
  appTitle?: string;
  platform?: string;
  avgRating?: number;
  reviewsCount?: number;
  topComplaints?: string[];
  topRequests?: string[];
  shareLink: string;
}

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; data: FoundData }
  | { status: 'not-found' }
  | { status: 'limited' }
  | { status: 'error'; message: string };

const QuickLookup: React.FC = () => {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<LookupState>({ status: 'idle' });
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { login } = useAuth();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Debounced app-name search (skip when input already looks like a URL)
  useEffect(() => {
    const q = url.trim();
    if (!q || /^(https?:\/\/)?(apps\.apple\.com|play\.google\.com)/i.test(q)) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const resp = await fetch(`/api/search-apps?query=${encodeURIComponent(q)}`);
        const data = await resp.json();
        setSuggestions(data.results || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [url]);

  // Close suggestions on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pickSuggestion = (s: SearchResult) => {
    setUrl(s.appUrl);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let trimmed = url.trim();
    if (!trimmed) return;
    // If user typed an app name and didn't pick a suggestion, use the top suggestion
    if (!/^(https?:\/\/)?(apps\.apple\.com|play\.google\.com)/i.test(trimmed) && suggestions.length > 0) {
      trimmed = suggestions[0].appUrl;
      setUrl(trimmed);
    }
    if (!/^(https?:\/\/)?(apps\.apple\.com|play\.google\.com)/i.test(trimmed)) {
      setState({
        status: 'error',
        message: 'Pick an app from the suggestions, or paste a full App Store / Google Play link.'
      });
      return;
    }
    setShowSuggestions(false);
    setState({ status: 'loading' });
    try {
      // Same-origin call: Netlify proxies /api/* to the 5iyw backend, which is
      // the deployment that actually ships this endpoint. (The frontend's
      // SERVER_URL backend does not have it.)
      const resp = await fetch(
        `/api/quick-lookup?url=${encodeURIComponent(trimmed)}`
      );
      if (resp.status === 429) {
        setState({ status: 'limited' });
        return;
      }
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setState({
          status: 'error',
          message: err.error || 'Lookup failed, please try again'
        });
        return;
      }
      const data = await resp.json();
      if (data.found) {
        setState({ status: 'found', data });
      } else {
        setState({ status: 'not-found' });
      }
    } catch {
      setState({ status: 'error', message: 'Lookup failed, please try again' });
    }
  };

  const renderResult = () => {
    switch (state.status) {
      case 'idle':
        return null;
      case 'loading':
        return (
          <div className="mt-6 flex items-center justify-center gap-2 text-white/90">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Checking our report archive…</span>
          </div>
        );
      case 'found': {
        const d = state.data;
        return (
          <div className="mt-6 mx-auto max-w-2xl bg-white rounded-xl shadow-xl text-left text-gray-900 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">{d.appTitle || 'App report'}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                  {d.platform && (
                    <span className="uppercase tracking-wide">{d.platform}</span>
                  )}
                  {typeof d.avgRating === 'number' && (
                    <span className="inline-flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      {d.avgRating.toFixed(1)}
                    </span>
                  )}
                  {typeof d.reviewsCount === 'number' && (
                    <span>{d.reviewsCount.toLocaleString()} reviews analyzed</span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {d.topComplaints && d.topComplaints.length > 0 && (
                <div>
                  <h4 className="font-semibold text-red-700 mb-2">Top complaints</h4>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                    {d.topComplaints.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {d.topRequests && d.topRequests.length > 0 && (
                <div>
                  <h4 className="font-semibold text-green-700 mb-2">Top feature requests</h4>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                    {d.topRequests.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <a
              href={d.shareLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              View full report <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        );
      }
      case 'not-found':
        return (
          <div className="mt-6 mx-auto max-w-2xl bg-white/10 backdrop-blur rounded-xl p-6 text-white">
            <p className="text-lg font-semibold">
              We haven&apos;t analyzed this app yet.
            </p>
            <p className="mt-1 text-white/80">
              Log in to analyze it and get the full AI report.
            </p>
            <button
              onClick={login}
              className="mt-4 inline-block bg-white text-indigo-600 px-6 py-2.5 rounded-lg font-semibold shadow hover:-translate-y-0.5 transition"
            >
              Login with Google
            </button>
          </div>
        );
      case 'limited':
        return (
          <div className="mt-6 mx-auto max-w-2xl bg-white/10 backdrop-blur rounded-xl p-6 text-white">
            <p className="inline-flex items-center gap-2 text-lg font-semibold">
              <AlertCircle className="w-5 h-5" /> Daily free limit reached
            </p>
            <p className="mt-1 text-white/80">
              You&apos;ve used your 20 free lookups for today — try again tomorrow.
            </p>
          </div>
        );
      case 'error':
        return (
          <div className="mt-6 mx-auto max-w-2xl bg-white/10 backdrop-blur rounded-xl p-6 text-white">
            <p className="inline-flex items-center gap-2 font-semibold">
              <AlertCircle className="w-5 h-5" /> {state.message}
            </p>
          </div>
        );
    }
  };

  return (
    <div className="mt-10 max-w-2xl mx-auto">
      <p className="text-white/90 font-medium mb-3">
        Paste an App Store / Google Play link — or just type the app name
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div ref={wrapRef} className="relative flex-1">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onFocus={() => { if (suggestions.length) setShowSuggestions(true); }}
            placeholder="App name or store link, e.g. Google Photos"
            className="w-full px-5 py-3 rounded-lg text-gray-900 placeholder-gray-400 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="App name or App Store / Google Play link"
            autoComplete="off"
          />
          {showSuggestions && (isSearching || suggestions.length > 0) && (
            <div className="absolute mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 z-50 text-left">
              {isSearching ? (
                <div className="py-2 px-4 text-gray-500 text-sm">Searching…</div>
              ) : (
                suggestions.map((s) => (
                  <button
                    key={s.appUrl}
                    type="button"
                    onClick={() => pickSuggestion(s)}
                    className="w-full flex items-center space-x-3 px-4 py-2 hover:bg-blue-50 text-left"
                  >
                    {s.icon && <img src={s.icon} alt="" className="w-8 h-8 rounded" />}
                    <div className="min-w-0">
                      <div className="truncate font-medium text-gray-900 text-sm">{s.title}</div>
                      <div className="text-xs text-gray-500">{s.developer} · {s.platform === 'app-store' ? 'App Store' : 'Google Play'}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={state.status === 'loading'}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:bg-blue-700 transition disabled:opacity-60"
        >
          {state.status === 'loading' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Search className="w-5 h-5" />
          )}
          Check
        </button>
      </form>
      {renderResult()}
    </div>
  );
};

export default QuickLookup;
