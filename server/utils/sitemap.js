/**
 * Sitemap: only URLs that actually resolve (HTTP 200).
 *
 * Pure helpers + a small service with injected dependencies (Supabase client,
 * clock, expiry) so the filtering and caching logic are unit-testable without
 * a database. Wired up in server/sitemap.js.
 *
 * What is listed:
 *  - STATIC_ROUTES (home, /for-teams, /app, /app-insights, blog)
 *  - /shared-app-report/<hash>: analysis_reports rows that are not expired AND
 *    whose storage zip exists -- via the public.sitemap_app_reports() RPC
 *    (supabase/migrations/20261006120000_*.sql), which checks storage.objects
 *    in SQL. If that function is not deployed yet we fall back to the plain
 *    table (expiry-filtered only) and report storageVerified=false.
 *  - /shared-competitor-report/<hash>: comparison_reports rows that are not
 *    expired. The report text lives in the row itself and the endpoint reads
 *    the table on a cache miss, so a row == a 200.
 * Never listed: /share/* (legacy alias, canonical is /shared-app-report/*).
 */
import { create } from 'xmlbuilder2';

export const SHARE_HASH_RE = /^[0-9a-f]{32}$/i;
export const PAGE_SIZE = 1000; // PostgREST max-rows clamps single responses to ~1000
export const MAX_APP_REPORTS = 20000;
export const MAX_COMPETITOR_REPORTS = 5000; // sitemap protocol limit is 50k URLs/file
export const SITEMAP_TTL_MS = 60 * 60 * 1000;

// Static routes. Keep in sync with src/App.tsx routes and src/blog/Posts.ts.
// lastmod must be real, never "now": blog posts use their publish date,
// /app-insights the newest listed report (its first page changes then), and
// pages whose content only changes on a frontend deploy omit lastmod (the
// backend cannot know that date, and a fake one teaches Google to ignore it).
export const STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/for-teams', changefreq: 'monthly', priority: '0.9' },
  { path: '/app', changefreq: 'monthly', priority: '0.8' },
  { path: '/app-insights', changefreq: 'daily', priority: '0.7', lastmod: 'newest-report' },
  { path: '/blog', changefreq: 'weekly', priority: '0.8', lastmod: 'newest-post' },
  { path: '/blog/find-app-ideas', changefreq: 'monthly', priority: '0.7', lastmod: '2025-05-20' },
  { path: '/blog/app-review-analysis', changefreq: 'monthly', priority: '0.7', lastmod: '2025-05-27' },
  { path: '/blog/app-ideas-from-reviews', changefreq: 'monthly', priority: '0.7', lastmod: '2026-08-06' },
  { path: '/blog/competitor-research-afternoon', changefreq: 'monthly', priority: '0.7', lastmod: '2026-08-06' },
];

/** ms epoch / ISO string / null -> finite ms or null. */
export function toMillis(ts) {
  if (ts === null || ts === undefined || ts === '') return null;
  const n = typeof ts === 'number' ? ts : /^\d+$/.test(String(ts)) ? Number(ts) : Date.parse(ts);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Keep rows that would answer 200 as far as the DB can tell: md5 share hash,
 * not expired (NULL timestamp = not expired, matching isRowExpired), unique.
 * Output: [{ hash, ts }] newest first (NULL timestamps last), capped.
 */
export function filterLiveRecords(rows, { minTimestamp = 0, max = Infinity } = {}) {
  const seen = new Set();
  const out = [];
  for (const row of rows || []) {
    const hash = row && typeof row.hash_url === 'string' ? row.hash_url.trim() : '';
    if (!SHARE_HASH_RE.test(hash)) continue;
    const key = hash.toLowerCase();
    if (seen.has(key)) continue;
    const ts = toMillis(row.timestamp);
    if (ts !== null && ts < minTimestamp) continue; // expired
    seen.add(key);
    out.push({ hash, ts });
  }
  out.sort((a, b) => (b.ts ?? -1) - (a.ts ?? -1) || (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0));
  return out.length > max ? out.slice(0, max) : out;
}

const isoDate = (ms) => new Date(ms).toISOString();

function staticLastmod(route, { appReports }) {
  if (route.lastmod === 'newest-report') {
    const ts = appReports.find((r) => r.ts !== null)?.ts;
    return ts ? isoDate(ts) : null;
  }
  if (route.lastmod === 'newest-post') {
    const dates = STATIC_ROUTES.map((r) => r.lastmod).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '')).sort();
    return dates.length ? dates[dates.length - 1] : null;
  }
  return route.lastmod || null;
}

