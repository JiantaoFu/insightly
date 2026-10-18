# Sites / Voicely Flow Parity Audit

Date: 2026-10-18. Source-level audit, not a new end-to-end browser certification.

Baseline: Sites commit `5594f0720eff21bff01a5f310d4a2573e71bbae9`, read-only sibling `sites-reference/dist/app.js` and `core.js`. Current implementation: `feat/decision-lab-redesign`, commit `31c83df`.

## Product Contract

### Follow-up: Decision Loop and Monitoring Preview Implemented

- New opportunity generation asks for proposed success criteria, scope boundaries and falsification findings in the existing model call. Optional bounded fields keep older stored reports readable; generated criteria are proposals, not validated outcomes. Existing reports are not silently regenerated.
- New-flow decisions now support editable experiment, success, scope boundary, falsification and notes, plus a user-assessed validated stage. Fields survive reload, explicit snapshot updates and export. A saved brief opens its original evidence, not a later app analysis.
- Board now offers all-app export and an empty-state action, without repeated per-group export toolbars. App headings remain for provenance.
- Opportunity drawers expose all classified reviews in the cited themes within the same app/period. This broader set is labeled related-theme evidence, not proof of every opportunity claim. Interview questions no longer masquerade as falsification criteria.
- Review explorer has independent theme/rating filters and persistent reset access. Filters, pagination and export share the same result set.
- Signal table adds coverage-gated 14-day sample-share changes. Comparison adds low-star share, collection context and an explicit research question; it does not claim a proven competitive gap.
- Watchlist has confirm/cancel setup, persisted global sample-share thresholds, local weekly signal previews and Markdown brief exports. Sparse, incomplete, stale or otherwise non-comparable samples withhold change judgments. Threshold units are percentage points, deliberately not the prototype's raw mention-growth percentage.
- Workspace adds hash navigation/history, Ctrl/Cmd+K search and actual local usage counts. No simulated paid activation, Stripe changes or email delivery were added.
- Verified: 82 unit tests pass; production build passes; changed-file lint passes. Browser regression passes seven destinations at 390/768/1355px, confirmation/Back/cancel, scoped evidence filters, saved-field reload, original-brief revisit, global export, monitor setup/cancel/persistence/export, history, keyboard search, empty workspace and prior analysis retry/cancel behavior. Screenshots inspected.
- Repository-wide lint still reports the existing 45 errors / 13 warnings. App TypeScript check reports errors in legacy modules, not changed files. Root `tsc --noEmit` alone does not check referenced app files; the app config was checked explicitly.
- Local backend restarted after observing the user's local page was idle. Health reports configured Gemini and batch size 24. Verification used model fixtures, not a new paid live-model run.

### Remaining Gaps (Not Claimed Complete)

- Cross-store product identity and Both-platform analysis.
- Effort-based opportunity prioritization/filtering with defensible estimates, plus smaller metadata/visual differences and save/unsave parity.
- Full plan feature matrix and any genuine billing entitlement flow.
- Cloud persistence, scheduled collection, alert delivery and real email.
- Stronger multi-app evidence synthesis: current comparison takeaway is a bounded research question, not a model-validated recommendation or proof of differentiation.

The inventory below records the original audit baseline; follow-ups above describe subsequent changes.

### Follow-up: Scope Confirmation Implemented

- Search results, resolved store links and suggested comparison apps now open a separate confirmation dialog before collection or model work.
- Confirmation displays the actual store and region; users choose 30/90 days and explicitly generate. Back retains search and selected period; closing does not start work.
- Cross-store linking remains outstanding. This change does not claim completion of the other inventory items below.
- Verification: 79 tests passed; production build and edited-component lint passed. Updated isolated-browser flow passed desktop/mobile, including confirmation, Back, cancellation, URL selection, comparison, cached results and existing retry/save/export behavior. Mobile scope screenshot inspected. Browser tests use fixtures, not paid model requests.

Choose an app -> confirm analysis scope -> read feedback -> understand opportunities -> inspect evidence -> save a decision -> run a small test -> revisit results and changing feedback.

Sites is the interaction reference, not evidence that its synthetic insights, paid tiers, or monitoring are production services. Real collection, grounded quotations, honest coverage, cancellation, and data preservation must remain.

