// Opt-in smoke test against production: INSIGHTLY_LIVE=1 npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { InsightlyClient } from "../src/client.js";
import { analyzeAppReviews, compareCompetitors, findApp } from "../src/tools.js";

const live = process.env.INSIGHTLY_LIVE === "1";
const c = new InsightlyClient();

test("live: find_app", { skip: !live }, async () => {
  const r = await findApp(c, "duolingo");
  assert.ok(r.results.length > 0);
});
test("live: analyze_app_reviews (cached Tinder report)", { skip: !live }, async () => {
  const r: any = await analyzeAppReviews(c, "https://play.google.com/store/apps/details?id=com.tinder");
  assert.equal(r.found, true);
  assert.match(r.report_url, /shared-app-report/);
});
test("live: compare_competitors (cached Google Photos vs Amazon Photos)", { skip: !live }, async () => {
  const r: any = await compareCompetitors(c, [
    "https://apps.apple.com/us/app/google-photos-backup-edit/id962194608",
    "https://play.google.com/store/apps/details?id=com.amazon.clouddrive.photos",
  ]);
  assert.equal(r.mode, "cached_comparison");
});
