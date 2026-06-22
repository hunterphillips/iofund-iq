"use client";

/**
 * PortfolioContent — client shell that owns the category filter shared across
 * the Holdings views (Table / Pie / Trends) and the Recent moves list. Clicking
 * a category in the Pie or Trends view sets the filter; it scopes the table, is
 * shown as a removable pill next to "Holdings", and filters Recent moves below.
 *
 * Trades carry no category of their own, so we map each trade's ticker to the
 * held book's category to scope the moves list. A move on a ticker that is no
 * longer held (closed position) won't match any held category, so it drops out
 * while a filter is active — which is the intended "show me this trend" behavior.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  IofPosition,
  IofTrade,
  CategoryWeight,
} from "@/lib/portfolio/iof-book";
import { categoryLabel } from "@/lib/portfolio/categories";
import { MoveDescription } from "@/components/move-description";
import { PortfolioBook } from "./PortfolioBook";

/** Format a trade date as a short serif display date, e.g. "Jun 9" */
function formatTradeDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const RANGES: { label: string; days: number; phrase: string }[] = [
  { label: "30D", days: 30, phrase: "30 days" },
  { label: "3M", days: 90, phrase: "3 months" },
  { label: "6M", days: 180, phrase: "6 months" },
];

/** ISO date `n` days before `isoDate` (stable across SSR/hydration). */
function daysBefore(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function PortfolioContent({
  positions,
  breakdown,
  trades,
  asOf,
}: {
  positions: IofPosition[];
  breakdown: CategoryWeight[];
  trades: IofTrade[];
  asOf: string;
}) {
  // The selected canonical category (e.g. "AI Networking"), or null for "all".
  const [selected, setSelected] = useState<string | null>(null);
  // Recent-moves lookback window, in days. 30d is the default.
  const [rangeDays, setRangeDays] = useState(30);

  const tickerCategory = useMemo(
    () => new Map(positions.map((p) => [p.ticker, p.category])),
    [positions],
  );

  const rangePhrase =
    RANGES.find((r) => r.days === rangeDays)?.phrase ?? `${rangeDays} days`;
  const cutoff = daysBefore(asOf, rangeDays);

  const visibleTrades = trades.filter(
    (t) =>
      t.tradeDate >= cutoff &&
      (!selected || tickerCategory.get(t.ticker) === selected),
  );

  return (
    <>
      {/* ── 01 — Holdings (Table / Pie / Trends) ── */}
      <section className="mt-4">
        <PortfolioBook
          rows={positions}
          breakdown={breakdown}
          selected={selected}
          onSelect={setSelected}
        />
      </section>

      {/* ── 02 — Recent moves ── */}
      <section className="mt-16">
        <div className="flex items-baseline justify-between mb-6">
          <div className="flex items-baseline gap-3">
            <span className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-deep font-mono">
              02
            </span>
            <h2 className="font-serif text-2xl text-cream tracking-tight">
              Recent moves
            </h2>
          </div>
          <div
            className="inline-flex bg-surface-2/60 backdrop-blur-md border border-border rounded-[10px] p-1 gap-0.5"
            role="group"
            aria-label="Recent moves range"
          >
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                aria-pressed={rangeDays === r.days}
                onClick={() => setRangeDays(r.days)}
                className={
                  "text-[13px] font-semibold px-3.5 py-1 rounded-[7px] transition-colors " +
                  (rangeDays === r.days
                    ? "bg-orange text-white"
                    : "text-muted hover:text-cream")
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {visibleTrades.length === 0 ? (
          <p className="text-muted-deep text-sm">
            {selected
              ? `No ${categoryLabel(selected)} moves in the last ${rangePhrase}.`
              : `No moves in the last ${rangePhrase}.`}
          </p>
        ) : (
          <div className="border border-border rounded-2xl bg-surface/65 backdrop-blur-lg px-6">
            {visibleTrades.map((t, i) => {
              const price = t.price
                ? `$${parseFloat(t.price).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : null;
              return (
                <div
                  key={t.id}
                  className={
                    "grid grid-cols-[auto_auto_1fr_auto] gap-3 sm:grid-cols-[88px_64px_1fr_auto] sm:gap-5 items-center py-4 " +
                    (i > 0 ? "border-t border-border" : "")
                  }
                >
                  <span className="font-serif text-[15px] text-muted">
                    {formatTradeDate(t.tradeDate)}
                  </span>
                  <Link
                    href={`/positions/${t.ticker}`}
                    className="font-bold text-[15px] tracking-wide hover:text-orange transition-colors"
                  >
                    {t.ticker}
                  </Link>
                  <div className="min-w-0 truncate">
                    <MoveDescription action={t.action} note={t.note} />
                  </div>
                  <span className="font-mono text-sm tabular-nums text-cream">
                    {price ?? ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
