// Single source of truth for the invite allowlist.
//
// `NEON_AUTH_ALLOWED_EMAILS` is a comma-separated list of permitted emails. It
// gates two layers:
//   1. the Neon Auth `user.before_create` webhook (app/api/webhooks/neon) — the
//      real registration gate; blocks account creation for both email/password
//      and Google OAuth before the row is written.
//   2. the authenticated-layout guard ((app)/layout.tsx + onboarding pages) —
//      defense-in-depth for any account that predates the webhook registration.
//
// The app is invite-only by design, so an empty/unset list denies everyone
// (fail closed). Set the env var before going live or nobody — including you —
// can sign in.

let cached: Set<string> | null = null;

export function getAllowlist(): Set<string> {
  if (cached) return cached;
  const raw = process.env.NEON_AUTH_ALLOWED_EMAILS ?? "";
  cached = new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  return cached;
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAllowlist().has(email.trim().toLowerCase());
}
