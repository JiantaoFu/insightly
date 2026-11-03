// Applies the real Supabase migrations to an in-process WASM Postgres (PGlite). Never touches Supabase.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const mig = (f: string) => readFileSync(fileURLToPath(new URL(`../../../supabase/migrations/${f}`, import.meta.url)), "utf8");

test("MCP migration applies, is idempotent, and mcp_consume_quota is correct", async () => {
  const db = new PGlite();
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated;");
  await db.exec(mig("20250514120000_create_users_table.sql"));
  await db.exec(mig("20250618180000_add_dataset_credits_to_users.sql"));
  const sql = mig("20261103120000_create_mcp_auth_tables.sql");
  await db.exec(sql);
  await db.exec(sql);
  const q = async (s: string, d: string, l: number) => (await db.query<{ allowed: boolean; used: number }>("SELECT * FROM mcp_consume_quota($1,$2,$3)", [s, d, l])).rows[0];
  assert.deepEqual(await q("s", "2026-11-03", 2), { allowed: true, used: 1 });
  assert.deepEqual(await q("s", "2026-11-03", 2), { allowed: true, used: 2 });
  assert.deepEqual(await q("s", "2026-11-03", 2), { allowed: false, used: 2 });
  assert.deepEqual(await q("s", "2026-11-04", 2), { allowed: true, used: 1 });
  assert.deepEqual(await q("zero", "2026-11-03", 0), { allowed: false, used: 0 });

  await db.exec("INSERT INTO users(google_id,email) VALUES ('g1','a@x.com')");
  await db.exec("INSERT INTO mcp_api_keys(user_id,key_hash,prefix) SELECT id,'h','ins_x' FROM users");
  assert.equal((await db.query<{ daily_limit: number }>("SELECT daily_limit FROM mcp_api_keys")).rows[0].daily_limit, 25);
  await assert.rejects(db.exec("INSERT INTO mcp_api_keys(user_id,key_hash,prefix) SELECT id,'h','dup' FROM users")); // unique hash
  const rls = await db.query<{ n: number }>("SELECT count(*)::int n FROM pg_class WHERE relname LIKE 'mcp_%' AND relkind='r' AND relrowsecurity");
  assert.equal(rls.rows[0].n, 6);
  await db.close();
});
