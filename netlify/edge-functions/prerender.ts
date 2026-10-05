import type { Config, Context } from "@netlify/edge-functions";
import {
  SITE,
  PAGE_CSS,
  applyBody,
  applyHead,
  applyHeroCopy,
  extractSummary,
  firstHeading,
  hasMainMarkers,
  renderAppReportMain,
  renderCompetitorReportMain,
  renderInsightsMain,
  renderSignInMain,
} from "../edge-lib/prerender-core.js";

// Per-request "prerender" for SEO-critical routes.
//
// The site is a Vite SPA: every route used to get the same index.html (home
// title, home description, no body), so to Google every report page looked
// identical. This edge function takes the built index.html (context.next())
// and, per route, rewrites <title>/description/canonical/OG/Twitter and swaps
// the skeleton <main> for real, crawlable content. React then replaces #root
// as usual; report data is embedded as JSON so the SPA renders the same
// content immediately instead of flashing a spinner and fetching it again.
//
// Replaces the old social-cards.ts, which did head-only rewrites for social
// crawler user-agents. This runs for everyone (no UA sniffing / cloaking).
//
// Failure mode: on any backend error/timeout we return the plain SPA shell
// (what the site served before this change) and mark it uncacheable.

const BACKEND = Netlify.env.get("PRERENDER_BACKEND") || "https://insightly-5iyw.onrender.com"; // keep in sync with netlify.toml redirects
const BACKEND_TIMEOUT_MS = 10000;

// CDN cache for successful renders (`cache: "manual"` below). Netlify purges
// these on every deploy, so a new index.html / asset hashes always win.
// stale-while-revalidate keeps pages instant even if Render is cold, and only
// one request per URL per window goes to the backend.
const CACHE_REPORT = "public, durable, s-maxage=86400, stale-while-revalidate=604800";
const CACHE_LIST = "public, durable, s-maxage=3600, stale-while-revalidate=86400";
const CACHE_STATIC = "public, durable, s-maxage=86400, stale-while-revalidate=604800";

const HOME = {
  title: "Find Your Next Product Idea in Competitors' 1-Star Reviews | Insightly",
  description:
    "Paste any App Store or Google Play link. Get an AI report of what users hate, what they wish existed, and the feature gaps you can build into a business.",
};

// Copy mirrors COPY.teams in src/pages/Home.tsx.
const TEAMS = {
  title: "Insightly for Teams: Competitive Intelligence from App Reviews",
  description:
    "Give your product and ASO team sentiment trends, feature-gap analysis, and SWOT comparisons built from real competitor app reviews.",
  heading: "Turn Competitor App Reviews Into Your Team’s Competitive Intelligence",
  subtitle:
    "Track what users love and hate about competing apps — sentiment trends, feature-request themes, and SWOT comparisons your product and ASO team can act on every sprint.",
  cta: { label: "Book a Demo", href: "https://calendly.com/jeromyfu-/insightly-top-demo", external: true },
};

// Copy mirrors src/pages/AppInsightsPage.tsx.
const INSIGHTS = {
  title: "Comprehensive App Analysis Archive | Insightly",
  heading: "Comprehensive App Analysis Archive",
  description:
    "Explore our comprehensive database of app analyses. We provide in-depth insights into app performance, user reviews, and developer reputation.",
  pageSize: 15, // must match <DBAnalysesList pageSize={15}> so the SPA can reuse it
};

// /app is the paid "Analyze my app ($1)" entry point.
const ANALYZE = {
  title: "Analyze My App's Reviews ($1) | Insightly",
  description:
    "Paste any App Store or Google Play link and get an AI report of user pain points, requested features, and startup opportunities in minutes.",
};

async function backendJson(path: string): Promise<{ status: number; body: any } | null> {
  try {
    const res = await fetch(`${BACKEND}${path}`, { signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS) });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch {
    return null; // network error / timeout
  }
}

function respond(html: string, origin: Response, cdnCache: string | null, status = 200): Response {
  const headers = new Headers(origin.headers);
  headers.delete("content-length");
  headers.delete("etag");
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "public, max-age=0, must-revalidate");
  headers.set("netlify-cdn-cache-control", cdnCache || "no-store");
  headers.set("x-insightly-prerender", cdnCache ? "rendered" : "fallback");
  return new Response(html, { status, headers });
}

function passthrough(origin: Response, html: string): Response {
  return respond(html, origin, null, origin.status);
}

async function renderAppReport(shareId: string, origin: Response, html: string) {
  const api = await backendJson(`/api/shared-app-report?shareId=${encodeURIComponent(shareId)}`);
  if (!api || api.status !== 200 || !api.body?.appDetails || api.body.error) {
    return passthrough(origin, html);
  }
  const { appDetails, report } = api.body;
  const appName = appDetails.title || "App";
  // Same title/description rule as ShareReportView.tsx (updateMetadata).
  const title = `${appName} Review Analysis Report | Insightly`;
  const description =
    extractSummary(String(report || "")) ||
    `AI-powered review analysis for ${appName}: user sentiment, key pain points and feature requests mined from app store reviews.`;
  html = applyHead(html, {
    title,
    description,
    // /share/:id is the pre-Feb-2025 path for the same report: keep serving
    // it (it is in Google's index), canonicalised to /shared-app-report/:id.
    canonical: `${SITE}/shared-app-report/${shareId}`,
    ogType: "article",
    image: appDetails.icon || undefined,
    imageAlt: `${appName} icon`,
    twitterCard: appDetails.icon ? "summary" : undefined,
    jsonLd: null,
  });
  html = applyBody(html, {
    main: renderAppReportMain({ appDetails, report }),
    css: PAGE_CSS,
    // Only the review fields ShareReportView/ReviewPreview/CSV export use.
    data: {
      kind: "app-report",
      shareId,
      report,
      appDetails: {
        ...appDetails,
        reviews: Array.isArray(appDetails.reviews)
          ? appDetails.reviews.map((r: any) => ({
            id: r?.id, score: r?.score, userName: r?.userName, text: r?.text, timestamp: r?.timestamp,
          }))
          : appDetails.reviews,
      },
    },
  });
  return respond(html, origin, CACHE_REPORT, 200);
}

