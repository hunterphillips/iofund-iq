/**
 * Pure portfolio gap math — no I/O, no DB import, fully unit-testable.
 *
 * Kept separate from compare.ts (which imports the DB) so it can be tested
 * without a database connection or live network. compare.ts is the I/O shell
 * that fetches prices + the IOF book, then delegates here.
 */

/** One portfolio line: a ticker and the share count held. */
export interface Holding {
  ticker: string;
  shares: number;
}

export interface GapResult {
  /** Live total market value of the priced holdings, USD. */
  total_value_usd: number;
  /** Tickers with no live price (excluded from weights). */
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
    company: string | null;
    category: string | null;
    iof_weight_pct: number;
    your_weight_pct: number;
    delta_pct: number;
  }[];
  /** User holds, IOF doesn't — outside the fund's coverage. Weight-desc. */
  yours_only: {
    ticker: string;
    your_weight_pct: number;
  }[];
}

/** An IOF held position, normalized for the diff (weight already numeric). */
export interface IofBookEntry {
  ticker: string;
  company: string | null;
  category: string | null;
  iofWeight: number;
}

/**
 * Given the user's holdings, a live price map (UPPER-ticker → price), and IOF's
 * held book, return the buy-list (iof_only), the overlap with weight deltas, and
 * total value.
 *
 * User weights are live (shares × price), normalized across priced holdings;
 * IOF weights are the baseline snapshot. Holdings with no price are excluded
 * from weights and reported in `missing_prices`. Matching is case-insensitive.
 */
export function diffHoldingsAgainstBook(
  holdings: Holding[],
  prices: Map<string, number>,
  iofBook: IofBookEntry[],
): GapResult {
  let totalValue = 0;
  const userBook = new Map<string, { value_usd: number; weight: number }>();
  const missing_prices: string[] = [];

  for (const h of holdings) {
    const upper = h.ticker.toUpperCase();
    const price = prices.get(upper);
    if (price == null) {
      missing_prices.push(upper);
      continue;
    }
    const value = h.shares * price;
    totalValue += value;
    // Accumulate in case the same ticker appears twice.
    const existing = userBook.get(upper);
    userBook.set(upper, {
      value_usd: (existing?.value_usd ?? 0) + value,
      weight: 0,
    });
  }
  for (const v of userBook.values()) {
    v.weight = totalValue > 0 ? (v.value_usd / totalValue) * 100 : 0;
  }

  const iof_only = iofBook
    .filter((r) => !userBook.has(r.ticker.toUpperCase()))
    .map((r) => ({
      ticker: r.ticker,
      company: r.company,
      category: r.category,
      iof_weight_pct: r.iofWeight,
    }));

  const overlap = iofBook
    .filter((r) => userBook.has(r.ticker.toUpperCase()))
    .map((r) => {
      const yours = userBook.get(r.ticker.toUpperCase())!;
      return {
        ticker: r.ticker,
        company: r.company,
        category: r.category,
        iof_weight_pct: r.iofWeight,
        your_weight_pct: Math.round(yours.weight * 10) / 10,
        delta_pct: Math.round((yours.weight - r.iofWeight) * 10) / 10,
      };
    });

  const bookTickers = new Set(iofBook.map((r) => r.ticker.toUpperCase()));
  const yours_only = [...userBook.entries()]
    .filter(([ticker]) => !bookTickers.has(ticker))
    .map(([ticker, v]) => ({
      ticker,
      your_weight_pct: Math.round(v.weight * 10) / 10,
    }))
    .sort((a, b) => b.your_weight_pct - a.your_weight_pct);

  return {
    total_value_usd: Math.round(totalValue),
    missing_prices,
    iof_only,
    overlap,
    yours_only,
  };
}
