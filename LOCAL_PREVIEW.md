# Market Preview

Run `npm install`, then `npm run dev:local` and open
http://127.0.0.1:5173/market. No account keys are required for this entry point.
Leave `.env` absent for the sample preview, or add only the server-side Gemini
configuration below for real classification. If you have an existing
environment, disable protected routes only in your local environment and point
VITE_SERVER_URL at http://localhost:3000.

Enter a field, app name or store link, then choose **Find related apps**.
Review the recommended apps, optionally add or remove one, and choose **Start
research**. A research question and product description are optional.
Choose **Explore a sample market** to try illustrative data without model or
store requests. Sample reviews are excluded from real research automatically.
Use the refresh icon in Sources to sync individual real apps.
Reviews are deduplicated on refresh and saved in this browser. Historical reviews
are retained when available, even if outside the trend windows. Topic trends use
30-day windows; the weekly digest compares 7-day windows. Both use review dates
and ignore undated reviews.

Apple scraping uses the repo's custom scraper with its browser User-Agent fix.
The market requests up to 500 reviews; Apple RSS pagination covers pages 1-10.
If RSS feeds return no reviews, structured review data from the official product
and all-reviews pages is merged by review ID. That result is a limited sample, labeled in the watchlist,
and must not be treated as the app's complete recent review volume.

The local API supports store scraping, related-app discovery, classification and
problem synthesis. Production login, legacy AI chat, billing and public reports continue to use `npm run dev` with the
existing backend credentials. The dashboard's built-in evidence view works
without an AI key, but real reviews need Gemini classification before topic findings
are available. Saved review text remains accessible without a model key.
The separate AI research link requires the configured backend.

This preview has manual sync, browser persistence, model-discovered topics and an internal
weekly digest. Automatic jobs, account persistence, report delivery and new
subscription activation are not included. The homepage distinguishes the free
manual research preview from planned continuous monitoring, which cannot be
purchased. Existing one-time report checkout is unchanged.

Validation: `npm test`, `npm run build`, and targeted ESLint for the changed files.
Existing scraper integration suites remain under server/tests and require network
access; run those separately with Mocha. Full-repository lint/type checks have
existing failures in legacy components.

## Product workspace

The starting input now offers app-name autocomplete after a 450ms pause (at least
two characters), with icons, developer and store labels. Arrow keys and Enter pick
an app link; submitting a field without choosing an app still starts discovery.
Autocomplete only queries the stores, up to six matches per store, and uses no LLM.

**Browse more apps** opens a selectable store-results list with keyword search,
App Store / Google Play filters, and 20 results per page. It fetches a bounded pool
of up to 60 results per store (120 combined, up to six pages), cached for ten minutes.
These are available search matches, not the store's total inventory. Partial store
failures are labeled and cached briefly. Selections persist across pages and into
the saved research scope; the five-app research limit is independent of browsing.
Browsing and pagination do not invoke Gemini. The original Add app link entry stays
available for apps that store search does not surface.
Google Play candidate discovery uses the project's corrected mobile store-search
implementation. Results are resolved against app details in batches of six so
fallback package-name labels do not appear as app titles; metadata is cached.

The first screen starts with a field or app. Discovery uses Gemini to plan at most
two search queries, searches real stores, then selects up to five verified apps
by their metadata. The model can select supplied app IDs only; it cannot invent
store links. A supplied store app stays in the scope. App additions and removals
change the research scope without deleting saved source reviews. Old watchlists
initially select their first five real apps; other saved sources remain available
in Add app. Discovery successes have a 24-hour in-memory cache isolated by user,
query, region and model. Partial store failures are labeled and remain retriable.

Start research collects the selected apps, reads up to 120 eligible reviews in at
most ten classification batches, then generates a small set of user problems.
The default evidence period is 90 days; optional focus settings include 7/30 days,
a specific question and context for an existing product. Collection reuses a
successful source from the last hour when retrying. Previously classified reviews
are reused, and pending work is balanced across apps. Failure preserves completed
batches and previous reports; Stop prevents subsequent browser requests (an
already-running provider request may still complete and incur usage).

After a successful run, setup collapses and the first view shows user scenarios,
obstacles, an original quote and a next validation step. Additional evidence,
inferred impact and business unknowns are expandable. Sources opens the original
manual collection, classification, watchlist, trend, weekly and evidence tools.
Their data storage keys and scrape workflows are unchanged.

In Sources, Overview attributes findings to individual apps and provides expandable review
evidence. Filter by app and 7/30-day periods. The comparison table shows sample
ratings rather than the store's aggregate rating. Weekly brief uses a fixed
7-day comparison; Ask market answers three supported questions from the selected
apps' evidence, without making a freeform AI request.

Trend comparisons are withheld for webpage samples, incomplete syncs, unverified
sources, zero-result syncs, stale syncs (over 48 hours), or fewer than five dated
reviews in either period. Eligible comparisons show the change in topic share
within classified sampled reviews, in percentage points. Incomplete classification
or mixed model versions within the comparison windows also withhold comparisons.
This threshold is a conservative
product heuristic, not a statistical significance test or proof of complete coverage.
Aspect polarity and intent come from the model's reading of the quoted text, not
the review's star rating. They remain interpretations requiring human review.

Watchlist supports role reassignment and sequential Sync all. Failed apps retain
their saved reviews and do not prevent subsequent apps from syncing. Review IDs
and normalized dates deduplicate older saved data as well as incoming reviews.
The existing browser storage key is retained so this upgrade preserves watchlists.

## Research validation preview (P0)