async function renderCompetitorReport(shareId: string, origin: Response, html: string) {
  const api = await backendJson(`/api/shared-competitor-report?shareId=${encodeURIComponent(shareId)}`);
  if (!api || api.status !== 200 || !api.body?.report || api.body.error) {
    return passthrough(origin, html);
  }
  const report = String(api.body.report);
  const heading = firstHeading(report) || "Competitor Analysis Report";
  const title = `${heading} | Insightly Competitor Analysis`;
  const description =
    extractSummary(report) || "Competitor analysis: market positioning and competitive insights from app store reviews.";
  html = applyHead(html, {
    title,
    description,
    canonical: `${SITE}/shared-competitor-report/${shareId}`,
    ogType: "article",
    jsonLd: null,
  });
  html = applyBody(html, {
    main: renderCompetitorReportMain({ report, heading }),
    css: PAGE_CSS,
    data: { kind: "competitor-report", shareId, report },
  });
  // Competitor reports live only in the backend's in-memory cache and vanish
  // on a backend restart: cache for an hour, not a day.
  return respond(html, origin, CACHE_LIST, 200);
}

async function renderInsights(origin: Response, html: string) {
  html = applyHead(html, {
    title: INSIGHTS.title,
    description: INSIGHTS.description,
    canonical: `${SITE}/app-insights`,
    jsonLd: null,
  });
  const api = await backendJson(
    `/api/db-analyses?page=1&limit=${INSIGHTS.pageSize}&sortBy=timestamp&sortOrder=desc`,
  );
  if (!api || api.status !== 200 || !Array.isArray(api.body?.results)) {
    // Head is still right; body falls back to the nav-only shell.
    return respond(html, origin, null, 200);
  }
  const results = api.body.results.filter((r: any) => r?.appDetails && r?.metadata?.hashUrl);
  const items = results.map((r: any) => ({
    hashUrl: r.metadata.hashUrl,
    title: r.appDetails.title || "App",
    developer: r.appDetails.developer || "",
    platform: r.appDetails.platform || "",
    icon: r.appDetails.icon || "",
    avgRating: r.reviewsSummary?.averageRating,
  }));
  // Slim copy for the SPA (the raw API payload carries every review: ~1.5 MB).
  const slim = results.map((r: any) => ({
    shareLink: `${SITE}/shared-app-report/${r.metadata.hashUrl}`,
    appDetails: {
      title: r.appDetails.title,
      description: String(r.appDetails.description || "").slice(0, 400),
      developer: r.appDetails.developer,
      icon: r.appDetails.icon,
      url: r.appDetails.url,
      platform: r.appDetails.platform,
    },
    reviewsSummary: r.reviewsSummary,
    analysisDate: r.analysisDate,
    metadata: r.metadata,
  }));
  html = applyBody(html, {
    main: renderInsightsMain({
      title: INSIGHTS.heading,
      intro: INSIGHTS.description,
      items,
      total: api.body.pagination?.total,
    }),
    css: PAGE_CSS,
    data: { kind: "db-analyses", pageSize: INSIGHTS.pageSize, results: slim, pagination: api.body.pagination },
  });
  return respond(html, origin, CACHE_LIST, 200);
}

export default async (request: Request, context: Context) => {
  if (request.method !== "GET" && request.method !== "HEAD") return;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  const origin = await context.next();
  const type = origin.headers.get("content-type") || "";
  if (!type.includes("text/html")) return origin;
  let html = await origin.text();
  if (!hasMainMarkers(html)) return passthrough(origin, html); // unexpected shell: leave it alone

  try {
    if (path === "/") {
      // Query strings (?ref=producthunt) canonicalise to the bare home URL.
      html = applyHead(html, { ...HOME, canonical: `${SITE}/` });
      return respond(html, origin, CACHE_STATIC);
    }
    if (path === "/for-teams") {
      html = applyHead(html, { title: TEAMS.title, description: TEAMS.description, canonical: `${SITE}/for-teams` });
      html = applyHeroCopy(html, TEAMS);
      return respond(html, origin, CACHE_STATIC);
    }
    if (path === "/app") {
      html = applyHead(html, { ...ANALYZE, canonical: `${SITE}/app`, jsonLd: null });
      // Logged-out view (what crawlers get); logged-in users see the analyzer once React loads.
      html = applyBody(html, { main: renderSignInMain({ heading: "Analyze my app ($1)" }), css: PAGE_CSS });
      return respond(html, origin, CACHE_STATIC);
    }
    if (path === "/app-insights") {
      return await renderInsights(origin, html);
    }

    const [section, id, ...rest] = path.split("/").filter(Boolean);
    if (!id || rest.length || !/^[A-Za-z0-9_-]{6,128}$/.test(id)) return passthrough(origin, html);
    if (section === "shared-app-report" || section === "share") return await renderAppReport(id, origin, html);
    if (section === "shared-competitor-report") return await renderCompetitorReport(id, origin, html);
  } catch (err) {
    console.error("prerender failed", path, err);
  }
  return passthrough(origin, html);
};

export const config: Config = {
  path: ["/", "/for-teams", "/app", "/app-insights", "/shared-app-report/*", "/shared-competitor-report/*", "/share/*"],
  cache: "manual",
};
