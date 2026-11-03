import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildApp } from "../src/http.js";
import { MemoryStore } from "../src/store/memory.js";
import type { IdentityProvider } from "../src/auth/identity.js";
import { pkceChallenge, randomToken, signJwt } from "../src/auth/crypto.js";
import { InsightlyClient, FetchLike } from "../src/client.js";

const BASE = "http://localhost:8787";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const SECRET = "x".repeat(40);

class FakeIdentity implements IdentityProvider {
  authorizationUrl(state: string) { return `https://accounts.example/auth?state=${state}`; }
  async exchange(code: string) { if (code === "bad") throw new Error("denied"); return { googleId: `g-${code}`, email: `${code}@x.com` }; }
}
const noNet: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({ results: [] }), text: async () => "" });

function setup(extra: Partial<Parameters<typeof buildApp>[0]> = {}) {
  const store = new MemoryStore();
  const app = buildApp({ store, baseUrl: new URL(BASE), client: new InsightlyClient(BASE, noNet), oauth: { identity: new FakeIdentity(), jwtSecret: SECRET }, ...extra });
  return { app, store };
}
const LIST = { jsonrpc: "2.0", id: 1, method: "tools/list" };
const CALL = { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "find_app", arguments: { query: "x" } } };
const mcp = (app: any, token?: string, body: object = LIST) => {
  const r = request(app).post("/mcp").set("accept", "application/json, text/event-stream").set("content-type", "application/json");
  if (token) r.set("authorization", `Bearer ${token}`);
  return r.send(body);
};

