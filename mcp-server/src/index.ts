#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { buildApp } from "./http.js";
import { MemoryStore } from "./store/memory.js";
import { SupabaseStore } from "./store/supabase.js";
import { GoogleIdentity } from "./auth/identity.js";
import { InsightlyClient } from "./client.js";
import { QuotaManager } from "./quota.js";

async function main() {
  if (!process.argv.includes("--http")) {
    // stdio: local & keyless; in-memory free quota only.
    await createServer(new InsightlyClient(), new QuotaManager(new MemoryStore())).connect(new StdioServerTransport());
    return;
  }
  const env = process.env;
  const port = Number(env.PORT ?? 8787);
  const baseUrl = new URL(env.MCP_PUBLIC_URL ?? `http://localhost:${port}`);
  const store = env.MCP_STORE === "supabase" ? SupabaseStore.fromEnv() : new MemoryStore();
  if (env.MCP_STORE !== "supabase") console.error("[insightly-mcp] using in-memory store (state lost on restart)");

  let oauth: import("./http.js").HttpOptions["oauth"];
  if (env.MCP_GOOGLE_CLIENT_ID) {
    if (!env.MCP_GOOGLE_CLIENT_SECRET || !env.MCP_JWT_SECRET || env.MCP_JWT_SECRET.length < 32)
      throw new Error("OAuth needs MCP_GOOGLE_CLIENT_SECRET and MCP_JWT_SECRET (>= 32 chars)");
    oauth = {
      identity: new GoogleIdentity(env.MCP_GOOGLE_CLIENT_ID, env.MCP_GOOGLE_CLIENT_SECRET, new URL("/oauth/callback", baseUrl).href),
      jwtSecret: env.MCP_JWT_SECRET,
      allowedRedirectHosts: env.MCP_ALLOWED_REDIRECT_HOSTS?.split(",").map((s) => s.trim()).filter(Boolean),
    };
  }
  const app = buildApp({
    store, baseUrl, oauth,
    allowAnonymous: env.MCP_ALLOW_ANONYMOUS ? env.MCP_ALLOW_ANONYMOUS === "true" : undefined,
    trustProxy: env.MCP_TRUST_PROXY ? (Number.isNaN(Number(env.MCP_TRUST_PROXY)) ? env.MCP_TRUST_PROXY : Number(env.MCP_TRUST_PROXY)) : undefined,
  });
  app.listen(port, () => console.error(`[insightly-mcp] ${new URL("/mcp", baseUrl).href} (oauth: ${!!oauth})`));
}

main().catch((e) => { console.error(e); process.exit(1); });