The optional Research focus stores a product description and question. The older
Research brief in Sources respects its selected apps, period and saved topic,
and exports a Markdown brief with review evidence and coverage notes.
It uses model-classified evidence, not freeform AI reasoning about the question;
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

## Gemini theme classification

Put `GEMINI_API_KEY` in the repo's local `.env` file. This file is ignored by Git;
never put a key in a `VITE_*` variable or the browser. Restart the local API after
configuration changes, then refresh model configuration on the market page.
`MARKET_GEMINI_MODEL` optionally overrides the existing Gemini provider's model;
leave it blank to reuse `GEMINI_MODEL` / the provider default. A configured key
does not prove that your account has access to that model.

Click **Classify reviews** after syncing real apps. Each run processes at most
120 pending reviews, sequentially in batches of up to 12 and 60,000 characters.
Individual reviews are limited to 16,000 characters. Empty and oversized reviews
remain saved but are excluded from model batches, never silently truncated.
Only app names and review text are sent, along with the current theme
vocabulary; usernames, ratings and dates are not sent. Classification invokes
Gemini and can incur provider charges. Syncing alone never invokes Gemini.

There is no preset category taxonomy and no keyword fallback. Gemini discovers
workflow-specific themes, reuses known theme IDs, and assigns up to four aspects
per review: theme, issue, polarity, intent and a verbatim quote. Distinct aspects
can share a theme, such as a complaint and a feature request. Each review counts
once per theme and once per intent within that theme, regardless of aspect count.
Identical duplicate aspects are rejected. Vague reviews
may have no aspects. Output without valid review assignments or quotes is
rejected. The backend does not ask the model to compute trends or market gaps.
Dates, mention counts and sample shares are calculated in code.

Completed batches are saved immediately in the existing browser watchlist.
Retries process only remaining reviews. Changed review text invalidates its old
classification; a selected model change makes old results pending for reanalysis.
The backend also caches successful batches in memory for 24 hours, scoped to
user, market, model, text and supplied theme vocabulary. Restarting clears this
backend cache. Theme IDs are based on canonical names; synonym consolidation is
model-assisted, not a guarantee against theme drift. The vocabulary is limited
to 100 themes per market. Cloud storage and automatic classification are not
included. Sample annotations are explicitly illustrative and never use the key.

Production routes require the existing authenticated account and explicit
`MARKET_CLASSIFICATION_ENABLED=true` pilot opt-in, in addition to server-side
Gemini configuration. This does not activate new subscription entitlements or
deduct existing report credits. Keep it disabled until pilot usage/cost limits
are agreed. See the [Gemini generation API](https://ai.google.dev/api/generate-content)
for structured response support.

## Opportunity hypotheses and validation shortlist

The final research step makes one explicit Gemini request for up to five hypotheses,
using at most 24 classified, current-window original quote excerpts. Excerpts are
selected across apps in round-robin order, prioritizing complaints and requests;
identical excerpts within an app/theme are deduplicated. This is a bounded,
non-representative selection, not a complete market summary. Real and illustrative
source data are never mixed in a real request. No names, full review bodies or
model-generated statistics are sent. New research uses the existing server-side
Gemini model and production pilot flag, with a separate 30-request/15-minute cap.
This is a request limit, not a monetary budget guarantee.

The model proposes possible scenarios, obstacles, consequences to verify,
reasons to investigate, business unknowns and a concrete interview/prototype
experiment. All scenarios and business value remain hypotheses. Each hypothesis
must cite supplied evidence identifiers; original quotes and cited review counts
are resolved in code. No opportunity score, willingness-to-pay claim or automatic
development priority is established. The model may return fewer than three
opportunities or none. Structural validation cannot prove semantic accuracy;
review the cited text before acting.

Results are persisted locally and retained on failure. Changing the saved
question, task, selected evidence, period or model marks the old report as stale;
regeneration requires an explicit click. Optional context saves as it is edited;
changing the starting point requires finding related apps before another run.
Identical requests have a 24-hour user/market/model/content cache
in backend memory; a restart clears it. Provider-reported input, output, thinking
and total token usage for the final synthesis, when available, appears under Research scope & usage.
Discovery and classification usage are additional, not included in that figure.
These are the original generation counts, not additional charges for a cached
repeat, and are not a price estimate.

Save direction stores a snapshot, up to 50 items in this browser. Validation
status can be To validate, Interview planned, Prototype planned or Set aside;
none implies a completed experiment. Export produces a Markdown brief with
original evidence and unknowns. An explicit Update saved replaces an older
snapshot for the same hypothesis while preserving its status. This shortlist is
not unattended monitoring or a history of completed experiments. Illustrative
sample opportunities never call Gemini and stay labeled in the UI and exports.

## Independent Research Directions

- The research selector and New research action keep app selections, questions, review periods, reports, saved directions and app roles separate.
- Committing a different starting query preserves the previous research as a separate direction. Editing app selections within a direction retains its report with the existing stale-evidence warning.
- Sources, classification totals, classification batches and Sync all use only the active direction. Removing an app detaches it from that direction; collected reviews remain reusable through Saved sources in the app picker.
- Existing current scope/report migrate into the first direction. Unmatched saved snapshots remain under Previous saved directions. Other collected apps remain in shared storage; no automatic category assignment is attempted. Legacy storage keys remain untouched for rollback.
- Research remains browser-local. This does not add cloud persistence or scheduled monitoring. Multiple simultaneous editing tabs are not coordinated.
- Verification: 55 unit tests pass; production build passes; isolated desktop/mobile acceptance covers two research runs, scoped classification/sync, switching, saved-stage restoration and source removal without deleting reviews. Whole-repository lint/typecheck still have pre-existing errors outside these changes.
