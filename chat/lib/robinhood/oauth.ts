/**
 * Robinhood Agentic Trading OAuth — PKCE public client (no secret).
 * Endpoints discovered from agent.robinhood.com's OAuth server metadata;
 * the client_id came from a one-time Dynamic Client Registration call
 * (see thoughts/shared/plans/2026-07-02-robinhood-integration-design.md).
 */

import { createHash, randomBytes } from "node:crypto";

export const ROBINHOOD_MCP_URL = "https://agent.robinhood.com/mcp/trading";
export const AUTHORIZE_URL = "https://robinhood.com/oauth";
export const TOKEN_URL = "https://api.robinhood.com/oauth2/token/";
export const OAUTH_SCOPE = "internal";

export function clientId(): string {
  const id = process.env.ROBINHOOD_CLIENT_ID;
  if (!id) throw new Error("ROBINHOOD_CLIENT_ID is not set");
  return id;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  /** Seconds until access-token expiry. */
  expires_in: number;
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthorizeUrl(opts: {
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("scope", OAUTH_SCOPE);
  url.searchParams.set("state", opts.state);
  url.searchParams.set("code_challenge", opts.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

async function tokenRequest(
  params: Record<string, string>,
): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId(), ...params }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Robinhood token endpoint returned ${res.status}: ${body.slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as Partial<TokenResponse>;
  if (!json.access_token || !json.refresh_token) {
    throw new Error("Robinhood token response missing tokens");
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : 3600,
  };
}

export function exchangeCode(opts: {
  code: string;
  verifier: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: "authorization_code",
    code: opts.code,
    code_verifier: opts.verifier,
    redirect_uri: opts.redirectUri,
  });
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}
