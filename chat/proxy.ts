import { auth } from "@/lib/auth/server";

// Neon Auth proxy (Next 16's successor to the `middleware` file convention).
// Two jobs:
//  1. Completes the OAuth handoff: the social sign-in redirect returns to "/"
//     carrying a `neon_auth_session_verifier` query param, which must be
//     exchanged for the session cookie. Server Components can't set cookies, so
//     without this the exchange never happens and login loops back to
//     /auth/sign-in. The proxy can set cookies, so it finalizes the session.
//  2. Protects app routes + refreshes the session, redirecting unauthenticated
//     requests to `loginUrl`.
//
// `auth.middleware()` is Neon Auth's API name (unrelated to the Next file
// convention); it returns a (request) => Response handler that works as a proxy.
export default auth.middleware({ loginUrl: "/auth/sign-in" });

export const config = {
  // Run on app routes — including "/" so the OAuth verifier handoff lands.
  // Excludes: /api (the auth proxy at /api/auth + route handlers self-auth),
  // Next internals/static, /auth (matching it would loop the sign-in page),
  // and /engravings (public images the sign-in page loads pre-auth).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|auth|engravings).*)"],
};
