import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { DEMO_BOOK_ENTRIES } from "@/lib/demo/book";
import { diffHoldingsAgainstBook } from "@/lib/portfolio/gap-math";
import { fetchQuotes } from "@/lib/portfolio/prices";
import { getBrokerHoldings } from "@/lib/robinhood/holdings";

export const dynamic = "force-dynamic";

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

  const { prices } = await fetchQuotes(result.holdings.map((holding) => holding.ticker));
  const gap = diffHoldingsAgainstBook(result.holdings, prices, DEMO_BOOK_ENTRIES);
  return NextResponse.json({
    connected: true,
    fetchedAt: result.fetchedAt.toISOString(),
    stale: result.stale,
    gap,
  });
}
