import type { Response } from "express";
import type { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthClientInformationFull, OAuthTokenRevocationRequest, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { InvalidGrantError, InvalidTargetError, InvalidTokenError, InvalidClientMetadataError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { McpStore } from "../store/types.js";
import type { IdentityProvider } from "./identity.js";
import { randomToken, sha256, signJwt, verifyJwt } from "./crypto.js";

export const SCOPE = "mcp:tools";
export interface ProviderOptions {
  store: McpStore;
  identity: IdentityProvider;
  jwtSecret: string;
  resourceUrl: URL;               // canonical MCP URL, e.g. https://mcp.insightly.top/mcp  (token audience)
  issuerUrl: URL;
  accessTtlSec?: number;          // default 3600
  refreshTtlSec?: number;         // default 30 days
  allowedRedirectHosts?: string[];// optional allow-list for DCR redirect_uris (besides localhost)
}

const sameResource = (a: string, b: string) => a.replace(/\/+$/, "") === b.replace(/\/+$/, "");

/**
 * OAuth 2.1 authorization server for the MCP HTTP transport (MCP authorization spec 2025-06-18):
 *  - Dynamic client registration (RFC 7591), public clients, PKCE S256 required (enforced by the SDK handlers)
 *  - Resource indicators (RFC 8707): tokens are audience-bound to `resourceUrl`
 *  - User login is delegated to Google, mapped onto the existing Insightly `users` table
 *  - Access tokens: short-lived HS256 JWTs; refresh tokens: opaque, hashed at rest, rotated on use
 */
export class InsightlyOAuthProvider implements OAuthServerProvider {
  constructor(private o: ProviderOptions) {}

  get clientsStore(): OAuthRegisteredClientsStore {
    const { store, allowedRedirectHosts } = this.o;
    return {
      getClient: (id) => store.getClient(id),
      registerClient: async (meta) => {
        for (const uri of meta.redirect_uris) {
          const u = new URL(String(uri));
          const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
          if (!local && u.protocol !== "https:") throw new InvalidClientMetadataError("redirect_uris must be https (or localhost)");
          if (!local && allowedRedirectHosts?.length && !allowedRedirectHosts.includes(u.hostname))
            throw new InvalidClientMetadataError(`redirect host ${u.hostname} is not allowed`);
        }
        const full = { ...meta, client_id: crypto.randomUUID(), client_id_issued_at: Math.floor(Date.now() / 1000) } as OAuthClientInformationFull;
        await store.saveClient(full);
        return full;
      },
    };
  }

  private checkResource(resource?: URL) {
    if (resource && !sameResource(resource.href, this.o.resourceUrl.href)) throw new InvalidTargetError(`Unknown resource ${resource.href}`);
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response) {
    this.checkResource(params.resource);
    const id = randomToken(24), upstreamVerifier = randomToken(48);
    await this.o.store.savePending(id, {
      clientId: client.client_id, redirectUri: params.redirectUri, codeChallenge: params.codeChallenge,
      state: params.state, scopes: params.scopes?.length ? params.scopes : [SCOPE],
      resource: (params.resource ?? this.o.resourceUrl).href, upstreamVerifier, expiresAt: Date.now() + 10 * 60_000,
    });
    res.redirect(302, this.o.identity.authorizationUrl(id, upstreamVerifier));
  }

  /** Upstream (Google) callback: finish login, mint our auth code, bounce back to the MCP client. Returns the redirect URL. */
  async completeUpstream(state: string, upstreamCode: string): Promise<string> {
    const p = await this.o.store.takePending(state);
    if (!p) throw new Error("Login session expired or invalid; restart the connection.");
    const back = new URL(p.redirectUri);
    try {
      const ident = await this.o.identity.exchange(upstreamCode, p.upstreamVerifier);
      const userId = await this.o.store.upsertUser(ident);
      const code = randomToken(32);
      await this.o.store.saveCode(sha256(code), {
        clientId: p.clientId, userId, redirectUri: p.redirectUri, codeChallenge: p.codeChallenge,
        scopes: p.scopes, resource: p.resource, expiresAt: Date.now() + 5 * 60_000,
      });
      back.searchParams.set("code", code);
    } catch (e: any) {
      back.searchParams.set("error", "access_denied");
      back.searchParams.set("error_description", String(e?.message ?? e).slice(0, 200));
    }
    if (p.state) back.searchParams.set("state", p.state);
    back.searchParams.set("iss", this.o.issuerUrl.href); // RFC 9207
    return back.toString();
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, code: string) {
    const c = await this.o.store.peekCode(sha256(code));
    if (!c || c.clientId !== client.client_id) throw new InvalidGrantError("Invalid authorization code");
    return c.codeChallenge;
  }

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, code: string, _verifier?: string, redirectUri?: string, resource?: URL): Promise<OAuthTokens> {
    const c = await this.o.store.takeCode(sha256(code));
    if (!c || c.clientId !== client.client_id) throw new InvalidGrantError("Invalid authorization code");
    if (redirectUri && redirectUri !== c.redirectUri) throw new InvalidGrantError("redirect_uri mismatch");
    if (resource && c.resource && !sameResource(resource.href, c.resource)) throw new InvalidTargetError("resource mismatch");
    return this.issue(client.client_id, c.userId, c.scopes, c.resource);
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string, scopes?: string[], resource?: URL): Promise<OAuthTokens> {
    const r = await this.o.store.takeRefresh(sha256(refreshToken));
    if (!r || r.clientId !== client.client_id) throw new InvalidGrantError("Invalid refresh token");
    if (resource && r.resource && !sameResource(resource.href, r.resource)) throw new InvalidTargetError("resource mismatch");
    const granted = scopes?.length ? scopes.filter((s) => r.scopes.includes(s)) : r.scopes;
    return this.issue(client.client_id, r.userId, granted, r.resource);
  }

  private async issue(clientId: string, userId: string, scopes: string[], resource?: string): Promise<OAuthTokens> {
    const now = Math.floor(Date.now() / 1000), ttl = this.o.accessTtlSec ?? 3600;
    const access = signJwt({
      iss: this.o.issuerUrl.href, sub: userId, aud: resource ?? this.o.resourceUrl.href,
      client_id: clientId, scope: scopes.join(" "), iat: now, exp: now + ttl, jti: randomToken(12),
    }, this.o.jwtSecret);
    const refresh = randomToken(32);
    await this.o.store.saveRefresh(sha256(refresh), {
      clientId, userId, scopes, resource, expiresAt: Date.now() + (this.o.refreshTtlSec ?? 30 * 86400) * 1000,
    });
    return { access_token: access, token_type: "bearer", expires_in: ttl, refresh_token: refresh, scope: scopes.join(" ") };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const p = verifyJwt(token, this.o.jwtSecret);
    if (!p || p.iss !== this.o.issuerUrl.href) throw new InvalidTokenError("Invalid or expired token");
    if (!sameResource(String(p.aud), this.o.resourceUrl.href)) throw new InvalidTokenError("Token audience mismatch");
    return {
      token, clientId: p.client_id, scopes: String(p.scope ?? "").split(" ").filter(Boolean),
      expiresAt: p.exp, resource: new URL(p.aud), extra: { userId: p.sub },
    };
  }

  async revokeToken(_client: OAuthClientInformationFull, req: OAuthTokenRevocationRequest) {
    await this.o.store.revokeRefresh(sha256(req.token)); // access tokens are short-lived JWTs
  }
}
