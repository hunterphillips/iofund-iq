import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getBrokerHoldings } from "@/lib/robinhood/holdings";
import { computePortfolioGap } from "@/lib/portfolio/compare";

export const dynamic = "force-dynamic";

// Feeds the /portfolio Compare view: the user's snapshot holdings diffed
// against the fund's book. ?force=1 is the manual refresh button.
export async function GET(request: NextRequest) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force") === "1";
  const result = await getBrokerHoldings(session.user.id, { force });
  if (!result.connected) {
    return NextResponse.json({ connected: false });
  }

  const gap = await computePortfolioGap(result.holdings);
  return NextResponse.json({
    connected: true,
    fetchedAt: result.fetchedAt.toISOString(),
    stale: result.stale,
    gap,
  });
}
