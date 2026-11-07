import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { ApiKeyRecord, AuthCode, McpStore, PendingAuth, RefreshRecord, UpstreamIdentity } from "./types.js";

/**
 * Supabase/Postgres store. Tables come from supabase/migrations/20261103120000_create_mcp_auth_tables.sql.
 * Must use a SERVICE ROLE key (the mcp_* tables have RLS enabled with no policies).
 * Reuses the existing `users` table so MCP sign-ins are the same Insightly accounts as the web app.
 */
export class SupabaseStore implements McpStore {
  constructor(private db: SupabaseClient) {}
  static fromEnv(): SupabaseStore {
    const url = process.env.MCP_SUPABASE_URL, key = process.env.MCP_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("MCP_SUPABASE_URL and MCP_SUPABASE_SERVICE_ROLE_KEY are required for MCP_STORE=supabase");
    return new SupabaseStore(createClient(url, key, { auth: { persistSession: false } }));
  }
  private must<T>(r: { data: T; error: any }): T { if (r.error) throw new Error(r.error.message); return r.data; }
  private iso(ms: number) { return new Date(ms).toISOString(); }

  async getClient(id: string) {
    const d = this.must(await this.db.from("mcp_oauth_clients").select("client_info").eq("client_id", id).maybeSingle());
    return (d as any)?.client_info as OAuthClientInformationFull | undefined;
  }
  async saveClient(c: OAuthClientInformationFull) {
    this.must(await this.db.from("mcp_oauth_clients").upsert({ client_id: c.client_id, client_info: c }));
  }
  private async takeJson<T>(table: string, col: string, id: string): Promise<T | undefined> {
    const rows = this.must(await this.db.from(table).delete().eq(col, id).gt("expires_at", new Date().toISOString()).select("data")) as any[];
    return rows?.[0]?.data as T | undefined;
  }
  async savePending(id: string, p: PendingAuth) {
    this.must(await this.db.from("mcp_oauth_pending").insert({ id, data: p, expires_at: this.iso(p.expiresAt) }));
  }
  async takePending(id: string) { return this.takeJson<PendingAuth>("mcp_oauth_pending", "id", id); }
  async saveCode(h: string, c: AuthCode) {
    this.must(await this.db.from("mcp_oauth_codes").insert({ code_hash: h, data: c, expires_at: this.iso(c.expiresAt) }));
  }
  async peekCode(h: string) {
    const d = this.must(await this.db.from("mcp_oauth_codes").select("data").eq("code_hash", h).gt("expires_at", new Date().toISOString()).maybeSingle());
    return (d as any)?.data as AuthCode | undefined;
  }
  async takeCode(h: string) { return this.takeJson<AuthCode>("mcp_oauth_codes", "code_hash", h); }
  async saveRefresh(h: string, r: RefreshRecord) {
    this.must(await this.db.from("mcp_refresh_tokens").insert({ token_hash: h, client_id: r.clientId, user_id: r.userId, scopes: r.scopes, resource: r.resource ?? null, expires_at: this.iso(r.expiresAt) }));
  }
  async takeRefresh(h: string) {
    const rows = this.must(await this.db.from("mcp_refresh_tokens").delete().eq("token_hash", h).gt("expires_at", new Date().toISOString()).select("*")) as any[];
    const r = rows?.[0];
    return r ? { clientId: r.client_id, userId: r.user_id, scopes: r.scopes ?? [], resource: r.resource ?? undefined, expiresAt: Date.parse(r.expires_at) } : undefined;
  }
  async revokeRefresh(h: string) { this.must(await this.db.from("mcp_refresh_tokens").delete().eq("token_hash", h)); }

  async upsertUser(u: UpstreamIdentity) {
    const existing = this.must(await this.db.from("users").select("id").eq("google_id", u.googleId).maybeSingle()) as any;
    const now = new Date().toISOString();
    if (existing?.id) {
      this.must(await this.db.from("users").update({ last_login: now, updated_at: now }).eq("id", existing.id));
      return existing.id as string;
    }
    // Same defaults as the web app's Google callback (server/index.js): 1 dataset credit.
    const ins = this.must(await this.db.from("users").insert({
      google_id: u.googleId, email: u.email, display_name: u.name, photo_url: u.picture, provider: "google",
      last_login: now, updated_at: now, dataset_credits: 1,
    }).select("id").single()) as any;
    return ins.id as string;
  }

  private mapKey(r: any): ApiKeyRecord {
    return { id: r.id, userId: r.user_id, name: r.name, prefix: r.prefix, dailyLimit: r.daily_limit, createdAt: r.created_at, revokedAt: r.revoked_at };
  }
  async createApiKey(userId: string, name: string, keyHash: string, prefix: string, dailyLimit: number) {
    const r = this.must(await this.db.from("mcp_api_keys").insert({ user_id: userId, name, key_hash: keyHash, prefix, daily_limit: dailyLimit }).select("*").single());
    return this.mapKey(r);
  }
  async findApiKeyByHash(h: string) {
    const r = this.must(await this.db.from("mcp_api_keys").select("*").eq("key_hash", h).is("revoked_at", null).maybeSingle());
    if (!r) return undefined;
    void this.db.from("mcp_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", (r as any).id).then(() => {});
    return this.mapKey(r);
  }
  async listApiKeys(userId: string) {
    const rows = this.must(await this.db.from("mcp_api_keys").select("*").eq("user_id", userId).order("created_at", { ascending: false })) as any[];
    return rows.map((r) => this.mapKey(r));
  }
  async revokeApiKey(userId: string, id: string) {
    const rows = this.must(await this.db.from("mcp_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).is("revoked_at", null).select("id")) as any[];
    return rows.length > 0;
  }
  async consumeQuota(subject: string, day: string, limit: number) {
    const rows = this.must(await this.db.rpc("mcp_consume_quota", { p_subject: subject, p_day: day, p_limit: limit })) as any;
    const r = Array.isArray(rows) ? rows[0] : rows;
    return { allowed: !!r?.allowed, used: Number(r?.used ?? 0) };
  }
}
