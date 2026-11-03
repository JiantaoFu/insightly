import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { InsightlyClient, FetchLike } from "../src/client.js";
import { extractAppIdent, sameApp, summarizeAppReport, listItems } from "../src/parse.js";
import { QuotaManager } from "../src/quota.js";
import { createServer } from "../src/server.js";

const REPORT = `# Summary of Key Insights
- **Overall Sentiment:** Heavily negative. 56% negative.
- **Key Strengths:** brand

# Key User Pain Points
1. **Paywalls:** too expensive
   - nested detail
2. **Bans:** unfair bans

# What Users Love
- **Swiping:** intuitive

# Feature Requests
1. Better filters
`;
const PLAY = "https://play.google.com/store/apps/details?id=com.tinder&hl=en";
const IOS = "https://apps.apple.com/us/app/tinder/id547702041";

function mockFetch(calls: string[] = []): FetchLike {
  const json = (b: any, status = 200) => ({ ok: status < 400, status, json: async () => b, text: async () => JSON.stringify(b) });
  return async (url) => {
    calls.push(url);
    const u = new URL(url);
    switch (u.pathname) {
      case "/api/search-apps":
        return json({ results: [{ title: "Tinder", appUrl: PLAY, platform: "google-play", score: 0, developer: "" }] });
      case "/api/quick-lookup":
        return u.searchParams.get("url")!.includes("com.tinder")
          ? json({ found: true, appTitle: "Tinder", platform: "android", avgRating: 2.6, reviewsCount: 100, topComplaints: ["x"], shareLink: "https://insightly.top/shared-app-report/abc" })
          : json({ found: false });
      case "/api/shared-app-report":
        return json({ appDetails: { title: "Tinder" }, report: REPORT });
      case "/api/db-comparisons":
        return json({ results: [{ shareLink: "https://insightly.top/shared-competitor-report/cmp1", competitors: JSON.stringify([{ name: "Tinder", url: PLAY }, { name: "Tinder iOS", url: IOS }]), urls: [PLAY, IOS], metadata: { timestamp: "2026-10-01" } }], pagination: { hasMore: false } });
      case "/api/shared-competitor-report":
        return json({ report: "# Summary Table\n| a | b |" });
      default:
        return json({ error: "nope" }, 404);
    }
  };
}

test("extractAppIdent handles both stores", () => {
  assert.deepEqual(extractAppIdent(PLAY), { platform: "android", appId: "com.tinder" });
  assert.deepEqual(extractAppIdent(IOS), { platform: "ios", appId: "547702041" });
  assert.equal(extractAppIdent("tinder"), null);
  assert.equal(extractAppIdent("https://example.com/?id=1"), null);
  assert.ok(sameApp(PLAY, "https://play.google.com/store/apps/details?id=com.tinder"));
  assert.ok(!sameApp(PLAY, IOS));
});

test("summarizeAppReport extracts sections, top-level items only", () => {
  const s = summarizeAppReport(REPORT);
  assert.match(s.sentiment!, /Heavily negative/);
  assert.deepEqual(s.painPoints, ["Paywalls: too expensive", "Bans: unfair bans"]);
  assert.deepEqual(s.praise, ["Swiping: intuitive"]);
  assert.deepEqual(s.featureRequests, ["Better filters"]);
  assert.deepEqual(listItems(undefined), []);
});

test("quota: anonymous limit, keys, unknown key, disabled", () => {
  const q = new QuotaManager(2, "k1:3", true);
  assert.ok(q.check("ip").allowed);
  assert.ok(q.check("ip").allowed);
  assert.equal(q.check("ip").allowed, false);
  assert.ok(q.check("other").allowed);
  for (let i = 0; i < 3; i++) assert.ok(q.check("ip", "k1").allowed);
  assert.equal(q.check("ip", "k1").allowed, false);
  assert.equal(q.check("ip", "bad").reason, "Unknown API key");
  assert.ok(new QuotaManager(0, "", false).check("x").allowed);
});

