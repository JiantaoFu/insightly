import type { UpstreamIdentity } from "../store/types.js";
import { pkceChallenge } from "./crypto.js";

/** Upstream login used inside /authorize. Google by default (same identity as the Insightly web app). */
export interface IdentityProvider {
  authorizationUrl(state: string, codeVerifier: string): string;
  exchange(code: string, codeVerifier: string): Promise<UpstreamIdentity>;
}

export class GoogleIdentity implements IdentityProvider {
  constructor(private clientId: string, private clientSecret: string, private redirectUri: string, private fetchImpl: typeof fetch = fetch) {}
  authorizationUrl(state: string, verifier: string) {
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.search = new URLSearchParams({
      client_id: this.clientId, redirect_uri: this.redirectUri, response_type: "code",
      scope: "openid email profile", state, code_challenge: pkceChallenge(verifier),
      code_challenge_method: "S256", prompt: "select_account",
    }).toString();
    return u.toString();
  }
  async exchange(code: string, verifier: string): Promise<UpstreamIdentity> {
    const tok = await this.fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: this.clientId, client_secret: this.clientSecret, redirect_uri: this.redirectUri, grant_type: "authorization_code", code_verifier: verifier }),
    });
    if (!tok.ok) throw new Error(`Google token exchange failed (${tok.status})`);
    const { access_token } = await tok.json() as any;
    const ui = await this.fetchImpl("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${access_token}` } });
    if (!ui.ok) throw new Error(`Google userinfo failed (${ui.status})`);
    const u = await ui.json() as any;
    if (!u.sub) throw new Error("Google userinfo missing sub");
    if (u.email && u.email_verified === false) throw new Error("Google email not verified");
    return { googleId: String(u.sub), email: u.email, name: u.name, picture: u.picture };
  }
}
