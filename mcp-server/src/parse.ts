// Pure helpers: app identity + markdown section extraction from cached reports.

export type Platform = "android" | "ios";
export interface AppIdent { platform: Platform; appId: string }

/** Extract a stable app identity from a Google Play / App Store URL. */
export function extractAppIdent(input: string): AppIdent | null {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return null; }
  const host = u.hostname.toLowerCase();
  if (host.endsWith("play.google.com")) {
    const id = u.searchParams.get("id");
    return id ? { platform: "android", appId: id } : null;
  }
  if (host.endsWith("apps.apple.com") || host.endsWith("itunes.apple.com")) {
    const m = u.pathname.match(/\/id(\d+)/);
    return m ? { platform: "ios", appId: m[1] } : null;
  }
  return null;
}

export function isStoreUrl(input: string): boolean {
  return extractAppIdent(input) !== null;
}

export function sameApp(a: string, b: string): boolean {
  const x = extractAppIdent(a), y = extractAppIdent(b);
  return !!x && !!y && x.platform === y.platform && x.appId === y.appId;
}

/** Split a markdown report into { heading -> body } using #/## headings. */
export function splitSections(md: string): Map<string, string> {
  const out = new Map<string, string>();
  let current = "_intro";
  let buf: string[] = [];
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^#{1,3}\s+(.+?)\s*$/);
    if (h) {
      if (buf.join("").trim()) out.set(current, buf.join("\n").trim());
      current = h[1].replace(/[*_`]/g, "").trim();
      buf = [];
    } else buf.push(line);
  }
  if (buf.join("").trim()) out.set(current, buf.join("\n").trim());
  return out;
}

export function findSection(sections: Map<string, string>, patterns: RegExp[]): string | undefined {
  for (const [k, v] of sections) if (patterns.some((p) => p.test(k))) return v;
  return undefined;
}

/** Top-level list items ("1. ..." or "- ..."), markdown emphasis stripped. */
export function listItems(body: string | undefined, max = 5): string[] {
  if (!body) return [];
  const items: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^(?:\d+\.|[-*])\s+(.+)$/); // top-level only (no indent)
    if (m) items.push(m[1].replace(/\*\*/g, "").trim());
    if (items.length >= max) break;
  }
  return items;
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max).replace(/\s+\S*$/, "") + "\n\n…(truncated, see full report)";
}

export interface ReportSummary {
  sentiment?: string;
  painPoints: string[];
  praise: string[];
  featureRequests: string[];
}

export function summarizeAppReport(md: string): ReportSummary {
  const s = splitSections(md);
  const summary = findSection(s, [/summary/i, /key insights/i]) ?? "";
  const sentimentLine = summary.split(/\r?\n/).find((l) => /sentiment/i.test(l));
  return {
    sentiment: sentimentLine?.replace(/^[-*\s]+/, "").replace(/\*\*/g, "").trim(),
    painPoints: listItems(findSection(s, [/pain point/i, /complaint/i, /weakness/i])),
    praise: listItems(findSection(s, [/praise/i, /strength/i, /positive/i, /what users love/i])),
    featureRequests: listItems(findSection(s, [/feature request/i, /requested feature/i, /wish/i, /missing feature/i])),
  };
}
