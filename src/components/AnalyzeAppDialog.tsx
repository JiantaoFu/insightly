import { useEffect, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { LabDialog } from './LabWorkspace';
import { SERVER_URL } from './Constants';
import { marketRequest } from '../utils/appAnalysis';
import { parseResearchApp, storeAppKey, type ResearchApp } from '../utils/marketResearchFlow';

export default function AnalyzeAppDialog({ token, recent, onSelect, onClose, initialDays = 90 }: {
  token: string | null; recent: ResearchApp[]; onSelect: (app: ResearchApp, days: number) => void; onClose: () => void;
  initialDays?: number;
}) {
  const [query, setQuery] = useState(''), [country, setCountry] = useState('us'), [days, setDays] = useState(initialDays);
  const [page, setPage] = useState(1), [pages, setPages] = useState(1), [results, setResults] = useState<ResearchApp[]>([]);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [resolve, setResolve] = useState(false);
  useEffect(() => {
    setResults([]); setPages(1); setError(''); setLoading(false);
    if (query.trim().length < 2 || /^https?:\/\//i.test(query.trim())) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await marketRequest(SERVER_URL, '/api/market/search-apps', token, abort.signal, { query: query.trim(), country, platform: 'all', page });
        if (!Array.isArray(data.apps)) throw new Error('Invalid app search response.');
        if (!abort.signal.aborted) { setResults(data.apps.map(parseResearchApp).filter((app: ResearchApp | null): app is ResearchApp => !!app)); setPages(Math.max(1, data.totalPages || 1)); }
      } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'Search unavailable.'); }
      finally { if (!abort.signal.aborted) setLoading(false); }
    }, 350);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [query, country, page, token]);
  useEffect(() => {
    if (!resolve) return;
    const abort = new AbortController();
    marketRequest(SERVER_URL, '/api/market/resolve-app', token, abort.signal, { url: query.trim() }).then(data => {
      const app = parseResearchApp(data); if (!app) throw new Error('Could not identify this app.');
      if (!abort.signal.aborted) onSelect(app, days);
    }).catch(e => { if (!abort.signal.aborted) setError(e.message); }).finally(() => { if (!abort.signal.aborted) setResolve(false); });
    return () => abort.abort();
  }, [resolve, query, days, token, onSelect]);
  const list = query.trim() ? results : recent;
  return <LabDialog title="Analyze an app" onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); if (storeAppKey(query.trim())) { setError(''); setResolve(true); } }}>
      <label className="block font-medium" htmlFor="analyze-app-search">App name or store link</label>
      <div className="flex gap-2 mt-3"><input autoFocus id="analyze-app-search" type="search" disabled={resolve} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search an app or paste its store URL" className="border rounded p-3 min-w-0 flex-1" /><button className="voicely-button primary" disabled={resolve || !storeAppKey(query.trim())} aria-label="Analyze store link" title="Analyze store link">{resolve ? <Loader2 className="animate-spin" /> : <ArrowRight />}</button></div>
      <div className="voicely-controls"><label>Region<select aria-label="Store region" disabled={resolve} value={country} onChange={event => { setCountry(event.target.value); setPage(1); }}>{['us','gb','ca','au','de','fr','jp','cn'].map(code => <option key={code} value={code}>{code.toUpperCase()}</option>)}</select></label><label>Time range<select aria-label="Analysis period" disabled={resolve} value={days} onChange={event => setDays(Number(event.target.value))}><option value={90}>Last 90 days</option><option value={30}>Last 30 days</option></select></label></div>
    </form>
    {loading && <p role="status" className="flex gap-2 mt-4"><Loader2 className="animate-spin" />Searching stores...</p>}
    {error && <p role="alert" className="text-red-700 mt-4">{error}</p>}
    {!query && <h3 className="voicely-panel-title">Recent apps</h3>}
    <div className="divide-y">{list.map(app => <button disabled={resolve} key={app.key} className="flex items-center gap-3 text-left w-full py-4" onClick={() => onSelect(app, days)}>{app.icon ? <img src={app.icon} alt="" className="w-10 h-10 rounded" /> : <Search className="shrink-0" />}<span className="flex-1 min-w-0"><strong className="block break-words">{app.title}</strong><small className="voicely-muted">{app.developer} · {app.platform === 'ios' ? 'App Store' : 'Google Play'} · {app.key.split(':')[1].toUpperCase()}</small></span><ArrowRight className="shrink-0 w-4" /></button>)}</div>
    {!loading && query.trim().length >= 2 && !/^https?:\/\//i.test(query.trim()) && !results.length && !error && <p className="voicely-muted mt-4">No matching apps.</p>}
    {pages > 1 && <nav aria-label="App search pages" className="voicely-toolbar"><button className="voicely-button" aria-label="Previous app page" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft /></button><span>Page {page} of {pages}</span><button className="voicely-button" aria-label="Next app page" disabled={loading || page >= pages} onClick={() => setPage(page + 1)}><ChevronRight /></button></nav>}
  </LabDialog>;
}
