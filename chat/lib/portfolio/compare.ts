/**
 * Portfolio gap — I/O shell. Resolves live prices (Yahoo) + IOF's held book
 * (Postgres), then delegates the arithmetic to the pure `diffHoldingsAgainstBook`
 * in gap-math.ts (which has no DB import and is unit-tested in evals/gap.test.ts).
 *
 * Used by the `analyze_portfolio_gap` chat tool across both its input paths:
 * holdings read from an attached image, or holdings saved in `user_holdings`.
 *
 * IOF's weight is the baseline % snapshot (we don't have IOF share counts, so it
 * can't be live-recomputed); the user's weight is live (shares × current price).
 */

import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { fetchQuotes } from "./prices";
import type { Holding } from "./extract";
import {
  diffHoldingsAgainstBook,
  type GapResult,
  type IofBookEntry,
} from "./gap-math";

export type { GapResult, IofBookEntry } from "./gap-math";

export async function computePortfolioGap(
  holdings: Holding[],
): Promise<GapResult> {
  const { prices } = await fetchQuotes(holdings.map((h) => h.ticker));

  const iofRows = await db
    .select({
      ticker: tables.positions.ticker,
      company: tables.positions.company,
      category: tables.positions.category,
      iofWeight: tables.positions.baselineWeightPct,
    })
    .from(tables.positions)
    .where(eq(tables.positions.status, "held"));

  const iofBook: IofBookEntry[] = iofRows.map((r) => ({
    ticker: r.ticker,
    company: r.company,
    category: r.category,
    iofWeight: Number(r.iofWeight),
  }));

  return diffHoldingsAgainstBook(holdings, prices, iofBook);
}
