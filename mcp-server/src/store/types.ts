import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";

export interface PendingAuth {
  clientId: string; redirectUri: string; codeChallenge: string; state?: string;
  scopes: string[]; resource?: string; upstreamVerifier: string; expiresAt: number;
}
export interface AuthCode {
  clientId: string; userId: string; redirectUri: string; codeChallenge: string;
  scopes: string[]; resource?: string; expiresAt: number;
}
export interface RefreshRecord { clientId: string; userId: string; scopes: string[]; resource?: string; expiresAt: number }
export interface UpstreamIdentity { googleId: string; email?: string; name?: string; picture?: string }
export interface ApiKeyRecord { id: string; userId: string; name: string; prefix: string; dailyLimit: number; createdAt: string; revokedAt?: string | null }

/** Persistence for OAuth state, API keys and quota. Secrets (codes, refresh tokens, API keys) are stored as SHA-256 hashes. */
export interface McpStore {
  getClient(clientId: string): Promise<OAuthClientInformationFull | undefined>;
  saveClient(client: OAuthClientInformationFull): Promise<void>;
  savePending(id: string, p: PendingAuth): Promise<void>;
  takePending(id: string): Promise<PendingAuth | undefined>;          // one-time
  saveCode(codeHash: string, c: AuthCode): Promise<void>;
  peekCode(codeHash: string): Promise<AuthCode | undefined>;
  takeCode(codeHash: string): Promise<AuthCode | undefined>;          // one-time
  saveRefresh(tokenHash: string, r: RefreshRecord): Promise<void>;
  takeRefresh(tokenHash: string): Promise<RefreshRecord | undefined>; // one-time (rotation)
  revokeRefresh(tokenHash: string): Promise<void>;
  upsertUser(u: UpstreamIdentity): Promise<string>;                    // returns users.id
  createApiKey(userId: string, name: string, keyHash: string, prefix: string, dailyLimit: number): Promise<ApiKeyRecord>;
  findApiKeyByHash(keyHash: string): Promise<ApiKeyRecord | undefined>;
  listApiKeys(userId: string): Promise<ApiKeyRecord[]>;
  revokeApiKey(userId: string, id: string): Promise<boolean>;
  /** Atomically consume one unit of `subject`'s quota for `day`. */
  consumeQuota(subject: string, day: string, limit: number): Promise<{ allowed: boolean; used: number }>;
}
