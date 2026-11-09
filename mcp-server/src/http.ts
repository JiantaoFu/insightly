import express, { NextFunction, Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { InsightlyClient } from "./client.js";
import { Caller, QuotaManager, freeDailyLimit } from "./quota.js";
import { createServer } from "./server.js";
import type { McpStore } from "./store/types.js";
import { InsightlyOAuthProvider, SCOPE } from "./auth/provider.js";
import type { IdentityProvider } from "./auth/identity.js";
import { randomToken, sha256 } from "./auth/crypto.js";

export const API_KEY_PREFIX = "ins_";

export interface HttpOptions {
  store: McpStore;
  client?: InsightlyClient;
  /** Public base URL of this server, e.g. https://mcp.insightly.top (issuer). MCP endpoint is `${baseUrl}/mcp`. */
  baseUrl: URL;
  /** When set, OAuth 2.1 is enabled. */
  oauth?: { identity: IdentityProvider; jwtSecret: string; allowedRedirectHosts?: string[]; accessTtlSec?: number };
  /** Allow unauthenticated calls (IP-based free quota). Default: true without OAuth, false with OAuth. */
  allowAnonymous?: boolean;
  userDailyLimit?: number;     // OAuth users (default 25)
  anonDailyLimit?: number;     // anonymous (default 25)
  keyDefaultDailyLimit?: number; // new API keys (default 25)
  trustProxy?: boolean | number | string;
}

export function buildApp(o: HttpOptions) {
  const app = express();
  app.disable("x-powered-by");
  if (o.trustProxy !== undefined) app.set("trust proxy", o.trustProxy);
  const client = o.client ?? new InsightlyClient();
  const quota = new QuotaManager(o.store);
  const resourceUrl = new URL("/mcp", o.baseUrl);
  const prmUrl = getOAuthProtectedResourceMetadataUrl(resourceUrl);
  const allowAnon = o.allowAnonymous ?? !o.oauth;
  const free = freeDailyLimit();
  const userLimit = o.userDailyLimit ?? free, anonLimit = o.anonDailyLimit ?? free, keyLimit = o.keyDefaultDailyLimit ?? free;

  let provider: InsightlyOAuthProvider | undefined;
  if (o.oauth) {
    provider = new InsightlyOAuthProvider({
      store: o.store, identity: o.oauth.identity, jwtSecret: o.oauth.jwtSecret, resourceUrl, issuerUrl: o.baseUrl,
      allowedRedirectHosts: o.oauth.allowedRedirectHosts, accessTtlSec: o.oauth.accessTtlSec,
    });
    // /.well-known/oauth-authorization-server, /.well-known/oauth-protected-resource/mcp, /authorize, /token, /register, /revoke
    app.use(mcpAuthRouter({
      provider, issuerUrl: o.baseUrl, resourceServerUrl: resourceUrl, scopesSupported: [SCOPE],
      resourceName: "Insightly", serviceDocumentationUrl: new URL("https://github.com/JiantaoFu/insightly/tree/main/mcp-server"),
    }));
    // Root-path alias for clients that probe /.well-known/oauth-protected-resource without the path suffix.
    app.get("/.well-known/oauth-protected-resource", (_req, res) => {
      res.json({ resource: resourceUrl.href, authorization_servers: [o.baseUrl.href], scopes_supported: [SCOPE], resource_name: "Insightly", bearer_methods_supported: ["header"] });
    });
    app.get("/oauth/callback", async (req, res) => {
      const { state, code, error } = req.query as Record<string, string | undefined>;
      if (!state) { res.status(400).send("Missing state"); return; }
      try {
        res.redirect(302, await provider!.completeUpstream(state, error || !code ? "" : code));
      } catch (e: any) { res.status(400).send(String(e?.message ?? e)); }
    });
  }

  const challenge = (res: Response, err?: string, desc?: string) => {
    const parts = [`Bearer resource_metadata="${prmUrl}"`, `scope="${SCOPE}"`];
    if (err) parts.push(`error="${err}"`);
    if (desc) parts.push(`error_description="${desc.replace(/"/g, "'")}"`);
    res.set("WWW-Authenticate", parts.join(", ")).status(401).json({ error: err ?? "unauthorized", error_description: desc ?? "Authentication required" });
  };

  /** Resolve the caller from an API key, an OAuth access token, or (if allowed) anonymously. */
  const authenticate = (opts: { allowKeys: boolean; allowAnon: boolean }) => async (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    const headerKey = req.headers["x-api-key"] as string | undefined;
    const apiKey = headerKey ?? (bearer?.startsWith(API_KEY_PREFIX) ? bearer : undefined);
    try {
      if (apiKey) {
        if (!opts.allowKeys) return challenge(res, "invalid_token", "API keys cannot be used here; sign in with OAuth");
        const k = await o.store.findApiKeyByHash(sha256(apiKey));
        if (!k) return challenge(res, "invalid_token", "Unknown or revoked API key");
        (req as any).caller = { subject: `key:${k.id}`, dailyLimit: k.dailyLimit, tier: "key" } satisfies Caller;
        (req as any).userId = k.userId;
        return next();
      }
      if (bearer) {
        if (!provider) return challenge(res, "invalid_token", "OAuth is not enabled on this server");
        const info = await provider.verifyAccessToken(bearer).catch(() => null);
        if (!info) return challenge(res, "invalid_token", "Invalid or expired access token");
        if (!info.scopes.includes(SCOPE)) { res.status(403).set("WWW-Authenticate", `Bearer error="insufficient_scope", scope="${SCOPE}", resource_metadata="${prmUrl}"`).json({ error: "insufficient_scope" }); return; }
        const userId = String(info.extra?.userId);
        (req as any).caller = { subject: `user:${userId}`, dailyLimit: userLimit, tier: "user" } satisfies Caller;
        (req as any).userId = userId;
        return next();
      }
      if (!opts.allowAnon) return challenge(res);
      (req as any).caller = { subject: `anon:${req.ip ?? "unknown"}`, dailyLimit: anonLimit, tier: "anonymous" } satisfies Caller;
      next();
    } catch (e) { next(e); }
  };

  app.all("/mcp", express.json({ limit: "1mb" }), authenticate({ allowKeys: true, allowAnon: allowAnon }), async (req, res) => {
    const caller: Caller = (req as any).caller;
    const server = createServer(client, quota, () => caller);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined }); // stateless
    res.on("close", () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // API key management — requires an OAuth access token (keys cannot mint keys).
  const keyAuth = authenticate({ allowKeys: false, allowAnon: false });
  app.post("/keys", express.json(), keyAuth, async (req, res) => {
    const name = String(req.body?.name ?? "default").slice(0, 64);
    const key = `${API_KEY_PREFIX}${randomToken(24)}`;
    const rec = await o.store.createApiKey((req as any).userId, name, sha256(key), key.slice(0, 10), keyLimit);
    res.status(201).json({ ...rec, key, note: "Store this key now; it is not shown again." });
  });
  app.get("/keys", keyAuth, async (req, res) => { res.json({ keys: await o.store.listApiKeys((req as any).userId) }); });
  app.delete("/keys/:id", keyAuth, async (req, res) => {
    const ok = await o.store.revokeApiKey((req as any).userId, String(req.params.id));
    res.status(ok ? 204 : 404).end();
  });

  app.get("/healthz", (_req, res) => { res.json({ ok: true, oauth: !!provider, anonymous: allowAnon }); });
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("insightly-mcp error:", err?.message ?? err);
    if (!res.headersSent) res.status(500).json({ error: "server_error" });
  });
  return app;
}