## Side-by-Side Inventory

| Area | Sites reference | Current implementation | Assessment |
| --- | --- | --- | --- |
| Navigation | Overview, Reviews, Opportunities, Compare, Board, Watchlist, Plans | Same main destinations | Present; destinations alone do not establish parity |
| App selection | Search/link, sample library, Continue | Real search, autocomplete, pagination, recent apps, URL resolution | Real capability added; interaction differs |
| Scope confirmation | Separate drawer with Back and Generate; both/iOS/Android; 30/90 days | Region and period inside search drawer; selecting a result starts work immediately | Missing confirmation step |
| Product/store identity | One demo product can contain both platforms | Each selected store app is its own analysis | Cross-platform scope absent; cannot implement honestly with a cosmetic selector |
| Processing | Three-stage progress drawer, simulated timer | Real pipeline, inline progress, batch counts, elapsed time, Stop | Different presentation; real cancellation retained |
| Completion | Opens Overview | Opens Overview for primary app; comparison does not replace primary | Present |
| Overview metrics | Review count, rating, pain mentions, three demo opportunities | Real sample count, rating, complaint-review count, actual opportunity count | Different counting semantics; do not force three suggestions |
| Priority opportunity | Impact/effort/confidence, mentions, change, save toggle | Grounding label, cited evidence count, Explore, save disabled once saved | Assessment metadata and toggle differ; citation count is not all theme mentions |
| Trends | Weekly line/area chart and theme switching | Six weekly bars and theme switching | Visualization differs; classified-sample denominator must stay explicit |
| Signal table | Pain/request/love tabs with counts; share and recent change | Complaint/request/praise; count/share and evidence link | Tab totals and recent-change column missing |
| Review filters | Text, theme, rating, reset | Text, feedback intent; theme inherited from Overview | Independent theme and rating controls missing; reset not consistently available |
| Review detail | Platform, country, version, date, stars | Platform, country, date, numeric rating, themes, provenance | Version absent; rating presentation differs |
| Review pagination/export | Load more, demo plan gates, CSV export | Previous/next pages; filtered CSV export without plan gates | Functional pagination/export present; commercial gating intentionally inactive |
| Opportunity filters | All, quick wins, medium, big bets | All, review-backed, exploratory | Different product logic; current generated opportunities require evidence, limiting usefulness of exploratory filter |
| Opportunity brief | Summary, quotations, metrics, next move, experiment, success, scope limits | Proposal, who/when, obstacle, quotations, experiment, uncertainty | Success criterion, scope limit and aggregate metrics missing |
| Falsification | Separate experiment/success/scope content | Interview question rendered under 'What would change this direction' | Semantic mismatch; a question is not a falsification criterion |
| Evidence drill-down | Explore all matching mentions from opportunity drawer | Quotes in drawer; table can open theme-filtered reviews | Drawer-to-all-evidence link missing |
| Opportunity save/export | Save/unsave and export brief | Save and export brief; removal from board | Present with different save interaction |
| Comparison selection | Primary and comparison product selectors | Separate real comparison analysis; optional discovered suggestions | Present; automatic related-app discovery is an addition |
| Comparison result | Sample counts, low-star share, problem/request shares, differentiation hypothesis and action | Sample/classification counts and theme shares | Low-star share and actionable differentiation takeaway missing |
| Comparison scope | Common demo filters | Same period required, but snapshots can differ in date, region and coverage | Need explicit comparability indicators; equal period alone is insufficient |
| Decision board | Unified saved list; investigate/testing/validated/parked; notes; success shown | Grouped per app; new app flow uses SavedOpportunity with interview/prototype/archive stages | New flow lacks success field and validation-complete stage |
| Board editing | Notes/status | Notes/status for new flow; richer experiment/success editing only in older DecisionPlan branch | Existing older component fields do not prove new-flow parity |
| Board evidence | Reopen original opportunity | Expand saved quotations | Original-brief revisit missing |
| Board export/empty state | Global export; Find an opportunity CTA | Per-group export; empty text | Global export and empty-state action missing |
| Monitor setup | Threshold drawer, confirm/cancel, settings | Immediate addition to manual watchlist | Setup and threshold preferences missing |
| Watchlist value | Simulated latest theme signal, growth, threshold state | Last analysis time, open, refresh, remove | Signal/threshold preview missing |
| Weekly monitoring | Demo weekly-brief promise/signal preview; no actual delivery | No equivalent brief preview in new watchlist | Preview missing; neither side has real scheduled delivery |
| Plans | Demo current tier, usage, feature comparison, monthly/annual, demo activation | Proposed monthly/annual prices; not available for purchase | Usage/comparison/demo activation absent; do not create real charges |
| Navigation continuity | Hash routes, back/forward, Ctrl/Cmd+K | Local view state; refresh returns to Overview | Deep links, history and shortcut missing |
| Persistence | Browser-stored synthetic state | Browser-stored real snapshots, decisions and monitors; older data retained | Present; neither is cloud persistence |
| Real service failures | Primarily simulated flow | Retry/cancel, keep prior completed result, storage warnings | Production-oriented addition to preserve |

