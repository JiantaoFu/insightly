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
The market requests up to 500 reviews; Apple RSS pagination covers pages 1-10.
If RSS feeds return no reviews, structured review data from the official product
and all-reviews pages is merged by review ID. That result is a limited sample, labeled in the watchlist,
and must not be treated as the app's complete recent review volume.

The local API supports store scraping and health checks only. Production login,
AI research, billing and public reports continue to use `npm run dev` with the
existing backend credentials. The dashboard's built-in evidence view works
without an AI key. The separate AI research link requires the configured backend.

This preview has manual sync, browser persistence, keyword topics and an internal
weekly digest. Automatic jobs, account persistence, report delivery and new
subscription activation are not included. The homepage distinguishes the free
manual research preview from planned continuous monitoring, which cannot be
purchased. Existing one-time report checkout is unchanged.

Validation: `npm test`, `npm run build`, and targeted ESLint for the changed files.
Existing scraper integration suites remain under server/tests and require network
access; run those separately with Mocha. Full-repository lint/type checks have
existing failures in legacy components.

## Product workspace

Overview attributes findings to individual apps and provides expandable review
evidence. Filter by app and 7/30-day periods. The comparison table shows sample
ratings rather than the store's aggregate rating. Weekly brief uses a fixed
7-day comparison; Ask market answers three supported questions from the selected
apps' evidence, without making a freeform AI request.

Trend comparisons are withheld for webpage samples, incomplete syncs, unverified
sources, zero-result syncs, stale syncs (over 48 hours), or fewer than five dated
reviews in either period. Eligible comparisons show the change in topic share
within sampled reviews, in percentage points. This threshold is a conservative
product heuristic, not a statistical significance test or proof of complete coverage.
Pricing mentions are labeled neutrally. Advertising keywords use word boundaries.

Watchlist supports role reassignment and sequential Sync all. Failed apps retain
their saved reviews and do not prevent subsequent apps from syncing. Review IDs
and normalized dates deduplicate older saved data as well as incoming reviews.
The existing browser storage key is retained so this upgrade preserves watchlists.

## Research validation preview (P0)

Save a product description, current question and explicit focus topic under
Product question. Research brief respects the selected apps, period and saved
topic and exports a Markdown brief with review evidence and coverage notes.
It uses English keyword matches, not freeform AI reasoning about the question;
product context is preserved for human interpretation, not used to invent a gap.
Illustrative data remains labeled in the exported brief.

Watchlist includes a Data quality log and metadata-only JSON export. The last
20 manual attempts per app are retained, including failures after page reload.
Each successful attempt records source, actual region when returned, date range,
collection limits, first discoveries, updated reviews and missing/future dates.
First discovery is not publication date; legacy sync history is not reconstructed.
No unattended multi-day benchmark has been completed by this feature.

Google review IDs and links are retained. Review region fallbacks are reported,
and a refresh cannot silently merge returned reviews from a different region.
Latest failed attempts prevent trend comparison until a successful refresh.
The browser retains up to 2,000 saved reviews per app, independently of each
request's maximum of 500. Neither limit guarantees full store coverage.
