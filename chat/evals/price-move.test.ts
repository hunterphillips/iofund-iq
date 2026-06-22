/**
 * Pure unit tests for the position price-move derivation. No DB, no network.
 *
 * Run:  pnpm test:price-move
 * Or:   pnpm exec tsx evals/price-move.test.ts
 *
 * derivePriceMove turns a ticker's trade timeline into a caveated entry→latest
 * "price move" — first-known *priced* trade to last-known *priced* trade. It is
 * NOT a realized return (we have no share counts / cost basis); the UI labels it
 * accordingly. The function returns null whenever a move can't honestly be drawn.
 */

import { derivePriceMove } from "@/lib/portfolio/price-move";

let failures = 0;
function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures++;
  }
}

// Terse trade builder — only the fields derivePriceMove reads.
const t = (tradeDate: string, price: string | null) => ({ tradeDate, price });

console.log("\nprice-move unit tests");
console.log("─".repeat(50));

// ── null cases (no honest move) ──────────────────────────────────────────────
console.log("\n[a] returns null when no move is derivable");
{
  assert(derivePriceMove([]) === null, "empty timeline → null");
  assert(
    derivePriceMove([t("2026-01-01", null), t("2026-02-01", null)]) === null,
    "no priced trades → null",
  );
  assert(
    derivePriceMove([t("2026-01-01", "100.00")]) === null,
    "single priced trade → null",
  );
  assert(
    derivePriceMove([
      t("2026-01-01", "100.00"),
      t("2026-01-01", "120.00"),
    ]) === null,
    "all prices on the same date → null",
  );
  assert(
    derivePriceMove([t("2026-01-01", "0"), t("2026-02-01", "50.00")]) === null,
    "non-positive first price → null (no valid base)",
  );
}

// ── derivation ───────────────────────────────────────────────────────────────
console.log("\n[b] derives first→last priced move");
{
  const m = derivePriceMove([
    t("2026-01-01", "100.00"),
    t("2026-03-01", "150.00"),
  ]);
  assert(m !== null, "two priced trades, different dates → non-null");
  assert(m?.firstEntryPrice === 100, "firstEntryPrice = 100");
  assert(m?.firstEntryDate === "2026-01-01", "firstEntryDate = earliest");
  assert(m?.lastPrice === 150, "lastPrice = 150");
  assert(m?.lastDate === "2026-03-01", "lastDate = latest");
  assert(Math.abs((m?.pctMove ?? 0) - 50) < 1e-9, "pctMove = +50%");
}

console.log("\n[c] negative move");
{
  const m = derivePriceMove([
    t("2026-01-01", "200.00"),
    t("2026-02-01", "150.00"),
  ]);
  assert(Math.abs((m?.pctMove ?? 0) - -25) < 1e-9, "200→150 = -25%");
}

console.log("\n[d] flat move is still rendered (0%, not null)");
{
  const m = derivePriceMove([
    t("2026-01-01", "100.00"),
    t("2026-02-01", "100.00"),
  ]);
  assert(m !== null, "equal entry/last but different dates → non-null");
  assert(m?.pctMove === 0, "pctMove = 0%");
}

console.log("\n[e] ignores null-priced trades between the ends");
{
  const m = derivePriceMove([
    t("2026-01-01", "100.00"),
    t("2026-02-01", null), // a trim with no recorded price
    t("2026-03-01", "180.00"),
  ]);
  assert(m?.firstEntryPrice === 100, "first priced = 100 (skips the null)");
  assert(m?.lastPrice === 180, "last priced = 180 (skips the null)");
  assert(Math.abs((m?.pctMove ?? 0) - 80) < 1e-9, "pctMove = +80%");
}

console.log("\n[f] does not assume input is date-sorted");
{
  // Newest-first order (how recent-moves lists arrive) must still resolve the
  // earliest priced trade as the entry and the latest as the last.
  const m = derivePriceMove([
    t("2026-03-01", "150.00"),
    t("2026-01-01", "100.00"),
  ]);
  assert(m?.firstEntryPrice === 100, "earliest-by-date is the entry");
  assert(m?.lastPrice === 150, "latest-by-date is the last");
  assert(Math.abs((m?.pctMove ?? 0) - 50) < 1e-9, "pctMove = +50% regardless of input order");
}

console.log("─".repeat(50));
if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll price-move tests passed.\n");
