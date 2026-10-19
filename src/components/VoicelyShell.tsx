import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, LayoutDashboard, Bell, Sparkles, GitCompare, CreditCard, Search, Menu, MessageSquare, X } from 'lucide-react';
import { BRAND } from '../config/brand';
import UserMenu from './UserMenu';
import '../styles/voicely.css';

export type WorkspaceView = 'next' | 'reviews' | 'opportunities' | 'compare' | 'board' | 'sources' | 'plans';
const sections = [
  { id: 'next', label: 'Overview', icon: LayoutDashboard },
  { id: 'reviews', label: 'Review explorer', icon: MessageSquare },
  { id: 'opportunities', label: 'Opportunities', icon: Sparkles },
  { id: 'compare', label: 'Compare apps', icon: GitCompare },
  { id: 'board', label: 'Decision board', icon: Bookmark },
  { id: 'sources', label: 'Watchlist', icon: Bell },
  { id: 'plans', label: 'Plans & usage', icon: CreditCard },
] as const;

export default function VoicelyShell({ children, view, onNavigate, busy, savedCount, onAnalyze }: {
  children: ReactNode; view: WorkspaceView; onNavigate: (view: WorkspaceView) => void; busy: boolean; savedCount: number; onAnalyze: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menu) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebarRef.current?.querySelector<HTMLButtonElement>('.voicely-drawer-close')?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(false);
      if (event.key === 'Tab') {
        const items = [...(sidebarRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') || [])];
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const resize = () => { if (window.innerWidth > 700) setMenu(false); };
    window.addEventListener('keydown', close);
    window.addEventListener('resize', resize);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', close); window.removeEventListener('resize', resize); previousFocus?.focus(); };
  }, [menu]);
  useEffect(() => {
    const search = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (!busy && !document.querySelector('dialog[open]')) onAnalyze();
      }
    };
    window.addEventListener('keydown', search);
    return () => window.removeEventListener('keydown', search);
  }, [busy, onAnalyze]);
  useEffect(() => {
    const previous = document.title;
    document.title = `${BRAND.name} | ${BRAND.tagline}`;
    return () => { document.title = previous; };
  }, []);
  const navigate = (next: WorkspaceView) => { onNavigate(next); setMenu(false); window.scrollTo({ top: 0, behavior: 'instant' }); };
  return <div className="voicely-workspace">
    <a className="voicely-skip" href="#voicely-main">Skip to workspace</a>
    {menu && <button className="voicely-nav-backdrop" aria-label="Dismiss navigation" onClick={() => setMenu(false)} />}
    <aside ref={sidebarRef} className={`voicely-sidebar ${menu ? 'is-open' : ''}`} aria-label="Workspace navigation" onKeyDown={event => { if (event.key === 'Escape') setMenu(false); }}>
      <button className="voicely-drawer-close" aria-label="Close navigation drawer" onClick={() => setMenu(false)}><X /></button>
      <Link to="/market" className="voicely-brand" onClick={() => navigate('next')}><MessageSquare aria-hidden="true" /><span>{BRAND.name}<span className="voicely-brand-dot">.</span></span></Link>
      <p className="voicely-workspace-label">Product workspace</p>
      <nav aria-label="Product research">{sections.map(({ id, label, icon: Icon }) => <button key={id} disabled={busy} aria-current={view === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon aria-hidden="true" /><span>{label}</span>{id === 'board' && savedCount > 0 && <span className="voicely-count">{savedCount}</span>}</button>)}</nav>
      <div className="voicely-sidebar-bottom">
        <p className="voicely-local-status">Browser workspace<span>Saved on this device</span></p>
      </div>
    </aside>
    <div className="voicely-content">
      <header className="voicely-topbar">
        <button className="voicely-mobile-toggle" aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} onClick={() => setMenu(value => !value)}>{menu ? <X /> : <Menu />}</button>
        <span>{BRAND.name} <span aria-hidden="true">/</span> <strong>{sections.find(section => section.id === view)?.label}</strong></span>
        <button className="voicely-global-search" disabled={busy} onClick={onAnalyze}><Search />Search apps or paste a store link</button>
        <div className="flex items-center gap-3"><span className="voicely-preview">Preview</span><UserMenu /></div>
      </header>
      {children}
    </div>
  </div>;
}
