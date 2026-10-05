import { LRUCache } from 'lru-cache';
import { searchApps } from './appStoreScraper.js';
import { verifiedCandidate, searchGoogleApps } from './marketDiscovery.js';

const PAGE_SIZE = 20;
const STORE_LIMIT = 60;

export function createMarketAppSearch({ apple = (query, country, limit) => searchApps(query, { num: limit, country }),
  google = searchGoogleApps } = {}) {
  const cache = new LRUCache({ max: 100, ttl: 10 * 60000 });
  return async body => {
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const country = body?.country || 'us', platform = body?.platform || 'all', page = body?.page ?? 1;
    if (query.length < 2 || query.length > 400 || !/^[a-z]{2}$/.test(country) || !['all', 'ios', 'android'].includes(platform) || !Number.isInteger(page) || page < 1 || page > 6) {
      const error = new Error('Enter a search phrase, valid store region and page (1-6).'); error.status = 400; throw error;
    }
    const limit = body.suggest === true ? 6 : STORE_LIMIT;
    const key = JSON.stringify([query.toLowerCase(), country, platform, limit]);
    let pool = cache.get(key);
    if (!pool) {
      const searches = await Promise.allSettled([
        platform !== 'android' ? apple(query, country, limit) : Promise.resolve([]),
        platform !== 'ios' ? google(query, country, limit) : Promise.resolve([]),
      ]);
      const required = searches.filter((_result, index) => platform === 'all' || (index === 0 ? platform === 'ios' : platform === 'android'));
      if (required.every(result => result.status === 'rejected')) throw new Error('Store search unavailable.');
      const groups = searches.map(result => result.status === 'fulfilled' ? result.value.slice(0, limit).flatMap(app => {
        try {
          const url = new URL(app.url);
          if (url.hostname === 'play.google.com') url.searchParams.set('gl', country);
          const { description, ...metadata } = verifiedCandidate(app, url.href);
          return [{ ...metadata, reason: description ? description.slice(0, 180) : 'Store search result' }];
        } catch { return []; }
      }) : []);
      const seen = new Set(), apps = [];
      // Interleave stores so the first page is not consumed by just one platform.
      for (let index = 0; index < limit; index++) for (const group of groups) {
        const app = group[index];
        if (app && !seen.has(app.key)) { seen.add(app.key); apps.push(app); }
      }
      pool = { apps, partial: required.some(result => result.status === 'rejected') };
      cache.set(key, pool, { ttl: pool.partial ? 15000 : 10 * 60000 });
    }
    const totalPages = Math.max(1, Math.ceil(pool.apps.length / PAGE_SIZE));
    return { apps: pool.apps.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), page, totalPages, total: pool.apps.length,
      hasMore: page < totalPages, partial: pool.partial, limit: platform === 'all' ? limit * 2 : limit, country, platform };
  };
}

const search = createMarketAppSearch();
export function marketAppSearchHandler(local = false) {
  return async (req, res) => {
    if (local && req.headers.origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(req.headers.origin)) return res.status(403).json({ error: 'Local browser origin required.' });
    if (!local && !(req.user?.id || req.user?.sub)) return res.status(403).json({ error: 'Authenticated user required.' });
    try { res.json(await search(req.body)); }
    catch (error) { res.status(error.status === 400 ? 400 : 502).json({ error: error.status === 400 ? error.message : 'Store search unavailable. Retry or paste a store link.' }); }
  };
}
