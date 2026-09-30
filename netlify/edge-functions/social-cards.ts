import type { Context } from "@netlify/edge-functions";

// Injects per-report OG/Twitter meta tags when a *social crawler* (which
// doesn't run JS) fetches /shared-app-report/* or /shared-competitor-report/*.
// Regular browsers and Googlebot (which renders JS) pass through untouched.
//
// Why an edge function: the frontend is a Vite SPA — index.html carries only
// generic OG tags, and the per-report title/description used to be set via
// JS (updateMetadata), invisible to WhatsApp/X/Facebook/LinkedIn crawlers.

const BACKEND = "https://insightly-5iyw.onrender.com"; // keep in sync with netlify.toml redirects

const CRAWLER_UA =
  /twitterbot|facebookexternalhit|facebookcatalog|linkedinbot|slackbot|whatsapp|telegrambot|discordbot|pinterestbot|vkshare|facebot/i;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Mirror of the frontend's getSummary() in ShareReportView.tsx: strip
// markdown headers/formatting, keep the first ~155 chars of sentences.
function extractSummary(markdown: string): string {
  const clean = markdown
    .replace(/#{1,6}\s?[^\n]+\n*/g, "")
    .replace(/\*\*/g, "")
    .replace(/Summary of Key Insights\s*\n+/g, "")
    .trim();
  const sentences = clean.split(/[.!?]+/);
  let summary = "";
  for (const s of sentences) {
    const t = s.trim();
    if (t && (summary + t).length < 155) {
      summary += (summary ? " " : "") + t + ".";
    } else {
      break;
    }
  }
  return summary.trim();
}

function replaceMeta(
  html: string,
  attr: string,
  name: string,
  content: string,
): string {
  const re = new RegExp(
    `<meta\\s+${attr}="${name}"\\s+content="[^"]*">`,
    "i",
  );
  const tag = `<meta ${attr}="${name}" content="${esc(content)}">`;
  return re.test(html) ? html.replace(re, tag) : html.replace("</head>", `${tag}\n</head>`);
}

export default async (request: Request, context: Context) => {
  const ua = request.headers.get("user-agent") || "";
  if (!CRAWLER_UA.test(ua)) {
    return context.next();
  }

  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  // /shared-app-report/<hash> or /shared-competitor-report/<hash>
  const kind = parts[0] === "shared-competitor-report" ? "competitor" : "app";
  const shareId = parts[1];
  if (!shareId) {
    return context.next();
  }

  try {
    const apiUrl =
      kind === "app"
        ? `${BACKEND}/api/shared-app-report?shareId=${encodeURIComponent(shareId)}`
        : `${BACKEND}/api/shared-competitor-report?shareId=${encodeURIComponent(shareId)}`;
    const apiRes = await fetch(apiUrl, {
      signal: AbortSignal.timeout(8000),
    });
    if (!apiRes.ok) {
      return context.next();
    }
    const data = await apiRes.json();
    if (data.error || !data.appDetails) {
      return context.next();
    }

    const appName: string = data.appDetails.title || "App";
    const title =
      kind === "app"
        ? `${appName} Review Analysis Report | Insightly`
        : `${appName} Competitor Analysis Report | Insightly`;
    const description =
      (data.report ? extractSummary(String(data.report)) : "") ||
      (kind === "app"
        ? `AI-powered review analysis for ${appName}: user sentiment, key pain points and feature requests mined from app store reviews.`
        : `Competitor analysis for ${appName}: market positioning and competitive insights from app store reviews.`);

    const originRes = await context.next();
    let html = await originRes.text();

    html = html.replace(/<title>.*?<\/title>/is, `<title>${esc(title)}</title>`);
    html = replaceMeta(html, "name", "description", description);
    html = replaceMeta(html, "property", "og:type", "article");
    html = replaceMeta(html, "property", "og:url", url.href);
    html = replaceMeta(html, "property", "og:title", title);
    html = replaceMeta(html, "property", "og:description", description);
    html = replaceMeta(html, "name", "twitter:url", url.href);
    html = replaceMeta(html, "name", "twitter:title", title);
    html = replaceMeta(html, "name", "twitter:description", description);
    if (!/rel="canonical"/i.test(html)) {
      html = html.replace(
        "</head>",
        `<link rel="canonical" href="${esc(url.href)}">\n</head>`,
      );
    }

    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch {
    // On any failure (backend cold, timeout, parse error) serve the SPA as-is.
    return context.next();
  }
};
