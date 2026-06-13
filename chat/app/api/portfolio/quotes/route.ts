import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { fetchQuotes } from "@/lib/portfolio/prices";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("tickers") ?? "";
  const tickers = raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 10);

  const quotes = await fetchQuotes(tickers);
  return NextResponse.json({
    prices: Object.fromEntries(quotes.prices),
    missing: quotes.missing,
  });
}
