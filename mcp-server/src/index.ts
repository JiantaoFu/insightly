#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer as createHttpServer } from "node:http";
import { InsightlyClient } from "./client.js";
import { QuotaManager } from "./quota.js";
import { createServer } from "./server.js";

async function main() {
  if (!process.argv.includes("--http")) {
    await createServer().connect(new StdioServerTransport());
    return;
  }
  // Stateless Streamable HTTP at POST /mcp (for ChatGPT Apps / remote connectors). Local use only for now.
  const port = Number(process.env.PORT ?? 8787);
  const client = new InsightlyClient();
  const quota = new QuotaManager();
  createHttpServer(async (req, res) => {
    if (req.url?.split("?")[0] !== "/mcp") { res.writeHead(404).end("Not found"); return; }
    const auth = req.headers.authorization;
    const apiKey = auth?.startsWith("Bearer ") ? auth.slice(7) : (req.headers["x-api-key"] as string | undefined);
    const callerId = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
    let body: unknown;
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const ch of req) chunks.push(ch as Buffer);
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"); } catch { res.writeHead(400).end("Bad JSON"); return; }
    }
    const server = createServer(client, quota, () => ({ callerId, apiKey }));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  }).listen(port, () => console.error(`insightly-mcp listening on http://localhost:${port}/mcp`));
}

main().catch((e) => { console.error(e); process.exit(1); });
