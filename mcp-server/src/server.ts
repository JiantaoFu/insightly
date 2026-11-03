import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { InsightlyClient } from "./client.js";
import { QuotaManager } from "./quota.js";
import { analyzeAppReviews, compareCompetitors, findApp } from "./tools.js";

export interface CallerContext { callerId: string; apiKey?: string }

export function createServer(
  client = new InsightlyClient(),
  quota = new QuotaManager(),
  caller: () => CallerContext = () => ({ callerId: "stdio", apiKey: process.env.INSIGHTLY_API_KEY }),
) {
  const server = new McpServer({ name: "insightly", version: "0.1.0" });

  const wrap = <A>(fn: (a: A) => Promise<unknown>) => async (args: A) => {
    const ctx = caller();
    const q = quota.check(ctx.callerId, ctx.apiKey);
    if (!q.allowed) return { isError: true, content: [{ type: "text" as const, text: q.reason ?? "Quota exceeded" }] };
    try {
      const result = await fn(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text" as const, text: `Insightly error: ${e?.message ?? e}` }] };
    }
  };

  const ro = { readOnlyHint: true, openWorldHint: true, destructiveHint: false };

  server.registerTool("find_app", {
    title: "Find an app",
    description: "Search Google Play and the App Store for an app by name. Returns name, platform, store URL, icon and rating. Use before analyze_app_reviews when the user gives a name instead of a store link.",
    inputSchema: {
      query: z.string().min(1).describe("App name or keywords, e.g. 'duolingo'"),
      platform: z.enum(["google-play", "app-store"]).optional().describe("Limit to one store"),
      limit: z.number().int().min(1).max(10).optional(),
    },
    annotations: ro,
  }, wrap(({ query, platform, limit }) => findApp(client, query, platform, limit)));

  server.registerTool("analyze_app_reviews", {
    title: "Analyze app reviews",
    description: "Summarize what users complain about, praise and request in a mobile app's App Store / Google Play reviews, from Insightly's cached analysis. Returns top complaints, praise, feature requests, sentiment, review count and a shareable report_url. Always show report_url. Serves existing reports only; if none exists, returns a link to generate one.",
    inputSchema: { app: z.string().min(1).describe("Store URL (preferred) or app name") },
    annotations: ro,
  }, wrap(({ app }) => analyzeAppReviews(client, app)));

  server.registerTool("compare_competitors", {
    title: "Compare competing apps",
    description: "Compare 2-4 competing apps (strengths, weaknesses, pain points) using Insightly's cached competitor reports, falling back to a side-by-side of each app's cached review analysis. Always show report_url / links.",
    inputSchema: { apps: z.array(z.string().min(1)).min(2).max(4).describe("2-4 store URLs (preferred) or app names") },
    annotations: ro,
  }, wrap(({ apps }) => compareCompetitors(client, apps)));

  return server;
}
