/**
 * Unit tests for the Neon Auth webhook signature verification + invite
 * allowlist. No network: we generate a local Ed25519 keypair, sign payloads
 * exactly the way Neon does (detached JWS over `${ts}.${b64(body)}`), and inject
 * the public key via the resolver. This pins the security-critical crypto —
 * a regression here either bricks all signups (fail closed) or, worse, accepts
 * forged ones.
 *
 * Run:  pnpm test:webhook
 * Or:   pnpm exec tsx evals/neon-webhook.test.ts
 */

import crypto from "node:crypto";
import { verifyNeonWebhook } from "@/lib/auth/neon-webhook";
import { isEmailAllowed } from "@/lib/auth/allowlist";

let failures = 0;
function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures++;
  }
}
async function assertThrows(fn: () => Promise<unknown>, label: string): Promise<void> {
  try {
    await fn();
    console.error(`  FAIL  ${label} (expected throw)`);
    failures++;
  } catch {
    console.log(`  PASS  ${label}`);
  }
}

// ── test signer: reproduce Neon's detached-JWS scheme ───────────────────────
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const KID = "test-key-1";
const resolver = async (kid: string) => {
  if (kid !== KID) throw new Error(`unknown kid ${kid}`);
  return publicKey;
};

function sign(rawBody: string, timestamp: string): string {
  const header = { alg: "EdDSA", typ: "JWT" };
  const headerB64 = Buffer.from(JSON.stringify(header), "utf8").toString("base64url");
  const payloadB64 = Buffer.from(rawBody, "utf8").toString("base64url");
  const signaturePayloadB64 = Buffer.from(`${timestamp}.${payloadB64}`, "utf8").toString("base64url");
  const signingInput = `${headerB64}.${signaturePayloadB64}`;
  const sig = crypto.sign(null, Buffer.from(signingInput), privateKey).toString("base64url");
  return `${headerB64}..${sig}`; // detached: empty middle segment
}

function headers(sig: string, ts: string, kid = KID): Headers {
  return new Headers({
    "x-neon-signature": sig,
    "x-neon-signature-kid": kid,
    "x-neon-timestamp": ts,
    "x-neon-event-type": "user.before_create",
  });
}

const NOW = 1_700_000_000_000;
const body = JSON.stringify({ user: { email: "invited@example.com" } });

console.log("\nneon webhook verification tests");
console.log("─".repeat(50));

(async () => {
  // ── (a) a valid signature verifies ─────────────────────────────────────────
  console.log("\n[a] valid signature");
  {
    const ts = String(NOW);
    await verifyNeonWebhook(body, headers(sign(body, ts), ts), resolver, NOW);
    assert(true, "well-formed signature passes verification");
  }

  // ── (b) tampered body is rejected ──────────────────────────────────────────
  console.log("\n[b] tampered body");
  {
    const ts = String(NOW);
    const sig = sign(body, ts);
    const forged = JSON.stringify({ user: { email: "attacker@evil.com" } });
    await assertThrows(
      () => verifyNeonWebhook(forged, headers(sig, ts), resolver, NOW),
      "body swapped after signing → rejected",
    );
  }

  // ── (c) wrong key is rejected ──────────────────────────────────────────────
  console.log("\n[c] wrong signing key");
  {
    const ts = String(NOW);
    const other = crypto.generateKeyPairSync("ed25519");
    const headerB64 = Buffer.from(JSON.stringify({ alg: "EdDSA" }), "utf8").toString("base64url");
    const payloadB64 = Buffer.from(body, "utf8").toString("base64url");
    const spB64 = Buffer.from(`${ts}.${payloadB64}`, "utf8").toString("base64url");
    const sig = crypto.sign(null, Buffer.from(`${headerB64}.${spB64}`), other.privateKey).toString("base64url");
    await assertThrows(
      () => verifyNeonWebhook(body, headers(`${headerB64}..${sig}`, ts), resolver, NOW),
      "signature from an unknown key → rejected",
    );
  }

  // ── (d) stale timestamp is rejected (replay protection) ────────────────────
  console.log("\n[d] stale timestamp");
  {
    const ts = String(NOW);
    const sig = sign(body, ts);
    const sixMinLater = NOW + 6 * 60 * 1000;
    await assertThrows(
      () => verifyNeonWebhook(body, headers(sig, ts), resolver, sixMinLater),
      "timestamp older than 5 min → rejected",
    );
  }

  // ── (e) missing headers are rejected ───────────────────────────────────────
  console.log("\n[e] missing headers");
  {
    await assertThrows(
      () => verifyNeonWebhook(body, new Headers(), resolver, NOW),
      "no signature headers → rejected",
    );
  }

  // ── (f) non-detached JWS is rejected ───────────────────────────────────────
  console.log("\n[f] non-detached format");
  {
    const ts = String(NOW);
    const malformed = "aGVhZGVy.cGF5bG9hZA.c2ln"; // non-empty middle segment
    await assertThrows(
      () => verifyNeonWebhook(body, headers(malformed, ts), resolver, NOW),
      "JWS with a payload segment → rejected",
    );
  }

  // ── (g) allowlist membership (env-driven) ──────────────────────────────────
  console.log("\n[g] allowlist");
  {
    process.env.NEON_AUTH_ALLOWED_EMAILS = "Invited@Example.com, second@example.com";
    // getAllowlist memoizes; this test process sets the env before first read.
    assert(isEmailAllowed("invited@example.com"), "listed email allowed (case-insensitive)");
    assert(isEmailAllowed("  SECOND@example.com  "), "trims + lowercases input");
    assert(!isEmailAllowed("stranger@example.com"), "unlisted email denied");
    assert(!isEmailAllowed(null), "null email denied");
    assert(!isEmailAllowed(""), "empty email denied");
  }

  console.log("\n" + "─".repeat(50));
  if (failures === 0) {
    console.log("All assertions passed.");
  } else {
    console.error(`${failures} assertion(s) FAILED.`);
  }
  process.exit(failures > 0 ? 1 : 0);
})();
