/**
 * Pure price-move derivation for a position's trade timeline.
 *
 * IMPORTANT: this is NOT a realized return. `public.trades` records a per-trade
 * `price` (often null) but no share counts and no cost basis, so a true return
 * isn't derivable. What we *can* honestly show is the move in the recorded trade
 * price from the first-known priced trade to the last-known priced one — and the
 * UI labels it as a price move, not a return. We return null whenever even that
 * can't be drawn (no prices, a single priced trade, or all prices on one date).
 *
 * Kept dependency-free (no DB, no Yahoo) so it unit-tests in isolation — same
 * pure-core / I/O-shell split as gap-math.ts vs compare.ts.
 */

export interface PriceMove {
  firstEntryPrice: number;
  firstEntryDate: string;
  lastPrice: number;
  lastDate: string;
  /** Percentage change from firstEntryPrice to lastPrice. */
  pctMove: number;
}

interface PricedTrade {
  tradeDate: string;
  price: string | null;
}

export function derivePriceMove(trades: PricedTrade[]): PriceMove | null {
  // Keep only trades with a positive, parseable price, then order by date so we
  // don't assume the caller's ordering (recent-moves lists arrive newest-first).
  const priced = trades
    .map((t) => ({ date: t.tradeDate, price: parseFloat(t.price ?? "") }))
    .filter((t) => Number.isFinite(t.price) && t.price > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (priced.length < 2) return null;

  const first = priced[0];
  const last = priced[priced.length - 1];

  // No span of time → no move to show (covers the single-date case).
  if (first.date === last.date) return null;

  return {
    firstEntryPrice: first.price,
    firstEntryDate: first.date,
    lastPrice: last.price,
    lastDate: last.date,
    pctMove: ((last.price - first.price) / first.price) * 100,
  };
}
