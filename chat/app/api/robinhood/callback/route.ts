import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { exchangeCode } from "@/lib/robinhood/oauth";
import { callRobinhoodTool } from "@/lib/robinhood/mcp-client";
import { pickDefaultAccount, type RawAccount } from "@/lib/robinhood/parse";
import { saveRobinhoodConnection } from "@/lib/robinhood/connection";

export const dynamic = "force-dynamic";

function portfolioRedirect(request: NextRequest, result: string) {
  const url = new URL("/portfolio", request.url);
  url.searchParams.set("robinhood", result);
  const res = NextResponse.redirect(url);
  res.cookies.delete("rh_pkce_verifier");
  res.cookies.delete("rh_oauth_state");
  return res;
}

export async function GET(request: NextRequest) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const verifier = request.cookies.get("rh_pkce_verifier")?.value;
  const expectedState = request.cookies.get("rh_oauth_state")?.value;

  if (!code || !verifier || !state || state !== expectedState) {
    console.error("robinhood callback rejected before token exchange", {
      hasCode: !!code,
      hasVerifier: !!verifier,
      hasState: !!state,
      stateMatches: !!state && state === expectedState,
    });
    return portfolioRedirect(request, "error");
  }

  try {
    const redirectUri = new URL(
      "/api/robinhood/callback",
      request.url,
    ).toString();
    const tokens = await exchangeCode({ code, verifier, redirectUri });

    // Resolve which account the snapshot tracks, once, at connect time.
    const accountsPayload = (await callRobinhoodTool(
      tokens.access_token,
      "get_accounts",
    )) as { accounts?: RawAccount[] };
    const account = pickDefaultAccount(accountsPayload.accounts ?? []);
    if (!account) {
      return portfolioRedirect(request, "error");
    }

    await saveRobinhoodConnection(session.user.id, tokens, account);
    return portfolioRedirect(request, "connected");
  } catch (err) {
    console.error("robinhood callback failed", err);
    return portfolioRedirect(request, "error");
  }
}
