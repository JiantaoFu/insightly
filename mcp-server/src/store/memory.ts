import { randomUUID } from "node:crypto";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { ApiKeyRecord, AuthCode, McpStore, PendingAuth, RefreshRecord, UpstreamIdentity } from "./types.js";

/** In-memory store for tests, stdio and single-instance dev. Not durable. */
export class MemoryStore implements McpStore {
  clients = new Map<string, OAuthClientInformationFull>();
  pending = new Map<string, PendingAuth>();
  codes = new Map<string, AuthCode>();
  refresh = new Map<string, RefreshRecord>();
  users = new Map<string, string>(); // googleId -> userId
  keys = new Map<string, ApiKeyRecord & { keyHash: string }>();
  usage = new Map<string, number>();

  async getClient(id: string) { return this.clients.get(id); }
  async saveClient(c: OAuthClientInformationFull) { this.clients.set(c.client_id, c); }
  async savePending(id: string, p: PendingAuth) { this.pending.set(id, p); }
  async takePending(id: string) { const p = this.pending.get(id); this.pending.delete(id); return p && p.expiresAt > Date.now() ? p : undefined; }
  async saveCode(h: string, c: AuthCode) { this.codes.set(h, c); }
  async peekCode(h: string) { const c = this.codes.get(h); return c && c.expiresAt > Date.now() ? c : undefined; }
  async takeCode(h: string) { const c = await this.peekCode(h); this.codes.delete(h); return c; }
  async saveRefresh(h: string, r: RefreshRecord) { this.refresh.set(h, r); }
  async takeRefresh(h: string) { const r = this.refresh.get(h); this.refresh.delete(h); return r && r.expiresAt > Date.now() ? r : undefined; }
  async revokeRefresh(h: string) { this.refresh.delete(h); }
  async upsertUser(u: UpstreamIdentity) {
    let id = this.users.get(u.googleId);
    if (!id) { id = randomUUID(); this.users.set(u.googleId, id); }
    return id;
  }
  async createApiKey(userId: string, name: string, keyHash: string, prefix: string, dailyLimit: number) {
    const rec = { id: randomUUID(), userId, name, prefix, dailyLimit, createdAt: new Date().toISOString(), revokedAt: null, keyHash };
    this.keys.set(rec.id, rec);
    const { keyHash: _h, ...pub } = rec; return pub;
  }
  async findApiKeyByHash(h: string) {
    for (const k of this.keys.values()) if (k.keyHash === h && !k.revokedAt) { const { keyHash: _h, ...pub } = k; return pub; }
    return undefined;
  }
  async listApiKeys(userId: string) {
    return [...this.keys.values()].filter((k) => k.userId === userId).map(({ keyHash: _h, ...pub }) => pub);
  }
  async revokeApiKey(userId: string, id: string) {
    const k = this.keys.get(id);
    if (!k || k.userId !== userId || k.revokedAt) return false;
    k.revokedAt = new Date().toISOString(); return true;
  }
  async consumeQuota(subject: string, day: string, limit: number) {
    const key = `${day}|${subject}`;
    const used = this.usage.get(key) ?? 0;
    if (used >= limit) return { allowed: false, used };
    this.usage.set(key, used + 1);
    if (this.usage.size > 50_000) for (const k of this.usage.keys()) if (!k.startsWith(day)) this.usage.delete(k);
    return { allowed: true, used: used + 1 };
  }
}
