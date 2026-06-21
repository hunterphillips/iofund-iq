import crypto from "node:crypto";

// Verification for Neon Auth webhooks (detached EdDSA/Ed25519 JWS).
//
// Neon signs each delivery with an asymmetric Ed25519 key published at
// `${NEON_AUTH_BASE_URL}/.well-known/jwks.json`. The signature is a detached
// JWS ("header..signature") over a double-base64url-encoded
// `${timestamp}.${base64url(rawBody)}`. Verification uses Node's built-in
// crypto — no extra dependency.
//
// Split from the route handler so the crypto can be unit-tested with an
// injected key resolver (evals/neon-webhook.test.ts).

export type Jwk = {
  kid: string;
  kty: string;
  crv: string;
  x: string;
  alg?: string;
};

const JWKS_PATH = "/.well-known/jwks.json";
const MAX_SKEW_MS = 5 * 60 * 1000; // replay-protection window (Neon's recommendation)

export type KeyResolver = (kid: string) => Promise<crypto.KeyObject>;

// JWKS rarely changes; cache across warm invocations and refetch on a kid miss
// (covers rotation without reconfiguring the endpoint).
let jwksCache: Jwk[] | null = null;

async function fetchJwks(force = false): Promise<Jwk[]> {
  if (jwksCache && !force) return jwksCache;
  const base = process.env.NEON_AUTH_BASE_URL;
  if (!base) throw new Error("NEON_AUTH_BASE_URL is not set");
  const res = await fetch(`${base}${JWKS_PATH}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const body = (await res.json()) as { keys: Jwk[] };
  jwksCache = body.keys;
  return body.keys;
}

const jwksKeyResolver: KeyResolver = async (kid) => {
  let jwk = (await fetchJwks()).find((k) => k.kid === kid);
  if (!jwk) jwk = (await fetchJwks(true)).find((k) => k.kid === kid); // possible rotation
  if (!jwk) throw new Error(`Key ${kid} not found in JWKS`);
  return crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: "jwk" });
};

/**
 * Throws if the request is not a valid, fresh Neon Auth webhook signature.
 * `resolveKey` and `now` are injectable for testing; production uses the JWKS
 * fetch and the real clock.
 */
export async function verifyNeonWebhook(
  rawBody: string,
  headers: Headers,
  resolveKey: KeyResolver = jwksKeyResolver,
  now: number = Date.now(),
): Promise<void> {
  const signature = headers.get("x-neon-signature");
  const kid = headers.get("x-neon-signature-kid");
  const timestamp = headers.get("x-neon-timestamp");
  if (!signature || !kid || !timestamp) {
    throw new Error("Missing Neon signature headers");
  }

  const ageMs = now - Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ageMs) || Math.abs(ageMs) > MAX_SKEW_MS) {
    throw new Error("Webhook timestamp outside tolerance");
  }

  const publicKey = await resolveKey(kid);

  // Detached JWS: "header..signature" (empty middle segment).
  const [headerB64, emptyPayload, signatureB64] = signature.split(".");
  if (emptyPayload !== "") throw new Error("Expected detached JWS format");

  const payloadB64 = Buffer.from(rawBody, "utf8").toString("base64url");
  const signaturePayloadB64 = Buffer.from(
    `${timestamp}.${payloadB64}`,
    "utf8",
  ).toString("base64url");
  const signingInput = `${headerB64}.${signaturePayloadB64}`;

  const ok = crypto.verify(
    null, // Ed25519: algorithm inferred from the key
    Buffer.from(signingInput),
    publicKey,
    Buffer.from(signatureB64, "base64url"),
  );
  if (!ok) throw new Error("Invalid webhook signature");
}
