// Thin read-only client over Insightly's EXISTING public endpoints.
// No auth, no secrets, never calls endpoints that trigger LLM generation
// (/api/analyze, /api/compare-competitors, /api/chat are intentionally absent).

export type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<any>; text(): Promise<string> }>;

export interface StoreApp { title: string; appUrl: string; icon?: string; developer?: string; platform: "google-play" | "app-store"; score?: number }
export interface QuickLookup { found: boolean; appTitle?: string; platform?: string; avgRating?: number; reviewsCount?: number; topComplaints?: string[]; topRequests?: string[]; shareLink?: string }
export interface ComparisonIndexEntry { shareLink: string; urls: string[]; names: string[]; timestamp?: string }

export class InsightlyError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

export class InsightlyClient {
  private comparisonIndex?: { at: number; entries: ComparisonIndexEntry[] };
  constructor(
    public baseUrl = process.env.INSIGHTLY_BASE_URL || "https://insightly.top",
    private fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
    private timeoutMs = 25_000,
  ) {}

  private async get(path: string, params: Record<string, string | number | undefined> = {}): Promise<any> {
    const u = new URL(path, this.baseUrl);
    for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, String(v));
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(u.toString(), { signal: ctrl.signal, headers: { accept: "application/json", "user-agent": "insightly-mcp/0.1" } });
      if (!res.ok) {
        let msg = `Insightly returned HTTP ${res.status}`;
        try { const b = await res.json(); if (b?.error) msg = String(b.error); } catch { /* ignore */ }
        throw new InsightlyError(msg, res.status);
      }
      return await res.json();
    } finally { clearTimeout(t); }
  }

  /** GET /api/search-apps — live store search (store scraper, no LLM). */
  async searchApps(query: string, platform?: "google-play" | "app-store"): Promise<StoreApp[]> {
    const d = await this.get("/api/search-apps", { query, platform });
    return Array.isArray(d?.results) ? d.results : [];
  }

  /** GET /api/quick-lookup — cached report lookup only (free, 20/day per IP). */
  async quickLookup(url: string): Promise<QuickLookup> {
    return this.get("/api/quick-lookup", { url });
  }

  /** GET /api/shared-app-report — full cached markdown report. */
  async sharedAppReport(shareId: string): Promise<{ appDetails?: any; report?: string }> {
    return this.get("/api/shared-app-report", { shareId });
  }

  /** GET /api/shared-competitor-report — full cached comparison markdown. */
  async sharedCompetitorReport(shareId: string): Promise<{ report?: string }> {
    return this.get("/api/shared-competitor-report", { shareId });
  }

  /** GET /api/db-comparisons (paged, 50/page) — index of cached comparisons, memoized 1h. */
  async comparisonIndexEntries(maxPages = 10): Promise<ComparisonIndexEntry[]> {
    if (this.comparisonIndex && Date.now() - this.comparisonIndex.at < 3_600_000) return this.comparisonIndex.entries;
    const entries: ComparisonIndexEntry[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const d = await this.get("/api/db-comparisons", { page, limit: 50 });
      for (const r of d?.results ?? []) {
        let comps: any[] = [];
        try { comps = typeof r.competitors === "string" ? JSON.parse(r.competitors) : r.competitors ?? []; } catch { /* ignore */ }
        entries.push({
          shareLink: r.shareLink,
          urls: Array.isArray(r.urls) ? r.urls : comps.map((c) => c?.url).filter(Boolean),
          names: comps.map((c) => c?.name).filter(Boolean),
          timestamp: r.metadata?.timestamp,
        });
      }
      if (!d?.pagination?.hasMore) break;
    }
    this.comparisonIndex = { at: Date.now(), entries };
    return entries;
  }
}

export function shareIdFromLink(link: string): string {
  return link.replace(/\/+$/, "").split("/").pop() ?? "";
}
