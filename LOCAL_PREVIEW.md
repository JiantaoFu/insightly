# Market Preview

Run `npm install`, then `npm run dev:local` and open
http://127.0.0.1:5173/market. No account keys are required for this entry point.
Leave `.env` absent for this account-free preview. If you have an existing
environment, disable protected routes only in your local environment and point
VITE_SERVER_URL at http://localhost:3000.

Choose **Explore a sample market** to try the dashboard without store requests.
Sample reviews are labeled and do not represent real apps. Remove the sample
apps before adding your own store URLs. Use the refresh icon to sync real apps.
Reviews are deduplicated on refresh and saved in this browser. Historical reviews
are retained when available, even if outside the trend windows. Topic trends use
30-day windows; the weekly digest compares 7-day windows. Both use review dates
and ignore undated reviews.

Apple scraping uses the repo's custom scraper with its browser User-Agent fix.
If RSS feeds return no reviews, the official store page's structured review data
is used as a fallback. That result is a limited sample, labeled in the watchlist,
and must not be treated as the app's complete recent review volume.

The local API supports store scraping and health checks only. Production login,
AI research, billing and public reports continue to use `npm run dev` with the
existing backend credentials. The dashboard's built-in evidence view works
without an AI key. The separate AI research link requires the configured backend.

This preview has manual sync, browser persistence, keyword topics and an internal
weekly digest. Automatic jobs, account persistence, report delivery and new
subscription activation are not included. New plan prices are proposals and
their preview buttons do not initiate payment.

Validation: `npm test`, `npm run build`, and targeted ESLint for the changed files.
Existing scraper integration suites remain under server/tests and require network
access; run those separately with Mocha. Full-repository lint/type checks have
existing failures in legacy components.
