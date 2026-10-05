import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, Plus, Search, Smartphone, X } from 'lucide-react';
import { SERVER_URL } from './Constants';
import { parseResearchApp, storeAppKey, type ResearchApp, type ResearchScope } from '../utils/marketResearchFlow';
import type { WatchApp } from '../utils/marketIntelligence';

interface Props {
  scope: ResearchScope; onChange: (scope: ResearchScope) => void; apps: WatchApp[];
  busy: boolean; available: boolean; unavailableReason?: string; token: string | null;
  onBusyChange: (busy: boolean) => void; onDirty: (dirty: boolean) => void;
}

export default function ResearchStart({ scope, onChange, apps, busy, available, unavailableReason, token, onBusyChange, onDirty }: Props) {
  const [query, setQuery] = useState(scope.query);
  const [country, setCountry] = useState(scope.country);
  const [finding, setFinding] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [manual, setManual] = useState('');
  const [matches, setMatches] = useState<ResearchApp[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const active = useRef(false);
  const dirty = query.trim() !== scope.query || country !== scope.country;
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  useEffect(() => {
    setMatches([]);
    setSearching(false);
    setSearched(false);
    if (!showAdd || manual.trim().length < 2 || /^https?:\/\//i.test(manual.trim())) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`${SERVER_URL}/api/search-apps?query=${encodeURIComponent(manual.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error('App search unavailable. You can still paste a store link.');
        const result = await response.json();
        if (!controller.signal.aborted) setMatches((result.results || []).map(parseResearchApp).filter((app: ResearchApp | null): app is ResearchApp => !!app));
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'App search unavailable.'); }
      finally { if (!controller.signal.aborted) { setSearching(false); setSearched(true); } }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [manual, showAdd]);

  const discover = async () => {
    if (active.current || busy || !available || !query.trim()) return;
    active.current = true; setFinding(true); onBusyChange(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${SERVER_URL}/api/market/discover`, { method: 'POST', headers, body: JSON.stringify({ query: query.trim(), country }), signal: AbortSignal.timeout(240000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not find related apps.');
      if (!Array.isArray(data.apps) || data.apps.length > 5 || typeof data.scope !== 'string' || data.scope.length > 160 || !/^[a-z]{2}$/.test(data.country)) throw new Error('App search returned an invalid research scope.');
      const candidates = data.apps.map(parseResearchApp);
      if (candidates.some((app: ResearchApp | null) => !app)) throw new Error('App search returned an invalid store link.');
      onChange({ query: query.trim(), title: data.scope, country: data.country, apps: candidates });
      setCountry(data.country);
      setNotice(data.partial ? 'Some store searches failed. These are the available matches; you can add another app or retry.' : candidates.length ? '' : 'No sufficiently relevant apps found. Try a more specific field or add an app.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Related-app search failed.'); }
    finally { active.current = false; setFinding(false); onBusyChange(false); }
  };

  const add = (app: ResearchApp) => {
    if (scope.apps.some(item => item.key === app.key)) { setError('This app is already included.'); return; }
    if (scope.apps.length >= 5) { setError('This research includes up to 5 apps. Remove one to add another.'); return; }
    onChange({ ...scope, apps: [...scope.apps, app] });
    setManual(''); setMatches([]); setError(''); setShowAdd(false);
  };

  const addUrl = async () => {
    if (active.current || busy) return;
    if (!storeAppKey(manual.trim())) { setError('Choose a search result or paste an App Store / Google Play link.'); return; }
    active.current = true; setAdding(true); onBusyChange(true); setError('');
    try {
      const response = await fetch(`${SERVER_URL}/api/market/resolve-app`, { method: 'POST', headers, body: JSON.stringify({ url: manual.trim() }), signal: AbortSignal.timeout(45000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not verify this app.');
      const app = parseResearchApp(result);
      if (!app) throw new Error('Store returned invalid app details.');
      add(app);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not add app.'); }
    finally { active.current = false; setAdding(false); onBusyChange(false); }
  };

  const savedApps = apps.filter(app => !app.sample && !scope.apps.some(item => item.key === storeAppKey(app.url)));
  return <section className="py-6 border-b border-gray-200">
    <form onSubmit={event => { event.preventDefault(); void discover(); }}>
      <label htmlFor="research-start" className="block text-lg font-medium text-gray-950">Which field or app are you exploring?</label>
      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <input id="research-start" value={query} onChange={event => setQuery(event.target.value)} disabled={busy} maxLength={400} placeholder="Photo management, an app name, or a store link" className="min-w-0 flex-1 border border-gray-300 rounded px-3 py-3 text-sm focus:ring-2 focus:ring-teal-600" />
        <button disabled={busy || !available || !query.trim()} className="inline-flex items-center justify-center gap-2 rounded bg-teal-700 px-4 py-3 text-white text-sm font-medium disabled:opacity-50">{finding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}{finding ? 'Finding related apps...' : 'Find related apps'}</button>
      </div>
      <details className="mt-3 text-xs text-gray-500"><summary className="cursor-pointer w-fit">Region &amp; research limits</summary><div className="mt-3 flex flex-wrap gap-3 items-center"><label>Store region <select aria-label="Discovery region" disabled={busy} value={country} onChange={event => setCountry(event.target.value)} className="ml-2 border border-gray-300 rounded p-1 text-gray-700">{[...new Set([country, 'us', 'gb', 'ca', 'au', 'de', 'fr', 'jp', 'cn'])].map(code => <option key={code} value={code}>{code.toUpperCase()}</option>)}</select></label><span>Up to 5 apps; analyses up to 120 reviews per run. Model usage applies when you start a search or research.</span></div></details>
    </form>
    {!available && <p className="mt-3 text-sm text-amber-800">{unavailableReason || 'Checking research service...'}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700 break-words">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-amber-800">{notice}</p>}
    {(scope.apps.length > 0 || scope.query || showAdd) && <div className="mt-5">
      <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-gray-900 break-words">{scope.title} <span className="font-normal text-gray-500">· {scope.apps.length} {scope.apps.length === 1 ? 'app' : 'apps'}</span></h2><button disabled={busy || scope.apps.length >= 5} onClick={() => setShowAdd(value => !value)} className="inline-flex shrink-0 items-center gap-1 text-sm text-teal-800 disabled:opacity-50"><Plus className="w-4 h-4" />Add app</button></div>
      {dirty && !!scope.apps.length && <p className="mt-2 text-xs text-amber-800">Find related apps to apply your changed starting point.</p>}
      <ul className="mt-3 divide-y divide-gray-200">{scope.apps.map(app => <li key={app.key} className="flex items-center gap-3 py-3">
        {app.icon ? <img src={app.icon} alt="" className="w-9 h-9 rounded shrink-0 object-cover" /> : <Smartphone className="w-9 h-9 p-1 text-gray-400 shrink-0" />}
        <div className="min-w-0 flex-1"><p className="text-sm font-medium text-gray-900 break-words">{app.title}</p><p className="text-xs text-gray-500 mt-0.5 break-words">{app.reason} · {app.platform === 'ios' ? 'App Store' : 'Google Play'} · {app.key.split(':')[1].toUpperCase()}</p></div>
        <button disabled={busy} onClick={() => onChange({ ...scope, apps: scope.apps.filter(item => item.key !== app.key) })} title={`Remove ${app.title} from research`} aria-label={`Remove ${app.title} from research`} className="p-2 text-gray-500 shrink-0"><X className="w-4 h-4" /></button>
      </li>)}</ul>
    </div>}
    {!scope.apps.length && !scope.query && !showAdd && <button disabled={busy} onClick={() => setShowAdd(true)} className="mt-4 text-sm text-teal-800 inline-flex gap-1 items-center"><Plus className="w-4 h-4" />Add an app directly</button>}
    {showAdd && <div className="mt-4 border-t border-gray-200 pt-4">
      <form onSubmit={event => { event.preventDefault(); void addUrl(); }} className="flex gap-2"><input autoFocus aria-label="Add app name or store URL" value={manual} onChange={event => { setManual(event.target.value); setError(''); }} disabled={busy} placeholder="App name or store link" className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm" /><button disabled={busy || !storeAppKey(manual.trim())} title="Add app link" aria-label="Add app link" className="p-2 text-teal-800 disabled:opacity-40">{adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}</button></form>
      {searching && <p role="status" className="mt-2 text-sm text-gray-500">Searching apps...</p>}
      {searched && !searching && !matches.length && <p role="status" className="mt-2 text-sm text-gray-500">No matching apps. Try another name or paste a store link.</p>}
      <ul className="max-h-64 overflow-auto divide-y divide-gray-100 mt-2">{matches.map(app => <li key={app.key}><button disabled={busy} onClick={() => add(app)} className="w-full text-left px-2 py-3 text-sm hover:bg-gray-100"><span className="font-medium">{app.title}</span><span className="block text-xs text-gray-500">{app.developer} · {app.platform === 'ios' ? 'App Store' : 'Google Play'}</span></button></li>)}</ul>
      {!manual && savedApps.length > 0 && <div className="mt-2"><p className="text-xs text-gray-500">Saved sources</p>{savedApps.map(app => <button key={app.id} disabled={busy} onClick={() => add({ key: storeAppKey(app.url), title: app.name, appUrl: app.url, platform: app.platform, icon: app.icon, reason: 'From your saved sources' })} className="flex gap-2 items-center py-2 text-sm text-teal-800"><Plus className="w-4 h-4 shrink-0" />{app.name}</button>)}</div>}
    </div>}
  </section>;
}
