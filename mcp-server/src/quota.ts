// API-key / free-quota STUB. Not wired to any billing or backend.
//
// Design (see README "API keys & quota"):
//  - Anonymous callers: FREE_DAILY_CALLS per caller id (IP for HTTP, "stdio" locally).
//  - Keyed callers: INSIGHTLY_MCP_KEYS="key1:200,key2:1000" -> per-key daily limits.
//    Later: replace the env map with a lookup against an `api_keys` table / Google OAuth
//    user + credits, so paid calls can trigger fresh analyses (/api/analyze) — out of scope now.
//  - Counters are in-memory and reset at UTC midnight. Swap for Redis/Supabase when deployed
//    with >1 instance.
//  - Upstream Insightly also enforces its own 20/day/IP limit on /api/quick-lookup; a hosted
//    deployment shares one egress IP, so it will need a server-side allowance (backend change, later).

export interface QuotaDecision { allowed: boolean; remaining: number; limit: number; tier: "anonymous" | "key" | "unlimited"; reason?: string }

export class QuotaManager {
  private counts = new Map<string, number>();
  private keys: Map<string, number>;
  constructor(
    public freeDailyCalls = Number(process.env.INSIGHTLY_MCP_FREE_DAILY ?? 25),
    keySpec = process.env.INSIGHTLY_MCP_KEYS ?? "",
    public enabled = process.env.INSIGHTLY_MCP_QUOTA !== "off",
    private now: () => Date = () => new Date(),
  ) {
    this.keys = new Map(
      keySpec.split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
        const [k, n] = s.split(":");
        return [k, Number(n) || 1000] as [string, number];
      }),
    );
  }

  check(callerId: string, apiKey?: string): QuotaDecision {
    if (!this.enabled) return { allowed: true, remaining: Infinity, limit: Infinity, tier: "unlimited" };
    const day = this.now().toISOString().slice(0, 10);
    let limit = this.freeDailyCalls, tier: QuotaDecision["tier"] = "anonymous", id = `anon:${callerId}`;
    if (apiKey) {
      const l = this.keys.get(apiKey);
      if (l === undefined) return { allowed: false, remaining: 0, limit: 0, tier: "key", reason: "Unknown API key" };
      limit = l; tier = "key"; id = `key:${apiKey}`;
    }
    const bucket = `${day}:${id}`;
    const used = this.counts.get(bucket) ?? 0;
    if (used >= limit) return { allowed: false, remaining: 0, limit, tier, reason: "Daily free quota reached. Try tomorrow or get a key at https://insightly.top" };
    this.counts.set(bucket, used + 1);
    for (const k of this.counts.keys()) if (!k.startsWith(day)) this.counts.delete(k);
    return { allowed: true, remaining: limit - used - 1, limit, tier };
  }
}