test("quota resets on a new UTC day", () => {
  let now = new Date("2026-11-03T10:00:00Z");
  const q = new QuotaManager(1, "", true, () => now);
  assert.ok(q.check("a").allowed);
  assert.equal(q.check("a").allowed, false);
  now = new Date("2026-11-04T00:00:01Z");
  assert.ok(q.check("a").allowed);
});

async function connect(fetchImpl: FetchLike, quota = new QuotaManager(100, "", true)) {
  const server = createServer(new InsightlyClient("https://insightly.top", fetchImpl), quota, () => ({ callerId: "t" }));
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(b);
  return client;
}
const parse = (r: any) => JSON.parse(r.content[0].text);

test("MCP lists exactly the three read-only tools", async () => {
  const c = await connect(mockFetch());
  const { tools } = await c.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ["analyze_app_reviews", "compare_competitors", "find_app"]);
  assert.ok(tools.every((t) => t.annotations?.readOnlyHint));
});

test("find_app maps search results", async () => {
  const c = await connect(mockFetch());
  const r = parse(await c.callTool({ name: "find_app", arguments: { query: "tinder" } }));
  assert.equal(r.results[0].app_id, "com.tinder");
  assert.equal(r.results[0].store_url, PLAY);
});

test("analyze_app_reviews resolves a name and returns report_url", async () => {
  const calls: string[] = [];
  const c = await connect(mockFetch(calls));
  const r = parse(await c.callTool({ name: "analyze_app_reviews", arguments: { app: "tinder" } }));
  assert.equal(r.found, true);
  assert.equal(r.report_url, "https://insightly.top/shared-app-report/abc");
  assert.deepEqual(r.top_complaints, ["Paywalls: too expensive", "Bans: unfair bans"]);
  assert.equal(r.reviews_analyzed, 100);
  // Never touches generation endpoints
  assert.ok(calls.every((u) => !/\/api\/(analyze|compare-competitors|chat)\b/.test(u)));
});

test("analyze_app_reviews: no cached report -> CTA, not an error", async () => {
  const c = await connect(mockFetch());
  const r = parse(await c.callTool({ name: "analyze_app_reviews", arguments: { app: "https://play.google.com/store/apps/details?id=com.unknown" } }));
  assert.equal(r.found, false);
  assert.match(r.analyze_url, /insightly\.top/);
});

test("compare_competitors uses cached comparison when all apps match", async () => {
  const c = await connect(mockFetch());
  const r = parse(await c.callTool({ name: "compare_competitors", arguments: { apps: [IOS, "https://play.google.com/store/apps/details?id=com.tinder"] } }));
  assert.equal(r.mode, "cached_comparison");
  assert.equal(r.report_url, "https://insightly.top/shared-competitor-report/cmp1");
});

test("compare_competitors falls back to side-by-side", async () => {
  const c = await connect(mockFetch());
  const r = parse(await c.callTool({ name: "compare_competitors", arguments: { apps: [PLAY, "https://play.google.com/store/apps/details?id=com.other"] } }));
  assert.equal(r.mode, "side_by_side_from_cached_app_reports");
  assert.equal(r.apps[0].found, true);
  assert.equal(r.apps[1].found, false);
});

test("quota exhaustion returns isError", async () => {
  const c = await connect(mockFetch(), new QuotaManager(1, "", true));
  await c.callTool({ name: "find_app", arguments: { query: "a" } });
  const r: any = await c.callTool({ name: "find_app", arguments: { query: "a" } });
  assert.equal(r.isError, true);
});

test("upstream HTTP errors surface as tool errors", async () => {
  const bad: FetchLike = async () => ({ ok: false, status: 429, json: async () => ({ error: "Daily free limit reached, try tomorrow" }), text: async () => "" });
  const c = await connect(bad);
  const r: any = await c.callTool({ name: "analyze_app_reviews", arguments: { app: PLAY } });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /Daily free limit/);
});
