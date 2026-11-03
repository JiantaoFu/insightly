import type { McpStore } from "./store/types.js";
import { MemoryStore } from "./store/memory.js";

export const FREE_DAILY_DEFAULT = 25;

/** Who is calling and what their daily allowance is. */
export interface Caller {
  subject: string;           // 'user:<uuid>' | 'key:<uuid>' | 'anon:<ip>' | 'stdio'
  dailyLimit: number;
  tier: "anonymous" | "user" | "key" | "local";
}
export interface QuotaDecision { allowed: boolean; remaining: number; limit: number; tier: Caller["tier"]; reason?: string }

/** Per-subject daily quota (UTC day) on top of an McpStore (Supabase in prod, memory in tests/stdio). */
export class QuotaManager {
  constructor(
    private store: McpStore = new MemoryStore(),
    public enabled = process.env.INSIGHTLY_MCP_QUOTA !== "off",
    private now: () => Date = () => new Date(),
  ) {}

  async check(c: Caller): Promise<QuotaDecision> {
    if (!this.enabled) return { allowed: true, remaining: Infinity, limit: Infinity, tier: c.tier };
    const day = this.now().toISOString().slice(0, 10);
    const r = await this.store.consumeQuota(c.subject, day, c.dailyLimit);
    if (!r.allowed) return {
      allowed: false, remaining: 0, limit: c.dailyLimit, tier: c.tier,
      reason: `Daily quota of ${c.dailyLimit} calls reached (resets 00:00 UTC). More at https://insightly.top`,
    };
    return { allowed: true, remaining: Math.max(0, c.dailyLimit - r.used), limit: c.dailyLimit, tier: c.tier };
  }
}

export function freeDailyLimit(): number {
  const n = Number(process.env.INSIGHTLY_MCP_FREE_DAILY);
  return Number.isFinite(n) && n >= 0 && process.env.INSIGHTLY_MCP_FREE_DAILY !== undefined ? n : FREE_DAILY_DEFAULT;
}
