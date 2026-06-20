/**
 * Portfolio gap math, shared by the `analyze_portfolio_gap` chat tool across its
 * two input paths: holdings read from an image the user attached this turn, or
 * holdings previously saved to `user_holdings`.
 *
 * Pure data — no auth, no session. The caller resolves the holdings; this just
 * prices them live (Yahoo) and diffs against IOF's current held book. IOF's
 * weight is the baseline % snapshot (we don't have IOF share counts, so it can't
 * be live-recomputed); the user's weight is live (shares × current price).
 */

import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { fetchQuotes } from "./prices";
import type { Holding } from "./extract";

export interface GapResult {
  /** Live total market value of the priced holdings, USD. */
  total_value_usd: number;
  /** Tickers Yahoo couldn't price (excluded from weights). */
  missing_prices: string[];
  /** IOF holds, user doesn't — the buy-list signal. */
  iof_only: {
    ticker: string;
    company: string | null;
    category: string | null;
    iof_weight_pct: number;
  }[];
  /** Held by both — user weight vs IOF weight, with delta. */
  overlap: {
    ticker: string;
    iof_weight_pct: number;
    your_weight_pct: number;
    delta_pct: number;
  }[];
}

export async function computePortfolioGap(
  holdings: Holding[],
): Promise<GapResult> {
  const { prices, missing } = await fetchQuotes(holdings.map((h) => h.ticker));

  // Compute live user weights from shares × current price.
  let totalValue = 0;
  const userBook = new Map<
    string,
    { shares: number; value_usd: number; weight: number }
  >();
  for (const h of holdings) {
    const upper = h.ticker.toUpperCase();
    const price = prices.get(upper);
    if (price == null) continue;
    const value = h.shares * price;
    totalValue += value;
    userBook.set(upper, { shares: h.shares, value_usd: value, weight: 0 });
  }
  for (const v of userBook.values()) {
    v.weight = totalValue > 0 ? (v.value_usd / totalValue) * 100 : 0;
  }

  const iofRows = await db
    .select({
      ticker: tables.positions.ticker,
      company: tables.positions.company,
      category: tables.positions.category,
      iofWeight: tables.positions.baselineWeightPct,
    })
    .from(tables.positions)
    .where(eq(tables.positions.status, "held"));

  const iof_only = iofRows
    .filter((r) => !userBook.has(r.ticker.toUpperCase()))
    .map((r) => ({
      ticker: r.ticker,
      company: r.company,
      category: r.category,
      iof_weight_pct: Number(r.iofWeight),
    }));

  const overlap = iofRows
    .filter((r) => userBook.has(r.ticker.toUpperCase()))
    .map((r) => {
      const yours = userBook.get(r.ticker.toUpperCase())!;
      return {
        ticker: r.ticker,
        iof_weight_pct: Number(r.iofWeight),
        your_weight_pct: Math.round(yours.weight * 10) / 10,
        delta_pct: Math.round((yours.weight - Number(r.iofWeight)) * 10) / 10,
      };
    });

  return {
    total_value_usd: Math.round(totalValue),
    missing_prices: missing,
    iof_only,
    overlap,
  };
}
