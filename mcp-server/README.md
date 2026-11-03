# Insightly MCP server (cached-only MVP)

An MCP server that lets AI assistants (Claude, ChatGPT, Gemini, Cursor…) answer
"what do users complain about in app X?" and "compare X vs Y" using **Insightly's
existing cached reports** on [insightly.top](https://insightly.top). Every answer links back to the public report page.

> Status: internal MVP. **Not published or deployed anywhere.** No backend changes, no secrets, no LLM calls.

## Tools

| Tool | Input | What it does | Data source (existing public endpoints only) |
|---|---|---|---|
| `find_app` | `query`, `platform?` (`google-play`/`app-store`), `limit?` | Search both stores; returns name, platform, store URL, app id, icon, rating | `GET /api/search-apps` (store scraper, server-cached; no LLM) |
| `analyze_app_reviews` | `app` (store URL or name) | Top complaints, praise, feature requests, sentiment, reviews analyzed, `report_url` | name → `/api/search-apps`; then `GET /api/quick-lookup` (cache lookup only, 20/day/IP) and `GET /api/shared-app-report?shareId=` (full cached markdown, parsed locally) |
| `compare_competitors` | `apps[]` (2–4 URLs or names) | Cached head-to-head comparison markdown + `report_url`; otherwise a side-by-side of each app's cached report | `GET /api/db-comparisons` (index, memoized 1h) → `GET /api/shared-competitor-report?shareId=`; fallback = `analyze_app_reviews` per app |

Never called: `/api/analyze`, `/api/compare-competitors`, `/api/chat` (these generate with paid LLMs and need auth). A test asserts this.
If no cached report exists, the tool returns `found: false` with a link to generate one on insightly.top (the signup funnel).

## Run locally

```bash
cd mcp-server
npm install
npm run build
npm start              # stdio (Claude Desktop, Gemini CLI, Cursor)
npm run start:http     # Streamable HTTP at http://localhost:8787/mcp (PORT env to change)
npm test               # unit + in-memory MCP tests (mocked network)
INSIGHTLY_LIVE=1 npm test   # also hit production read-only endpoints
```

`npm test` covers tools, quota, the full OAuth flow (DCR → authorize → PKCE → token → refresh rotation → revoke), API keys,
and applies the real Supabase migrations to an in-process Postgres (PGlite). Nothing touches Supabase. See "Authentication" for env vars.

## Install in clients

### Claude Desktop
`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "insightly": { "command": "node", "args": ["/ABSOLUTE/PATH/insightly/mcp-server/dist/src/index.js"] }
  }
}
```
Once published to npm: `"command": "npx", "args": ["-y", "@insightly/mcp-server"]`. Restart Claude Desktop.
Also ship `SKILL.md` as a Claude Agent Skill so Claude knows when to call the tools.
For Claude remote/custom connectors: Settings → Connectors → Add custom connector → `https://<host>/mcp`; Claude discovers OAuth from the 401.

### ChatGPT Apps (Apps SDK)
ChatGPT only talks to **remote** MCP servers over HTTPS. Run `npm run start:http`, expose it
(e.g. `ngrok http 8787` for testing), then in ChatGPT → Settings → Apps & Connectors → Advanced → Developer mode →
Create connector, URL `https://<host>/mcp`, auth **OAuth** (ChatGPT runs DCR + PKCE automatically; allow `chatgpt.com` redirects).
The tools are annotated `readOnlyHint: true`. An optional report-card widget (Apps SDK UI component) is a later step.

### Gemini CLI
`~/.gemini/settings.json`:
```json
{ "mcpServers": { "insightly": { "command": "node", "args": ["/ABSOLUTE/PATH/insightly/mcp-server/dist/src/index.js"] } } }
```
or remote: `{ "mcpServers": { "insightly": { "httpUrl": "https://<host>/mcp" } } }`. As a Gemini CLI extension, add a
`gemini-extension.json` with the same `mcpServers` block plus a `GEMINI.md` (copy of SKILL.md) in a public repo.

### MCP registries (Official MCP Registry, Smithery, Glama, PulseMCP, mcp.so, Cursor directory)
- Official registry: `server.json` here is a **draft**. Steps: publish `@insightly/mcp-server` to npm with
  `"mcpName": "io.github.JiantaoFu/insightly"` in package.json, then `mcp-publisher login github && mcp-publisher publish`.
  For a remote entry add a `remotes: [{ "type": "streamable-http", "url": "https://<host>/mcp" }]` block.
- Smithery / Glama / PulseMCP / mcp.so mostly index from the official registry or a GitHub URL + README.
- Cursor: `.cursor/mcp.json` with the same `mcpServers` block as Claude Desktop.

## Authentication (HTTP transport)

stdio stays **keyless** (local process, in-memory 25/day). The HTTP transport supports three caller types:

| Caller | How | Daily quota (UTC day) | Quota subject |
|---|---|---|---|
| OAuth user | `Authorization: Bearer <access token>` from the OAuth flow below | 25 (`INSIGHTLY_MCP_FREE_DAILY`) | `user:<users.id>` |
| API key | `Authorization: Bearer ins_…` or `x-api-key: ins_…` | per key, `mcp_api_keys.daily_limit` (default 25) | `key:<key id>` |
| Anonymous | no credentials; only if OAuth is off or `MCP_ALLOW_ANONYMOUS=true` | 25 | `anon:<ip>` |

### OAuth 2.1 (MCP authorization spec 2025-06-18)
This server is both the **resource server** and a small **authorization server**; user login is **delegated to Google** and mapped
onto the existing Insightly `users` table (`google_id`), so MCP sign-ins are the same accounts as insightly.top. Implemented with
the MCP TypeScript SDK's auth router (`src/auth/provider.ts`). No changes to `server/` (the web backend).

- `GET /.well-known/oauth-protected-resource/mcp` (RFC 9728; also at the root path) → `authorization_servers: [MCP_PUBLIC_URL]`
- `GET /.well-known/oauth-authorization-server` (RFC 8414)
- `POST /register` — dynamic client registration (RFC 7591), public clients (`token_endpoint_auth_method: none`) supported.
  Redirect URIs must be https or localhost; optional host allow-list `MCP_ALLOWED_REDIRECT_HOSTS`.
- `GET /authorize` — authorization code + **PKCE S256 required**; `resource` (RFC 8707) must equal `MCP_PUBLIC_URL/mcp`
  → redirects to Google → `GET /oauth/callback` → back to the client with `code`, `state`, `iss` (RFC 9207).
- `POST /token` — `authorization_code` and `refresh_token` grants. Access tokens: HS256 JWT, 1 h, audience-bound to the MCP URL,
  scope `mcp:tools`. Refresh tokens: opaque, 30 days, SHA-256 hashed at rest, **rotated** on every use.
- `POST /revoke` (RFC 7009) for refresh tokens.
- `/mcp` without credentials → `401` + `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/mcp", scope="mcp:tools"`;
  wrong scope → `403 insufficient_scope`.

Client compatibility: Claude (custom connectors / directory) and ChatGPT (Apps / connectors, "OAuth" auth) both discover via the
401 + protected resource metadata, use DCR and PKCE. Callback URLs to allow-list if you set `MCP_ALLOWED_REDIRECT_HOSTS`:
`claude.ai` (`https://claude.ai/api/mcp/auth_callback`), `chatgpt.com` (`https://chatgpt.com/connector_platform_oauth_redirect`),
plus localhost is always allowed (MCP Inspector, Claude Code, Gemini CLI).

### API keys
Keys are minted by a signed-in (OAuth) user; a key cannot mint keys. Shown once; stored as SHA-256.
```bash
curl -X POST $URL/keys -H "Authorization: Bearer $ACCESS_TOKEN" -d '{"name":"laptop"}' -H 'content-type: application/json'
curl $URL/keys -H "Authorization: Bearer $ACCESS_TOKEN"          # list (no secrets)
curl -X DELETE $URL/keys/<id> -H "Authorization: Bearer $ACCESS_TOKEN"   # revoke
```
Raise a key's limit for a paying user with SQL: `update mcp_api_keys set daily_limit = 500 where id = '…';` (no billing hook yet).

### Persistence
`MCP_STORE=supabase` uses Supabase/Postgres (`src/store/supabase.ts`); otherwise an in-memory store (tests, local dev, stdio).
Migration: `supabase/migrations/20261103120000_create_mcp_auth_tables.sql` — tables `mcp_oauth_clients`, `mcp_oauth_pending`,
`mcp_oauth_codes`, `mcp_refresh_tokens`, `mcp_api_keys`, `mcp_usage`, and the atomic `mcp_consume_quota(subject, day, limit)` function.
RLS is enabled with no policies, so only the service-role key can touch them.

### Configuration (HTTP)
| Env var | Required | Meaning |
|---|---|---|
| `MCP_PUBLIC_URL` | yes (prod) | Public base URL, e.g. `https://mcp.insightly.top` (issuer; MCP endpoint is `/mcp`). Must be https except localhost |
| `PORT` | no | default 8787 |
| `MCP_GOOGLE_CLIENT_ID` / `MCP_GOOGLE_CLIENT_SECRET` | for OAuth | Google OAuth client (Web). Authorized redirect URI: `${MCP_PUBLIC_URL}/oauth/callback`. OAuth is enabled iff the ID is set |
| `MCP_JWT_SECRET` | for OAuth | ≥ 32 random chars, **separate** from the web app's `JWT_SECRET` (`openssl rand -base64 48`) |
| `MCP_STORE` | prod | `supabase` to persist; anything else = memory |
| `MCP_SUPABASE_URL` / `MCP_SUPABASE_SERVICE_ROLE_KEY` | with `MCP_STORE=supabase` | service-role key (server-side only) |
| `MCP_ALLOWED_REDIRECT_HOSTS` | no | e.g. `claude.ai,chatgpt.com` (localhost always allowed) |
| `MCP_ALLOW_ANONYMOUS` | no | `true` to also serve unauthenticated callers when OAuth is on (default false with OAuth, true without) |
| `MCP_TRUST_PROXY` | behind a proxy | Express `trust proxy` (e.g. `1` on Render) so anonymous quota uses the real client IP |
| `INSIGHTLY_MCP_FREE_DAILY` | no | free daily calls for users/anonymous/new keys (default **25**) |
| `INSIGHTLY_MCP_QUOTA` | no | `off` disables quota (dev only) |
| `INSIGHTLY_BASE_URL` | no | upstream Insightly (default `https://insightly.top`) |

## Limitations
- **Cached-only**: ~2.8k app reports and ~24 competitor comparisons exist; anything else returns `found: false` + CTA.
- `compare_competitors` only returns a true comparison when one cached comparison contains **all** requested apps; otherwise it is a side-by-side of single-app reports (no gap/opportunity analysis).
- OAuth/API-key state only persists with `MCP_STORE=supabase`; the in-memory store is single-instance and lost on restart.
- No billing hook: paid users need `daily_limit` raised manually. No consent screen beyond Google's account chooser.
- Upstream `/api/quick-lookup` is limited to 20/day **per IP**. Fine locally; a hosted server shares one IP, so it needs a server-side allowance/key (backend change, deferred).
- Name resolution picks the first store search hit (Google Play first). Pass a store URL for precision.
- Summary fields are parsed from report markdown headings; reports with unusual headings may yield empty lists (the `report_url` is always returned). `latest_review_in_sample` is the newest review date in the cached sample, not the generation time.
- Reports expire per the backend's `RECORD_EXPIRATION_HOURS`; no refresh is possible without credits.
- `find_app` triggers live store scraping on cache misses (no LLM cost, but store ToS risk at scale).
