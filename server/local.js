import express from 'express';
import cors from 'cors';
import { processAppStoreUrl, searchApps } from './appStoreScraper.js';
import { processGooglePlayUrl } from './googlePlayScraper.js';
import gplay from 'google-play-scraper';
import rateLimit from 'express-rate-limit';
import { classifierProfile, marketClassificationHandler } from './marketClassifier.js';
import { opportunityHandler } from './marketOpportunities.js';

// Account-free local entry point; production continues to use index.js.
const app = express();
app.use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1):\d+$/ }));
app.use(express.json({ limit: '512kb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', mode: 'local-market' }));
app.get('/api/market/classifier', (_req, res) => res.json(classifierProfile(true)));
app.post('/api/market/classify', rateLimit({ windowMs: 15 * 60000, max: 120, standardHeaders: true, legacyHeaders: false }), marketClassificationHandler(true));
app.post('/api/market/opportunities', rateLimit({ windowMs: 15 * 60000, max: 30, standardHeaders: true, legacyHeaders: false }), opportunityHandler(true));
app.get('/api/search-apps', async (req, res) => {
  const query = String(req.query.query || '').trim().slice(0, 100);
  if (query.length < 2) return res.json({ results: [] });
  const searches = await Promise.allSettled([
    searchApps(query, { num: 5, country: 'us' }),
    gplay.search({ term: query, num: 5, country: 'us', lang: 'en' }),
  ]);
  if (searches.every(search => search.status === 'rejected')) {
    return res.status(502).json({ error: 'App search unavailable. Try a store URL.' });
  }
  const results = searches.flatMap((search, index) => search.status === 'fulfilled'
    ? search.value.slice(0, 5).map(app => ({ title: app.title, appUrl: app.url,
      icon: app.icon, developer: app.developer, platform: index === 0 ? 'app-store' : 'google-play' })) : []);
  res.json({ results });
});
for (const [path, host, processUrl] of [
  ['/app-store/process-url', 'apps.apple.com', processAppStoreUrl],
  ['/google-play/process-url', 'play.google.com', processGooglePlayUrl],
]) {
  app.post(path, async (req, res) => {
    try {
      const url = new URL(req.body.url);
      if (url.protocol !== 'https:' || url.hostname !== host) {
        return res.status(400).json({ error: 'Use an HTTPS store URL.' });
      }
      const maxReviews = req.body.maxReviews === undefined ? 100 : Number(req.body.maxReviews);
      const months = req.body.months === undefined ? 3 : Number(req.body.months);
      if (!Number.isInteger(maxReviews) || maxReviews < 1 || maxReviews > 500 || !Number.isFinite(months) || months < 0 || months > 120) {
        return res.status(400).json({ error: 'Use 1-500 reviews and 0-120 months (0 includes all dates).' });
      }
      res.json(await processUrl(url.href, { maxReviews, months }));
    } catch (error) {
      res.status(400).json({ error: error.message || 'Could not sync app.' });
    }
  });
}
app.use((_req, res) => res.status(503).json({ error: 'This service requires the configured production backend.' }));
app.listen(3000, '127.0.0.1', () => console.log('Local market API: http://127.0.0.1:3000'));
