import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { extractHoldings } from "@/lib/portfolio/extract";
import { fetchQuotes } from "@/lib/portfolio/prices";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data body." },
      { status: 400 },
    );
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { error: "Missing 'file' field." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image is too large (max 8 MB)." },
      { status: 400 },
    );
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image type. Use PNG, JPEG, or WebP." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const extraction = await extractHoldings(
      buffer.toString("base64"),
      file.type,
    );
    const tickers = extraction.holdings.map((h) => h.ticker);
    const quotes = await fetchQuotes(tickers);
    return NextResponse.json({
      holdings: extraction.holdings,
      notes: extraction.notes,
      prices: Object.fromEntries(quotes.prices),
      missing_prices: quotes.missing,
    });
  } catch (err) {
    console.error("portfolio extract failed:", err);
    return NextResponse.json(
      { error: "Failed to extract holdings from this image." },
      { status: 500 },
    );
  }
}
