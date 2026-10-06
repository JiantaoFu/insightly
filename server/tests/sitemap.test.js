import {
  STATIC_ROUTES, PAGE_SIZE, SITEMAP_TTL_MS, toMillis, filterLiveRecords, buildSitemapXml,
  isMissingFunctionError, createSitemapService,
} from '../utils/sitemap.js';
import { recordExpirationHours } from '../utils/reportLookup.js';

const ORIGIN = 'https://insightly.top';
const NOW = Date.parse('2026-10-06T12:00:00Z');
const HOUR = 3600e3;
const h = (n) => n.toString(16).padStart(32, '0'); // fake md5 hash
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const urlBlocks = (xml) => [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
const silent = { log() {}, warn() {}, error() {} };

/** Minimal fake of the supabase-js query builders used by the service. */
function fakeSupabase({ appRows = [], competitorRows = [], rpcError = null, tableError = null, calls = [] } = {}) {
  const page = (rows, from, to) => ({ data: rows.slice(from, to + 1), error: null });
  const builder = (table) => {
    const q = { table, filters: [] };
    const b = {
      select(cols) { q.select = cols; return b; },
      or(f) { q.filters.push(f); return b; },
      order() { return b; },
      range(from, to) {
        calls.push({ kind: 'table', table, from, to, filters: q.filters });
        if (tableError) return Promise.resolve({ data: null, error: tableError });
        const rows = table === 'analysis_reports' ? appRows : competitorRows;
        return Promise.resolve(page(rows, from, to));
      },
    };
    return b;
  };
  return {
    from: builder,
    rpc(name, args) {
      calls.push({ kind: 'rpc', name, args });
      if (rpcError) return Promise.resolve({ data: null, error: rpcError });
      // Simulate the SQL function: storage existence + expiry + paging.
      const live = appRows.filter((r) => r.hasObject !== false && (r.timestamp == null || r.timestamp >= args.p_min_timestamp));
      return Promise.resolve(page(live, args.p_offset, args.p_offset + args.p_limit - 1));
    },
  };
}

describe('sitemap', () => {
  describe('filterLiveRecords', () => {
    it('drops expired rows, keeps NULL timestamps, invalid hashes and dupes out, newest first', () => {
      const min = NOW - 24 * HOUR;
      const out = filterLiveRecords([
        { hash_url: h(1), timestamp: NOW - HOUR },
        { hash_url: h(2), timestamp: NOW - 48 * HOUR },      // expired
        { hash_url: h(3), timestamp: null },                 // legacy: kept, sorted last
        { hash_url: 'null', timestamp: NOW },                // junk
        { hash_url: 'doesnotexist123', timestamp: NOW },     // not a share id
        { hash_url: h(1), timestamp: NOW - HOUR },           // duplicate
        { hash_url: h(4), timestamp: String(NOW - 2 * HOUR) }, // bigint as string
        { hash_url: h(5), timestamp: new Date(NOW - 3 * HOUR).toISOString() },
      ], { minTimestamp: min });
      expect(out.map((r) => r.hash)).to.deep.equal([h(1), h(4), h(5), h(3)]);
      expect(out[3].ts).to.equal(null);
    });
    it('caps', () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({ hash_url: h(i + 1), timestamp: NOW - i }));
      expect(filterLiveRecords(rows, { max: 3 }).map((r) => r.hash)).to.deep.equal([h(1), h(2), h(3)]);
    });
    it('toMillis', () => {
      expect(toMillis(null)).to.equal(null);
      expect(toMillis('garbage')).to.equal(null);
      expect(toMillis(0)).to.equal(null);
      expect(toMillis('1759700000000')).to.equal(1759700000000);
    });
  });

  describe('buildSitemapXml', () => {
    const xml = buildSitemapXml({
      origin: ORIGIN,
      appReports: [{ hash: h(1), ts: NOW - HOUR }, { hash: h(3), ts: null }],
      competitorReports: [{ hash: h(9), ts: NOW - 5 * HOUR }],
    });
    const blocks = urlBlocks(xml);

    it('keeps the indexed static pages and adds the report URLs', () => {
      const l = locs(xml);
      for (const p of ['/', '/for-teams', '/app', '/app-insights']) expect(l).to.include(`${ORIGIN}${p}`);
      expect(l).to.include(`${ORIGIN}/shared-app-report/${h(1)}`);
      expect(l).to.include(`${ORIGIN}/shared-competitor-report/${h(9)}`);
      expect(l.length).to.equal(STATIC_ROUTES.length + 3);
    });
    it('never lists /share/* legacy URLs', () => {
      expect(xml).to.not.match(/\/share\//);
    });
    it('lastmod is the report timestamp, omitted when unknown, never "now"', () => {
      const app1 = blocks.find((b) => b.includes(h(1)));
      expect(app1).to.include(`<lastmod>${new Date(NOW - HOUR).toISOString()}</lastmod>`);
      const legacy = blocks.find((b) => b.includes(`shared-app-report/${h(3)}`));
      expect(legacy).to.not.include('<lastmod>');
      const comp = blocks.find((b) => b.includes(h(9)));
      expect(comp).to.include(`<lastmod>${new Date(NOW - 5 * HOUR).toISOString()}</lastmod>`);
    });
    it('static lastmods are real: none for deploy-only pages, newest report for /app-insights, post dates for blog', () => {
      const get = (p) => blocks.find((b) => b.includes(`<loc>${ORIGIN}${p}</loc>`));
      for (const p of ['/', '/for-teams', '/app']) expect(get(p)).to.not.include('<lastmod>');
      expect(get('/app-insights')).to.include(`<lastmod>${new Date(NOW - HOUR).toISOString()}</lastmod>`);
      expect(get('/blog/find-app-ideas')).to.include('<lastmod>2025-05-20</lastmod>');
      expect(get('/blog')).to.include('<lastmod>2026-08-06</lastmod>');
      const today = new Date().toISOString().slice(0, 10);
      for (const p of ['/', '/for-teams', '/app', '/blog']) expect(get(p)).to.not.include(`<lastmod>${today}`);
    });
  });

  describe('createSitemapService', () => {
    const expirationMs = () => 24 * HOUR;
    const appRows = [
      { hash_url: h(1), timestamp: NOW - HOUR },
      { hash_url: h(2), timestamp: NOW - HOUR, hasObject: false }, // row without storage zip
      { hash_url: h(3), timestamp: NOW - 48 * HOUR },              // expired
      { hash_url: h(4), timestamp: null },                         // legacy
    ];
    const competitorRows = [
      { hash_url: h(10), timestamp: NOW - 2 * HOUR },
      { hash_url: h(11), timestamp: NOW - 72 * HOUR },             // expired
    ];

    it('lists only reports that resolve (storage-verified via the RPC)', async () => {
      const calls = [];
      const svc = createSitemapService({ supabase: fakeSupabase({ appRows, competitorRows, calls }), now: () => NOW, expirationMs, log: silent });
      const l = locs(await svc.generate(ORIGIN));
      expect(l).to.include(`${ORIGIN}/shared-app-report/${h(1)}`);
      expect(l).to.include(`${ORIGIN}/shared-app-report/${h(4)}`);
      expect(l).to.not.include(`${ORIGIN}/shared-app-report/${h(2)}`);
      expect(l).to.not.include(`${ORIGIN}/shared-app-report/${h(3)}`);
      expect(l).to.include(`${ORIGIN}/shared-competitor-report/${h(10)}`);
      expect(l).to.not.include(`${ORIGIN}/shared-competitor-report/${h(11)}`);
      expect(svc.getMeta()).to.include({ appReports: 2, competitorReports: 1, storageVerified: true });
      const rpc = calls.find((c) => c.kind === 'rpc');
      expect(rpc.name).to.equal('sitemap_app_reports');
      expect(rpc.args.p_min_timestamp).to.equal(NOW - 24 * HOUR);
      expect(calls.find((c) => c.table === 'comparison_reports').filters[0]).to.equal(`timestamp.is.null,timestamp.gte.${NOW - 24 * HOUR}`);
    });

    it('falls back to the table (expiry only) when the RPC is not deployed', async () => {
      const svc = createSitemapService({
        supabase: fakeSupabase({ appRows, competitorRows, rpcError: { code: 'PGRST202', message: 'Could not find the function public.sitemap_app_reports' } }),
        now: () => NOW, expirationMs, log: silent,
      });
      const l = locs(await svc.generate(ORIGIN));
      expect(l).to.include(`${ORIGIN}/shared-app-report/${h(2)}`); // cannot know about storage here
      expect(l).to.not.include(`${ORIGIN}/shared-app-report/${h(3)}`); // still expiry-filtered (in JS too)
      expect(svc.getMeta().storageVerified).to.equal(false);
    });

    it('other RPC errors fail the build (no silent unverified sitemap)', async () => {
      const svc = createSitemapService({ supabase: fakeSupabase({ rpcError: { code: '57014', message: 'canceling statement due to statement timeout' } }), now: () => NOW, expirationMs, log: silent });
      let err; try { await svc.generate(ORIGIN); } catch (e) { err = e; }
      expect(err && err.code).to.equal('57014');
    });

    it('pages past PostgREST max-rows', async () => {
      const many = Array.from({ length: PAGE_SIZE * 2 + 5 }, (_, i) => ({ hash_url: h(i + 1), timestamp: NOW - i }));
      const calls = [];
      const svc = createSitemapService({ supabase: fakeSupabase({ appRows: many, calls }), now: () => NOW, expirationMs, log: silent });
      await svc.generate(ORIGIN);
      expect(svc.getMeta().appReports).to.equal(PAGE_SIZE * 2 + 5);
      expect(calls.filter((c) => c.kind === 'rpc').map((c) => c.args.p_offset)).to.deep.equal([0, PAGE_SIZE, PAGE_SIZE * 2]);
    });

    it('serves cache, refreshes stale in background, keeps stale XML when refresh fails, drops removed rows', async () => {
      let t = NOW;
      const rows = [...appRows];
      const sb = fakeSupabase({ appRows: rows, competitorRows });
      const svc = createSitemapService({ supabase: sb, now: () => t, expirationMs, log: silent });
      const first = await svc.generate(ORIGIN);
      rows.shift(); // h(1) deleted from the DB
      t += 10 * 60e3;
      expect(await svc.generate(ORIGIN)).to.equal(first); // fresh cache, no rebuild
      t += SITEMAP_TTL_MS;
      expect(await svc.generate(ORIGIN)).to.equal(first); // stale served immediately...
      await svc._state.inflight;                          // ...while rebuilding
      const second = await svc.generate(ORIGIN);
      expect(second).to.not.include(h(1));                // full rebuild drops deleted rows
      sb.rpc = () => Promise.resolve({ data: null, error: { code: '500', message: 'boom' } });
      t += 2 * SITEMAP_TTL_MS;
      expect(await svc.generate(ORIGIN)).to.equal(second);
      await svc._state.inflight?.catch(() => {});
      expect(await svc.generate(ORIGIN)).to.equal(second); // still serving last good XML
    });

    it('single-flight: concurrent first requests share one build', async () => {
      const calls = [];
      const svc = createSitemapService({ supabase: fakeSupabase({ appRows, competitorRows, calls }), now: () => NOW, expirationMs, log: silent });
      const [a, b] = await Promise.all([svc.generate(ORIGIN), svc.generate(ORIGIN)]);
      expect(a).to.equal(b);
      expect(calls.filter((c) => c.kind === 'rpc').length).to.equal(1);
    });
  });

  it('isMissingFunctionError / recordExpirationHours', () => {
    expect(isMissingFunctionError({ code: 'PGRST202' })).to.equal(true);
    expect(isMissingFunctionError({ code: '42883', message: 'function public.sitemap_app_reports(bigint) does not exist' })).to.equal(true);
    expect(isMissingFunctionError({ code: '57014' })).to.equal(false);
    expect(recordExpirationHours({})).to.equal(24 * 7 * 365);
    expect(recordExpirationHours({ RECORD_EXPIRATION_HOURS: '48' })).to.equal(48);
    expect(recordExpirationHours({ RECORD_EXPIRATION_HOURS: 'x' })).to.equal(24 * 7 * 365);
  });
});
