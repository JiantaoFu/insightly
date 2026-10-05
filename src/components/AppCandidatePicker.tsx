import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search, Smartphone } from 'lucide-react';
import { SERVER_URL } from './Constants';
import { parseResearchApp, type ResearchApp } from '../utils/marketResearchFlow';

interface Props {
  initialQuery: string; country: string; selected: ResearchApp[]; busy: boolean; token: string | null;
  onToggle: (app: ResearchApp) => void;
}

export default function AppCandidatePicker({ initialQuery, country, selected, busy, token, onToggle }: Props) {
  const [draft, setDraft] = useState(initialQuery);
  const [search, setSearch] = useState({ query: initialQuery.trim(), platform: 'all', page: 1, retry: 0 });
  const [result, setResult] = useState<{ apps: ResearchApp[]; total: number; pages: number; limit: number; partial: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const container = useRef<HTMLElement>(null);
  const goToPage = (page: number) => { setSearch(previous => ({ ...previous, page })); container.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  useEffect(() => {
    setResult(null); setError(''); setLoading(false);
    if (search.query.length < 2) return;
    const abort = new AbortController(); setLoading(true);
    fetch(`${SERVER_URL}/api/market/search-apps`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ query: search.query, country, platform: search.platform, page: search.page }), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(60000)]) })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'App search failed.');
        if (!Array.isArray(data.apps) || !Number.isInteger(data.total) || !Number.isInteger(data.totalPages)) throw new Error('Invalid search results.');
        if (!abort.signal.aborted) setResult({ apps: data.apps.map(parseResearchApp).filter((app: ResearchApp | null): app is ResearchApp => !!app), total: data.total, pages: data.totalPages, limit: data.limit, partial: !!data.partial });
      }).catch(error => { if (!abort.signal.aborted) setError(error instanceof Error ? error.message : 'App search failed.'); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [search, country, token]);

  return <section ref={container} aria-label="Browse app candidates" className="mt-5 border-t border-gray-200 pt-4 scroll-mt-24">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Browse store results</h3><span className="text-xs text-gray-500">{selected.length}/5 selected · {country.toUpperCase()} · no model usage</span></div>
    <form className="mt-3 flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); if (draft.trim().length >= 2) setSearch(previous => ({ ...previous, query: draft.trim(), page: 1, retry: previous.retry + 1 })); }}>
      <input aria-label="Search more apps" value={draft} onChange={event => setDraft(event.target.value)} maxLength={400} disabled={busy} placeholder="App name or keywords" className="flex-1 min-w-0 basis-48 border border-gray-300 rounded px-3 py-2 text-sm" />
      <select aria-label="Candidate platform" value={search.platform} disabled={busy} onChange={event => setSearch(previous => ({ ...previous, platform: event.target.value, page: 1 }))} className="border border-gray-300 rounded p-2 text-sm"><option value="all">Both stores</option><option value="ios">App Store</option><option value="android">Google Play</option></select>
      <button disabled={busy || draft.trim().length < 2} title="Search store candidates" aria-label="Search store candidates" className="border border-gray-300 rounded p-2 text-teal-800"><Search className="w-5 h-5" /></button>
    </form>
    {selected.length >= 5 && <p className="mt-3 text-xs text-amber-800">5 apps selected. Remove one from your research to choose another.</p>}
    {loading && <p role="status" className="mt-4 flex gap-2 items-center text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" />Searching stores...</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {result && <>
      <p className="mt-3 text-xs text-gray-500">{result.total} results available{result.total >= result.limit ? ` · first ${result.limit} store matches` : ''}{result.partial ? ' · one store is unavailable' : ''}</p>
      <ul className="mt-2 grid sm:grid-cols-2 gap-x-5">{result.apps.map(app => {
        const checked = selected.some(item => item.key === app.key);
        return <li key={app.key} className="border-b border-gray-200"><label className={`flex gap-3 py-3 items-start ${busy || (!checked && selected.length >= 5) ? 'opacity-60' : 'cursor-pointer'}`}>
          <input type="checkbox" aria-label={`Select ${app.title} (${app.platform === 'ios' ? 'App Store' : 'Google Play'})`} checked={checked} disabled={busy || (!checked && selected.length >= 5)} onChange={() => onToggle(app)} className="mt-2 shrink-0 accent-teal-700" />
          {app.icon ? <img src={app.icon} alt="" loading="lazy" className="w-9 h-9 rounded shrink-0" /> : <Smartphone className="w-9 h-9 text-gray-400 shrink-0" />}
          <span className="min-w-0"><span className="block text-sm font-medium break-words">{app.title}</span><span className="block mt-1 text-xs text-gray-500 break-words">{app.developer} · {app.platform === 'ios' ? 'App Store' : 'Google Play'}</span><span className="block mt-1 text-xs text-gray-500 line-clamp-2 break-words">{app.reason}</span></span>
        </label></li>;
      })}</ul>
      {!result.total && <p className="mt-3 text-sm text-gray-500">No matching apps. Try another keyword, store or region, or add a store link.</p>}
      <nav aria-label="Candidate pages" className="mt-4 flex items-center justify-between gap-3">
        <button title="Previous candidate page" aria-label="Previous candidate page" disabled={busy || search.page <= 1} onClick={() => goToPage(search.page - 1)} className="p-2 border border-gray-300 rounded disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-sm text-gray-600">Page {search.page} of {result.pages}</span>
        <button title="Next candidate page" aria-label="Next candidate page" disabled={busy || search.page >= result.pages} onClick={() => goToPage(search.page + 1)} className="p-2 border border-gray-300 rounded disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
      </nav>
    </>}
  </section>;
}