/** Build the XML. lastmod is omitted (never invented) when unknown. */
export function buildSitemapXml({ origin, appReports = [], competitorReports = [], staticRoutes = STATIC_ROUTES }) {
  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('urlset', {
    xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9',
  });
  const add = (loc, lastmod, changefreq, priority) => {
    const url = root.ele('url');
    url.ele('loc').txt(loc);
    if (lastmod) url.ele('lastmod').txt(lastmod);
    if (changefreq) url.ele('changefreq').txt(changefreq);
    if (priority) url.ele('priority').txt(priority);
  };
  for (const route of staticRoutes) {
    add(`${origin}${route.path}`, staticLastmod(route, { appReports }), route.changefreq, route.priority);
  }
  for (const r of appReports) {
    add(`${origin}/shared-app-report/${r.hash}`, r.ts ? isoDate(r.ts) : null, 'monthly', '0.8');
  }
  for (const r of competitorReports) {
    add(`${origin}/shared-competitor-report/${r.hash}`, r.ts ? isoDate(r.ts) : null, 'monthly', '0.6');
  }
  return root.end({ prettyPrint: true });
}

/** PostgREST "function not found" (migration not applied yet). */
export function isMissingFunctionError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  return code === 'PGRST202' || code === '42883' ||
    /could not find the function|function .* does not exist/i.test(String(error.message || ''));
}

async function pageThrough(fetchPage, max) {
  const rows = [];
  for (let offset = 0; rows.length < max; offset += PAGE_SIZE) {
    const { data, error } = await fetchPage(offset);
    if (error) return { rows, error };
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { rows, error: null };
}

/**
 * @param {object} deps
 * @param {object} deps.supabase      supabase-js client
 * @param {() => number} [deps.now]
 * @param {() => number} deps.expirationMs
 * @param {object} [deps.log]
 */
export function createSitemapService({ supabase, now = Date.now, expirationMs, log = console }) {
  const state = { xml: null, origin: null, generatedAt: 0, meta: null, inflight: null };

  async function fetchAppReports(minTimestamp) {
    const viaRpc = await pageThrough(
      (offset) => supabase.rpc('sitemap_app_reports', { p_min_timestamp: minTimestamp, p_limit: PAGE_SIZE, p_offset: offset }),
      MAX_APP_REPORTS,
    );
    if (!viaRpc.error) return { rows: viaRpc.rows, storageVerified: true };
    if (!isMissingFunctionError(viaRpc.error)) throw viaRpc.error;

    log.warn('sitemap: public.sitemap_app_reports() not deployed; listing app reports WITHOUT the storage check (apply supabase/migrations/20261006120000_*.sql)');
    const viaTable = await pageThrough(
      (offset) => supabase
        .from('analysis_reports')
        .select('hash_url, timestamp')
        .or(`timestamp.is.null,timestamp.gte.${minTimestamp}`)
        .order('timestamp', { ascending: false, nullsFirst: false })
        .order('hash_url', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1),
      MAX_APP_REPORTS,
    );
    if (viaTable.error) throw viaTable.error;
    return { rows: viaTable.rows, storageVerified: false };
  }

  async function fetchCompetitorReports(minTimestamp) {
    const res = await pageThrough(
      (offset) => supabase
        .from('comparison_reports')
        .select('hash_url, timestamp')
        .or(`timestamp.is.null,timestamp.gte.${minTimestamp}`)
        .order('timestamp', { ascending: false, nullsFirst: false })
        .order('hash_url', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1),
      MAX_COMPETITOR_REPORTS,
    );
    if (res.error) throw res.error;
    return res.rows;
  }

  async function rebuild(origin) {
    const started = now();
    const minTimestamp = Math.max(0, started - expirationMs());
    const [app, competitorRows] = await Promise.all([fetchAppReports(minTimestamp), fetchCompetitorReports(minTimestamp)]);
    const appReports = filterLiveRecords(app.rows, { minTimestamp, max: MAX_APP_REPORTS });
    const competitorReports = filterLiveRecords(competitorRows, { minTimestamp, max: MAX_COMPETITOR_REPORTS });
    state.xml = buildSitemapXml({ origin, appReports, competitorReports });
    state.origin = origin;
    state.generatedAt = now();
    state.meta = {
      appReports: appReports.length,
      competitorReports: competitorReports.length,
      staticRoutes: STATIC_ROUTES.length,
      storageVerified: app.storageVerified,
      generatedAt: new Date(state.generatedAt).toISOString(),
      buildMs: state.generatedAt - started,
    };
    log.log('sitemap rebuilt', state.meta);
    return state.xml;
  }

  // Single-flight: concurrent requests share one rebuild.
  function refresh(origin) {
    if (!state.inflight) {
      state.inflight = rebuild(origin).finally(() => { state.inflight = null; });
    }
    return state.inflight;
  }

  /**
   * Fresh cache -> serve it. Stale cache -> serve it and refresh in the
   * background (a slow/failed DB never blocks or breaks /sitemap.xml).
   * No cache -> wait for the first build (throws if it fails).
   * Every rebuild is a full rebuild, so deleted/expired/missing-object rows
   * drop out within one TTL (the old incremental merge never removed any).
   */
  async function generate(origin) {
    if (state.xml && state.origin === origin) {
      if (now() - state.generatedAt >= SITEMAP_TTL_MS) {
        refresh(origin).catch((err) => log.error('sitemap background refresh failed (serving stale):', err?.message || err));
      }
      return state.xml;
    }
    return refresh(origin);
  }

  return { generate, refresh, getMeta: () => state.meta, _state: state };
}
