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

Env vars (all optional): `INSIGHTLY_BASE_URL` (default `https://insightly.top`), `INSIGHTLY_MCP_FREE_DAILY` (default 25),
`INSIGHTLY_MCP_KEYS` (`key:limit,...`), `INSIGHTLY_MCP_QUOTA=off`, `INSIGHTLY_API_KEY` (stdio caller's key), `PORT`.

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
The Claude **connectors directory** requires a hosted remote server (HTTPS, OAuth recommended) — see Next steps.

### ChatGPT Apps (Apps SDK)
ChatGPT only talks to **remote** MCP servers over HTTPS. Run `npm run start:http`, expose it
(e.g. `ngrok http 8787` for testing), then in ChatGPT → Settings → Apps & Connectors → Advanced → Developer mode →
Create connector, URL `https://<host>/mcp`, auth "No authentication" (or OAuth later).
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

## API keys & free quota (stub)

`src/quota.ts` implements the design; it is in-memory and not connected to billing.
- Anonymous: `INSIGHTLY_MCP_FREE_DAILY` calls/day per caller (IP over HTTP, `stdio` locally), reset at UTC midnight.
- Keyed: `Authorization: Bearer <key>` or `x-api-key` (HTTP), `INSIGHTLY_API_KEY` (stdio); limits from `INSIGHTLY_MCP_KEYS`.
- Unknown key → error; exhausted → `isError` with an upgrade link.
- Later: keys stored in Supabase (`api_keys` table tied to the existing Google-auth user + credits), counters in
  Redis/Supabase for multi-instance, and OAuth 2.1 for Claude/ChatGPT directories so keyed users can spend credits
  on fresh analyses (`/api/analyze`, needs a non-streaming adapter on the backend).

## Limitations
- **Cached-only**: ~2.8k app reports and ~24 competitor comparisons exist; anything else returns `found: false` + CTA.
- `compare_competitors` only returns a true comparison when one cached comparison contains **all** requested apps; otherwise it is a side-by-side of single-app reports (no gap/opportunity analysis).
- Upstream `/api/quick-lookup` is limited to 20/day **per IP**. Fine locally; a hosted server shares one IP, so it needs a server-side allowance/key (backend change, deferred).
- Name resolution picks the first store search hit (Google Play first). Pass a store URL for precision.
- Summary fields are parsed from report markdown headings; reports with unusual headings may yield empty lists (the `report_url` is always returned). `latest_review_in_sample` is the newest review date in the cached sample, not the generation time.
- Reports expire per the backend's `RECORD_EXPIRATION_HOURS`; no refresh is possible without credits.
- `find_app` triggers live store scraping on cache misses (no LLM cost, but store ToS risk at scale).
