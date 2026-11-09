import { InsightlyClient, shareIdFromLink, StoreApp } from "./client.js";
import { extractAppIdent, isStoreUrl, sameApp, summarizeAppReport, truncate } from "./parse.js";

const SITE = "https://insightly.top";
const CTA_ANALYZE = `${SITE}/app`;

export async function findApp(c: InsightlyClient, query: string, platform?: "google-play" | "app-store", limit = 5) {
  const results = (await c.searchApps(query, platform)).slice(0, Math.max(1, Math.min(limit, 10)));
  return {
    query,
    results: results.map((a: StoreApp) => ({
      name: a.title,
      platform: a.platform,
      store_url: a.appUrl,
      app_id: extractAppIdent(a.appUrl)?.appId,
      icon: a.icon,
      developer: a.developer || undefined,
      rating: a.score || undefined,
    })),
    source: `${c.baseUrl}/api/search-apps`,
    next_step: "Pass a store_url to analyze_app_reviews (or 2-4 to compare_competitors).",
  };
}

async function resolveApp(c: InsightlyClient, app: string): Promise<{ url: string; resolvedFrom?: string } | null> {
  if (isStoreUrl(app)) return { url: app.trim() };
  const r = await c.searchApps(app);
  return r[0] ? { url: r[0].appUrl, resolvedFrom: `${app} → ${r[0].title} (${r[0].platform})` } : null;
}

export async function analyzeAppReviews(c: InsightlyClient, app: string) {
  const resolved = await resolveApp(c, app);
  if (!resolved) return { found: false, app, message: `No app found for "${app}". Try find_app or a store URL.` };
  const ql = await c.quickLookup(resolved.url);
  if (!ql.found || !ql.shareLink) {
    return {
      found: false,
      store_url: resolved.url,
      resolved_from: resolved.resolvedFrom,
      message: "Insightly has no cached report for this app yet. This free tool only serves existing reports; generate a fresh one at insightly.top.",
      analyze_url: CTA_ANALYZE,
    };
  }
  let summary = { sentiment: undefined as string | undefined, painPoints: ql.topComplaints ?? [], praise: [] as string[], featureRequests: ql.topRequests ?? [] };
  let generatedAt: string | undefined;
  try {
    const full = await c.sharedAppReport(shareIdFromLink(ql.shareLink));
    if (full.report) {
      const s = summarizeAppReport(full.report);
      summary = {
        sentiment: s.sentiment,
        painPoints: s.painPoints.length ? s.painPoints : summary.painPoints,
        praise: s.praise,
        featureRequests: s.featureRequests.length ? s.featureRequests : summary.featureRequests,
      };
    }
    const ts = (full.appDetails?.reviews ?? []).map((r: any) => r?.timestamp).filter(Boolean).sort();
    generatedAt = ts.length ? ts[ts.length - 1] : undefined;
  } catch { /* quick-lookup data is enough */ }
  return {
    found: true,
    app_name: ql.appTitle,
    platform: ql.platform,
    store_url: resolved.url,
    resolved_from: resolved.resolvedFrom,
    average_rating_in_sample: ql.avgRating,
    reviews_analyzed: ql.reviewsCount,
    overall_sentiment: summary.sentiment,
    top_complaints: summary.painPoints,
    top_praise: summary.praise,
    feature_requests: summary.featureRequests,
    latest_review_in_sample: generatedAt,
    report_url: ql.shareLink,
    note: "Cached Insightly report. Always show report_url to the user; the full report has quotes, metrics and recommendations.",
  };
}

export async function compareCompetitors(c: InsightlyClient, apps: string[]) {
  if (apps.length < 2 || apps.length > 4) throw new Error("Provide 2 to 4 apps.");
  const resolved = await Promise.all(apps.map((a) => resolveApp(c, a)));
  const urls = resolved.map((r, i) => r?.url ?? apps[i]);

  // 1) Exact cached comparison covering all requested apps?
  const index = await c.comparisonIndexEntries();
  const match = index
    .filter((e) => urls.every((u) => e.urls.some((eu) => sameApp(u, eu))))
    .sort((a, b) => a.urls.length - b.urls.length)[0];
  if (match) {
    const full = await c.sharedCompetitorReport(shareIdFromLink(match.shareLink));
    return {
      mode: "cached_comparison",
      apps: match.names,
      generated_at: match.timestamp,
      comparison_markdown: truncate(full.report ?? "", 6000),
      report_url: match.shareLink,
      note: "Cached Insightly comparison. Show report_url to the user.",
    };
  }

  // 2) Fallback: side-by-side from each app's cached single-app report.
  const perApp = [];
  for (let i = 0; i < urls.length; i++) {
    const r = await analyzeAppReviews(c, urls[i]);
    perApp.push({ input: apps[i], ...r });
  }
  return {
    mode: "side_by_side_from_cached_app_reports",
    apps: perApp,
    message: "No cached head-to-head comparison exists for this set. Built from individual cached reports where available. A full AI comparison (gaps, opportunities) can be generated at insightly.top.",
    compare_url: `${SITE}/competitor-insights`,
  };
}
