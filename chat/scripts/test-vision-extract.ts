/**
 * Local CLI: extract holdings from a screenshot, fetch live Yahoo prices,
 * print a per-row breakdown + estimated total.
 *
 *   pnpm tsx --env-file=.env.local scripts/test-vision-extract.ts <path-to-screenshot>
 */
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { extractHoldings } from "../lib/portfolio/extract";
import { fetchQuotes } from "../lib/portfolio/prices";

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error(
      "usage: tsx scripts/test-vision-extract.ts <path-to-screenshot>",
    );
    process.exit(1);
  }
  const ext = extname(path).toLowerCase();
  const mediaType =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : "image/jpeg";
  const base64 = readFileSync(path).toString("base64");

  console.error(`extracting from ${path} (${mediaType})…`);
  const t0 = Date.now();
  const extraction = await extractHoldings(base64, mediaType);
  console.error(`  extraction done in ${Date.now() - t0}ms`);

  const tickers = extraction.holdings.map((h) => h.ticker);
  const t1 = Date.now();
  const { prices, missing } = await fetchQuotes(tickers);
  console.error(`  price lookup done in ${Date.now() - t1}ms`);

  const rows = extraction.holdings.map((h) => {
    const price = prices.get(h.ticker);
    return {
      ticker: h.ticker,
      shares: h.shares,
      price: price ?? null,
      value: price != null ? h.shares * price : null,
    };
  });
  const total = rows.reduce((s, r) => s + (r.value ?? 0), 0);

  console.error("");
  console.error(`holdings: ${extraction.holdings.length}`);
  if (missing.length > 0) {
    console.error(`missing prices for: ${missing.join(", ")}`);
  }
  if (extraction.notes) {
    console.error(`notes: ${extraction.notes}`);
  }
  console.error(`total portfolio value: $${total.toFixed(2)}`);
  console.error("");

  for (const r of rows) {
    const w =
      total > 0 && r.value != null
        ? `${((r.value / total) * 100).toFixed(1)}%`
        : "—";
    const priceStr =
      r.price != null ? `$${r.price.toFixed(2)}` : "—";
    const valueStr =
      r.value != null ? `$${r.value.toFixed(2)}` : "—";
    console.error(
      `  ${r.ticker.padEnd(8)} qty=${String(r.shares).padStart(8)}  px=${priceStr.padStart(10)}  value=${valueStr.padStart(12)}  (${w})`,
    );
  }
  console.error("");

  console.log(
    JSON.stringify(
      {
        holdings: extraction.holdings,
        notes: extraction.notes,
        prices: Object.fromEntries(prices),
        missing,
        total,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("error:", err);
  process.exit(1);
});