/** Full OAuth 2.1 authorization-code + PKCE flow as Claude/ChatGPT would run it. */
async function login(app: any, user = "alice", resource = `${BASE}/mcp`) {
  const reg = await request(app).post("/register").send({ redirect_uris: [REDIRECT], client_name: "Claude", token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  const clientId = reg.body.client_id;
  const verifier = randomToken(48);
  const auth = await request(app).get("/authorize").query({ response_type: "code", client_id: clientId, redirect_uri: REDIRECT, code_challenge: pkceChallenge(verifier), code_challenge_method: "S256", state: "st8", scope: "mcp:tools", resource });
  assert.equal(auth.status, 302, auth.text);
  const upstream = new URL(auth.headers.location);
  assert.equal(upstream.host, "accounts.example");
  const cb = await request(app).get("/oauth/callback").query({ state: upstream.searchParams.get("state"), code: user });
  assert.equal(cb.status, 302);
  const back = new URL(cb.headers.location);
  assert.equal(back.origin + back.pathname, REDIRECT);
  assert.equal(back.searchParams.get("state"), "st8");
  const code = back.searchParams.get("code")!;
  return { clientId, verifier, code };
}
const exchange = (app: any, l: { clientId: string; verifier: string; code: string }, verifier = l.verifier) =>
  request(app).post("/token").type("form").send({ grant_type: "authorization_code", client_id: l.clientId, code: l.code, code_verifier: verifier, redirect_uri: REDIRECT, resource: `${BASE}/mcp` });

test("metadata: protected resource (RFC 9728) and authorization server (RFC 8414)", async () => {
  const { app } = setup();
  const prm = await request(app).get("/.well-known/oauth-protected-resource/mcp");
  assert.equal(prm.status, 200);
  assert.equal(prm.body.resource, `${BASE}/mcp`);
  assert.deepEqual(prm.body.authorization_servers, [`${BASE}/`]);
  assert.equal((await request(app).get("/.well-known/oauth-protected-resource")).body.resource, `${BASE}/mcp`);
  const as = await request(app).get("/.well-known/oauth-authorization-server");
  assert.equal(as.status, 200);
  assert.deepEqual(as.body.code_challenge_methods_supported, ["S256"]);
  assert.ok(as.body.registration_endpoint && as.body.token_endpoint && as.body.authorization_endpoint);
  assert.ok(as.body.grant_types_supported.includes("refresh_token"));
});

test("unauthenticated /mcp -> 401 with WWW-Authenticate resource_metadata", async () => {
  const { app } = setup();
  const r = await mcp(app);
  assert.equal(r.status, 401);
  assert.match(r.headers["www-authenticate"], /resource_metadata="http:\/\/localhost:8787\/\.well-known\/oauth-protected-resource\/mcp"/);
  const bad = await mcp(app, "not-a-token");
  assert.equal(bad.status, 401);
  assert.match(bad.headers["www-authenticate"], /error="invalid_token"/);
});

test("full flow: DCR + PKCE + token + MCP call + refresh rotation + revoke", async () => {
  const { app } = setup();
  const l = await login(app);
  const tok = await exchange(app, l);
  assert.equal(tok.status, 200, JSON.stringify(tok.body));
  assert.equal(tok.body.token_type.toLowerCase(), "bearer");
  assert.ok(tok.body.refresh_token);
  const ok = await mcp(app, tok.body.access_token);
  assert.equal(ok.status, 200);
  assert.match(ok.text, /analyze_app_reviews/);

  // code is single-use
  assert.equal((await exchange(app, l)).status, 400);

  // refresh rotates
  const r1 = await request(app).post("/token").type("form").send({ grant_type: "refresh_token", client_id: l.clientId, refresh_token: tok.body.refresh_token });
  assert.equal(r1.status, 200);
  assert.notEqual(r1.body.refresh_token, tok.body.refresh_token);
  const reuse = await request(app).post("/token").type("form").send({ grant_type: "refresh_token", client_id: l.clientId, refresh_token: tok.body.refresh_token });
  assert.equal(reuse.status, 400);

  // revoke refresh token
  assert.equal((await request(app).post("/revoke").type("form").send({ client_id: l.clientId, token: r1.body.refresh_token })).status, 200);
  assert.equal((await request(app).post("/token").type("form").send({ grant_type: "refresh_token", client_id: l.clientId, refresh_token: r1.body.refresh_token })).status, 400);
});

test("PKCE: wrong code_verifier is rejected", async () => {
  const { app } = setup();
  const l = await login(app);
  const r = await exchange(app, l, randomToken(48));
  assert.equal(r.status, 400);
  assert.equal(r.body.error, "invalid_grant");
});

test("PKCE is mandatory at /authorize", async () => {
  const { app } = setup();
  const reg = await request(app).post("/register").send({ redirect_uris: [REDIRECT], token_endpoint_auth_method: "none" });
  const r = await request(app).get("/authorize").query({ response_type: "code", client_id: reg.body.client_id, redirect_uri: REDIRECT, state: "s" });
  assert.equal(r.status, 302);
  assert.equal(new URL(r.headers.location).searchParams.get("error"), "invalid_request");
});

test("resource indicator for another server is rejected", async () => {
  const { app } = setup();
  const reg = await request(app).post("/register").send({ redirect_uris: [REDIRECT], token_endpoint_auth_method: "none" });
  const r = await request(app).get("/authorize").query({ response_type: "code", client_id: reg.body.client_id, redirect_uri: REDIRECT, code_challenge: pkceChallenge("v".repeat(50)), code_challenge_method: "S256", resource: "https://evil.example/mcp" });
  assert.equal(r.status, 302);
  assert.equal(new URL(r.headers.location).searchParams.get("error"), "invalid_target");
});

test("tokens with wrong audience or issuer are rejected", async () => {
  const { app } = setup();
  const now = Math.floor(Date.now() / 1000);
  const t = signJwt({ iss: `${BASE}/`, aud: "https://other/mcp", sub: "u", client_id: "c", scope: "mcp:tools", exp: now + 60 }, SECRET);
  assert.equal((await mcp(app, t)).status, 401);
  const t2 = signJwt({ iss: "https://evil/", aud: `${BASE}/mcp`, sub: "u", client_id: "c", scope: "mcp:tools", exp: now + 60 }, SECRET);
  assert.equal((await mcp(app, t2)).status, 401);
  const t3 = signJwt({ iss: `${BASE}/`, aud: `${BASE}/mcp`, sub: "u", client_id: "c", scope: "mcp:tools", exp: now - 1 }, SECRET);
  assert.equal((await mcp(app, t3)).status, 401);
  const t4 = signJwt({ iss: `${BASE}/`, aud: `${BASE}/mcp`, sub: "u", client_id: "c", scope: "other", exp: now + 60 }, SECRET);
  assert.equal((await mcp(app, t4)).status, 403);
});

test("DCR: rejects non-https redirect URIs and enforces host allow-list", async () => {
  const { app } = setup({ oauth: { identity: new FakeIdentity(), jwtSecret: SECRET, allowedRedirectHosts: ["claude.ai", "chatgpt.com"] } });
  assert.equal((await request(app).post("/register").send({ redirect_uris: ["http://evil.example/cb"] })).status, 400);
  assert.equal((await request(app).post("/register").send({ redirect_uris: ["https://evil.example/cb"] })).status, 400);
  assert.equal((await request(app).post("/register").send({ redirect_uris: ["https://chatgpt.com/connector_platform_oauth_redirect"], token_endpoint_auth_method: "none" })).status, 201);
  assert.equal((await request(app).post("/register").send({ redirect_uris: ["http://localhost:6274/cb"], token_endpoint_auth_method: "none" })).status, 201);
});

test("upstream login failure returns error to client redirect", async () => {
  const { app } = setup();
  const reg = await request(app).post("/register").send({ redirect_uris: [REDIRECT], token_endpoint_auth_method: "none" });
  const a = await request(app).get("/authorize").query({ response_type: "code", client_id: reg.body.client_id, redirect_uri: REDIRECT, code_challenge: pkceChallenge("v".repeat(50)), code_challenge_method: "S256", state: "z" });
  const cb = await request(app).get("/oauth/callback").query({ state: new URL(a.headers.location).searchParams.get("state"), code: "bad" });
  const back = new URL(cb.headers.location);
  assert.equal(back.searchParams.get("error"), "access_denied");
  assert.equal(back.searchParams.get("state"), "z");
  // state is single-use
  assert.equal((await request(app).get("/oauth/callback").query({ state: new URL(a.headers.location).searchParams.get("state"), code: "x" })).status, 400);
});

test("API keys: create with OAuth token, use on /mcp, list, revoke; keys cannot mint keys", async () => {
  const { app, store } = setup();
  const tok = (await exchange(app, await login(app))).body.access_token;
  assert.equal((await request(app).post("/keys").send({})).status, 401);
  const created = await request(app).post("/keys").set("authorization", `Bearer ${tok}`).send({ name: "laptop" });
  assert.equal(created.status, 201);
  const key: string = created.body.key;
  assert.match(key, /^ins_/);
  assert.equal(created.body.dailyLimit, 25);
  assert.ok(![...store.keys.values()].some((k: any) => k.keyHash === key), "stored hashed");

  assert.equal((await mcp(app, key)).status, 200);
  assert.equal((await request(app).post("/mcp").set("x-api-key", key).set("accept", "application/json, text/event-stream").send(LIST)).status, 200);
  assert.equal((await request(app).post("/keys").set("authorization", `Bearer ${key}`).send({})).status, 401);

  const list = await request(app).get("/keys").set("authorization", `Bearer ${tok}`);
  assert.equal(list.body.keys.length, 1);
  assert.equal(list.body.keys[0].key, undefined);
  assert.equal((await request(app).delete(`/keys/${created.body.id}`).set("authorization", `Bearer ${tok}`)).status, 204);
  assert.equal((await mcp(app, key)).status, 401);
  assert.equal((await mcp(app, "ins_doesnotexist")).status, 401);
});

test("per-user and per-key daily quota over HTTP", async () => {
  const { app } = setup({ userDailyLimit: 2, keyDefaultDailyLimit: 1 });
  const tok = (await exchange(app, await login(app))).body.access_token;
  for (let i = 0; i < 2; i++) assert.doesNotMatch((await mcp(app, tok, CALL)).text, /quota/i);
  assert.match((await mcp(app, tok, CALL)).text, /Daily quota of 2 calls reached/);
  // a different user has their own bucket
  const tok2 = (await exchange(app, await login(app, "bob"))).body.access_token;
  assert.doesNotMatch((await mcp(app, tok2, CALL)).text, /quota/i);
  // a key has its own bucket and limit
  const key = (await request(app).post("/keys").set("authorization", `Bearer ${tok}`).send({})).body.key;
  assert.doesNotMatch((await mcp(app, key, CALL)).text, /quota/i);
  assert.match((await mcp(app, key, CALL)).text, /Daily quota of 1 calls reached/);
});

test("without OAuth configured, HTTP is anonymous with IP free quota", async () => {
  const { app } = setup({ oauth: undefined, anonDailyLimit: 1 });
  assert.equal((await request(app).get("/.well-known/oauth-authorization-server")).status, 404);
  assert.equal((await mcp(app)).status, 200);
  assert.doesNotMatch((await mcp(app, undefined, CALL)).text, /quota/i);
  assert.match((await mcp(app, undefined, CALL)).text, /quota/i);
});

test("OAuth + allowAnonymous: anonymous allowed, tokens still accepted", async () => {
  const { app } = setup({ allowAnonymous: true });
  assert.equal((await mcp(app)).status, 200);
  const tok = (await exchange(app, await login(app))).body.access_token;
  assert.equal((await mcp(app, tok)).status, 200);
});
