import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { searchArticles } from "@/lib/articles/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return new Response("Not signed in.", { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? undefined;
  const ticker = sp.get("ticker") ?? undefined;
  const category = sp.get("category") ?? undefined;
  const since = sp.get("since") ?? undefined;

  const result = await searchArticles({ q, ticker, category, since, limit: 50 });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
