import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { buildAuthorizeUrl, generatePkce } from "@/lib/robinhood/oauth";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

// Starts the Robinhood OAuth dance (PKCE public client). The verifier and
// state ride short-lived httpOnly cookies to the callback. Note: Robinhood's
// OAuth onboarding is desktop-browser-only on their end.
export async function GET(request: NextRequest) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const { verifier, challenge } = generatePkce();
  const state = randomBytes(16).toString("base64url");
  const redirectUri = new URL("/api/robinhood/callback", request.url).toString();

  const res = NextResponse.redirect(
    buildAuthorizeUrl({ redirectUri, state, challenge }),
  );
  const cookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/robinhood",
    // Generous: Robinhood's consent path can detour through a slow
    // investor-profile questionnaire before returning to our callback.
    maxAge: 1800,
  };
  res.cookies.set("rh_pkce_verifier", verifier, cookie);
  res.cookies.set("rh_oauth_state", state, cookie);
  return res;
}
