/**
 * Pure unit tests for the portfolio gap math + ticker remap. No DB, no network.
 *
 * Run:  pnpm test:gap
 * Or:   pnpm exec tsx evals/gap.test.ts
 *
 * Tests diffHoldingsAgainstBook (the pure core extracted from
 * computePortfolioGap) and toYahooSymbol. The I/O shell (computePortfolioGap)
 * is exercised end-to-end by the chat eval; here we pin the arithmetic.
 */

import {
  diffHoldingsAgainstBook,
  type IofBookEntry,
} from "@/lib/portfolio/gap-math";
import { toYahooSymbol } from "@/lib/portfolio/prices";

let failures = 0;
function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures++;
  }
}

const BOOK: IofBookEntry[] = [
  { ticker: "NVDA", company: "NVIDIA Corp", category: "AI Accelerators", iofWeight: 10 },
  { ticker: "MU", company: "Micron", category: "AI Memory", iofWeight: 6 },
  { ticker: "BE", company: "Bloom Energy", category: "AI Energy", iofWeight: 4 },
];

console.log("\ngap math unit tests");
console.log("─".repeat(50));

// ── (a) partition: iof_only vs overlap ──────────────────────────────────────
console.log("\n[a] partition + weights");
{
  // User holds NVDA + MU (in the book) and AAPL (not). $6000 NVDA, $4000 MU.
  const prices = new Map([
    ["NVDA", 600],
    ["MU", 200],
    ["AAPL", 100],
  ]);
  const holdings = [
    { ticker: "NVDA", shares: 10 }, // $6000
    { ticker: "MU", shares: 20 }, // $4000
    { ticker: "AAPL", shares: 10 }, // $1000
  ];
  const r = diffHoldingsAgainstBook(holdings, prices, BOOK);

  assert(r.total_value_usd === 11000, "total value = shares × price summed");
  assert(
    r.iof_only.map((x) => x.ticker).sort().join(",") === "BE",
    "iof_only = book tickers the user doesn't hold (BE)",
  );
  const nvda = r.overlap.find((o) => o.ticker === "NVDA")!;
  // NVDA = 6000/11000 = 54.5%, IOF 10% → delta +44.5
  assert(nvda.your_weight_pct === 54.5, "user weight = value / total, 1dp");
  assert(nvda.delta_pct === 44.5, "delta = your − iof, 1dp");
  assert(
    r.overlap.map((o) => o.ticker).sort().join(",") === "MU,NVDA",
    "overlap = tickers held by both",
  );
  assert(
    r.yours_only.map((y) => y.ticker).join(",") === "AAPL",
    "yours_only = user tickers outside the book",
  );
  // AAPL = 1000/11000 = 9.1%
  assert(
    r.yours_only[0].your_weight_pct === 9.1,
    "yours_only carries the user's live weight",
  );
  assert(
    nvda.category === "AI Accelerators" && nvda.company === "NVIDIA Corp",
    "overlap rows carry book company + category",
  );
}

// ── (b) missing prices excluded ─────────────────────────────────────────────
console.log("\n[b] missing prices");
{
  const prices = new Map([["NVDA", 100]]); // MU has no price
  const holdings = [
    { ticker: "NVDA", shares: 1 },
    { ticker: "MU", shares: 5 },
  ];
  const r = diffHoldingsAgainstBook(holdings, prices, BOOK);
  assert(r.missing_prices.join(",") === "MU", "unpriced holding reported as missing");
  assert(r.total_value_usd === 100, "unpriced holding excluded from total");
  assert(
    r.overlap.find((o) => o.ticker === "MU") === undefined,
    "unpriced holding not counted as overlap",
  );
}

// ── (c) case-insensitive ticker match ───────────────────────────────────────
console.log("\n[c] case-insensitivity");
{
  const prices = new Map([["NVDA", 100]]);
  const r = diffHoldingsAgainstBook([{ ticker: "nvda", shares: 1 }], prices, BOOK);
  assert(
    r.overlap.some((o) => o.ticker === "NVDA"),
    "lowercase holding matches uppercase book ticker",
  );
}

// ── (d) empty / zero-total → no NaN ─────────────────────────────────────────
console.log("\n[d] empty + zero total");
{
  const empty = diffHoldingsAgainstBook([], new Map(), BOOK);
  assert(empty.total_value_usd === 0, "empty holdings → total 0");
  assert(
    empty.iof_only.length === BOOK.length && empty.overlap.length === 0,
    "empty holdings → whole book is iof_only",
  );
  // Holding present but zero shares → zero total, weight 0 (not NaN).
  const zero = diffHoldingsAgainstBook(
    [{ ticker: "NVDA", shares: 0 }],
    new Map([["NVDA", 100]]),
    BOOK,
  );
  const nvda = zero.overlap.find((o) => o.ticker === "NVDA")!;
  assert(nvda.your_weight_pct === 0, "zero total → weight 0, not NaN");
}

// ── (e) duplicate ticker accumulates ────────────────────────────────────────
console.log("\n[e] duplicate ticker");
{
  const r = diffHoldingsAgainstBook(
    [
      { ticker: "NVDA", shares: 1 },
      { ticker: "NVDA", shares: 1 },
    ],
    new Map([["NVDA", 100]]),
    BOOK,
  );
  assert(r.total_value_usd === 200, "same ticker twice accumulates value");
}

// ── (f) toYahooSymbol remap ─────────────────────────────────────────────────
console.log("\n[f] ticker remap");
{
  assert(toYahooSymbol("BTCUSD") === "BTC-USD", "BTCUSD → BTC-USD");
  assert(toYahooSymbol("ethusd") === "ETH-USD", "lowercase ethusd → ETH-USD");
  assert(toYahooSymbol("NVDA") === "NVDA", "equity ticker passes through");
}

console.log("\n" + "─".repeat(50));
if (failures === 0) {
  console.log("All assertions passed.");
} else {
  console.error(`${failures} assertion(s) FAILED.`);
}
process.exit(failures > 0 ? 1 : 0);
