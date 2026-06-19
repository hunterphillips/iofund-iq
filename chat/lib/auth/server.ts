import { createNeonAuth } from "@neondatabase/auth/next/server";

if (!process.env.NEON_AUTH_BASE_URL) {
  throw new Error("NEON_AUTH_BASE_URL is not set");
}
if (!process.env.NEON_AUTH_COOKIE_SECRET) {
  throw new Error("NEON_AUTH_COOKIE_SECRET is not set");
}

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET,
    // OAuth challenge cookie must survive the cross-site return from Google's
    // consent screen. The package default flipped to SameSite=Strict, which the
    // browser withholds on that top-level cross-site navigation — so the proxy
    // never sees the challenge cookie and the sign-in loops. Lax is the standard
    // OAuth setting (sent on top-level cross-site GETs; still blocks CSRF subrequests).
    sameSite: "lax",
  },
});
