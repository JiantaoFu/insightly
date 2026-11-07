import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** Minimal HS256 JWT (access tokens are only ever verified by this server). */
export function signJwt(payload: Record<string, unknown>, secret: string): string {
  const head = b64({ alg: "HS256", typ: "at+jwt" });
  const body = b64(payload);
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

export function verifyJwt(token: string, secret: string): Record<string, any> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  try {
    if (JSON.parse(Buffer.from(head, "base64url").toString()).alg !== "HS256") return null;
    const expected = createHmac("sha256", secret).update(`${head}.${body}`).digest();
    const got = Buffer.from(sig, "base64url");
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof p.exp !== "number" || p.exp * 1000 < Date.now()) return null;
    return p;
  } catch { return null; }
}
