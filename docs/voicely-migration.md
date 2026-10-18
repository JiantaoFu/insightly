# Voicely workspace migration

Branch: `feat/decision-lab-redesign`. No DNS, payment, auth-provider, or production deployment changes.

## Design provenance

Adapted from the user's private Sites project `appgprj_6acdd4d464e08191b7a3a85f11fc8802`, source commit `5594f0720eff21bff01a5f310d4a2573e71bbae9`.
The source was opened read-only in a sibling checkout. The Site remains unchanged.
The green sidebar, workspace hierarchy, review exploration, and decision-board interactions are ported to React; no synthetic review generator or simulated subscription/monitor is imported.

## This increment

- `/market` uses the Voicely shell and centralized `src/config/brand.ts` identity.
- Sites navigation is retained: Overview, Review explorer, Opportunities, Compare apps, Decision board, Watchlist, Plans & usage.
- The only analysis entry is app-first: search (with pagination) or resolve a store link, select the app, then automatically collect, classify and generate opportunities. Completion opens Overview without a second submit or report screen.
- The former project selector, narrative workflow, research setup, manual classification controls and source/evidence sub-pages are no longer mounted in the workspace. Existing public routes are unaffected.
- Overview, reviews and opportunities share one completed app/time snapshot. Changing the period runs analysis again; failure or cancellation keeps the prior completed scope. Intermediate collection is retained separately for retry.
- Opportunity briefs open in a drawer and save into the decision board. Previously saved decisions retain their evidence, status and notes, without exposing the old workflow.
- Compare apps automatically suggests related apps and permits manual selection. Comparison analyses are separate, use matching periods and do not replace the primary app. Theme charts do not claim market growth or statistical confidence.
- Prototype plan prices are labeled proposed and unavailable for purchase; monitoring remains explicitly manual.
- Real research, review collection, classification, citations, and legacy analysis remain available.
- Review explorer filters current-project sources, paginates locally, and exports the filtered collection, not just the visible page.
- Decisions save a report snapshot, editable experiment, user-defined success criterion, notes, and user-recorded status.
- Previously saved app opportunities are also visible in the same board, retaining their original evidence and validation stage.
- Existing `insightly_*` localStorage keys are intentionally retained. Renaming them would lose access to existing browser data.
- Existing public pages, SEO URLs, Stripe, OAuth, and production endpoints are not renamed in this increment.

## Before domain cutover

Provide validated export/import of browser projects and reviews across origins. Recheck legal/brand naming, environment origins, OAuth callbacks, share URLs, billing return URLs and per-path redirects. Decide whether existing SEO content migrates or stays on the legacy domain. Preserve the prior deployment for rollback.

Background monitoring, new subscription plans, and first-party analytics are not enabled by this UI migration. This is a local preview, not a claim that the new domain is live.

## Verification

The 76 regression tests and production build pass. The isolated browser flow covers search pagination, store URL resolution, automatic analysis, scope changes, citations, opportunity drawers, saved decisions and notes, app isolation, comparison, cancellation/retry and mobile layout. Test model responses are fixtures; no live model calls are needed for these checks.

Edited TypeScript files pass targeted ESLint. Repository-wide lint still reports 45 pre-existing errors and 13 warnings; TypeScript reports 53 errors in legacy components outside this migration. These are not represented as a clean full-repository check.