## Implementation Order / Acceptance Gates

### P0: Complete the decision loop

1. Restore explicit scope confirmation. Selecting an app must not start paid model work; Back preserves selection and scope; Generate starts once. Show supported source honestly until cross-store identity exists.
2. Complete the opportunity contract: user/scenario, problem, proposal, supporting and limiting evidence, smallest test, success criterion, scope boundary, and what would invalidate the idea. Unknown fields remain unknown, not fabricated.
3. Link each opportunity to its complete relevant evidence set, within the same app, region, period and snapshot. Do not equate the few cited excerpts with total mentions.
4. Use one decision model for the new flow with editable experiment/success/notes, user-assessed validation status, original evidence revisit, global export and an actionable empty state. Preserve saved records through migration.

### P1: Make evidence inspection and comparison complete

5. Add independent theme/rating filters and always-available reset; pagination and export must use exactly the same filtered set.
6. Restore recent-change indicators only where sample coverage permits comparison. Display sample sizes and denominators; sparse data must not imply market-wide growth.
7. Add low-rating share and evidence-backed comparison takeaways with explicit region/date/coverage differences. A differentiation idea is a hypothesis, not validated demand.
8. Decide explicit cross-store product linking before enabling Both platforms. Restore keyboard search, deep links and browser navigation without losing analysis context.
9. Align opportunity prioritization/filtering with actionable effort assessments, clearly labeled as estimates. Never copy synthetic confidence percentages into real analysis.

### P2: Complete monitoring and commercial presentation

10. Add monitor setup/settings and a useful local signal/brief preview. Label manual refresh and unscheduled state honestly; do not imply background jobs or sent mail.
11. Show genuine usage and feature comparison. Any demo tier activation must be visibly simulated. Real billing, delivery and deployment remain separate approval items.
12. Align progress presentation, save toggle, metadata and remaining visual differences after the functional gates above.

## Verification Required Before Claiming Parity

- Replay the complete choose/scope/analyze/evidence/save/test/revisit path on desktop and mobile.
- Cover cancel, retry, empty reviews, partial classification, sparse trends and unavailable model configuration.
- Verify primary/comparison isolation, scope changes, refresh, history and stored-data migration.
- Test opportunity -> all evidence -> back, board -> original brief, status/notes persistence and full-board export.
- Check monitor setup/cancel/settings and no implied background delivery.
- Run focused tests and build; report existing repository lint/type debt separately.

## Implementation Evidence

- `src/pages/MarketDashboard.tsx`: orchestration, app isolation, monitor list, board grouping.
- `src/components/AnalyzeAppDialog.tsx`: selection, region/period and immediate start.
- `src/components/LabWorkspace.tsx`: overview, opportunities, comparison, briefs and pricing.
- `src/components/ReviewExplorer.tsx`: filters, paging and export.
- `src/components/DecisionBoard.tsx`: two record types with different fields/statuses.
- `src/components/VoicelyShell.tsx`: navigation and global search trigger.
- `src/utils/appAnalysis.ts`: real collection/classification/report pipeline.

This audit does not claim a new speed benchmark or fresh full-browser pass. Previously passing flow tests cover the implemented flow, not the missing Sites behaviors listed here.
