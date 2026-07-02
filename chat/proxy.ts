import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

// Neon Auth proxy (Next 16's successor to the `middleware` file convention).
// Wraps Neon Auth's `auth.middleware` so the public landing page can live at "/"
// without losing the two jobs that handler does:
//   1. Completes the OAuth handoff: a social sign-in redirect returns to "/"
//      carrying a `neon_auth_session_verifier` query param, which must be
//      exchanged for the session cookie. Server Components can't set cookies, so
//      the proxy finalizes it.
//   2. Protects app routes + refreshes the session, redirecting unauthenticated
//      requests to `loginUrl`.
//
// The public marketing surface ("/" and the waitlist endpoint) must NOT be
// gated, so we let those through directly — EXCEPT when the OAuth verifier param
// is present on "/", in which case we still delegate so job 1 runs (Google is
// disabled today, but this keeps the handoff intact for re-enable).
const protect = auth.middleware({ loginUrl: "/auth/sign-in" });

// Paths the public can reach without a session. Keep in sync with the matcher.
const PUBLIC_PATHS = new Set(["/", "/api/waitlist"]);

export default function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const hasOAuthVerifier = searchParams.has("neon_auth_session_verifier");

  if (PUBLIC_PATHS.has(pathname) && !hasOAuthVerifier) {
    return NextResponse.next();
  }

  return protect(req);
}

export const config = {
  // Run on app routes — including "/" (public, but the OAuth verifier handoff
  // lands here) and "/api/waitlist" (public POST). Excludes: the rest of /api
  // (route handlers self-auth), Next internals/static, /auth (matching it would
  // loop the sign-in page), and /engravings (public images the pages load).
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|auth|engravings).*)",
    "/api/waitlist",
  ],
};
