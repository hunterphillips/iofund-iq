import { getIofBook } from "@/lib/portfolio/iof-book";
import { PortfolioBook } from "./PortfolioBook";
import { PortfolioPageContext } from "./PortfolioPageContext";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a trade date as a short serif display date, e.g. "Jun 9" */
function formatTradeDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Action → tone class for the inline action label. */
function actionTone(action: string): string {
  const u = action.toUpperCase();
  if (u.startsWith("BUY")) return "text-cat-energy";
  if (u.startsWith("SELL")) return "text-cat-memory";
  if (u.startsWith("HEDGE")) return "text-gold";
  if (u.startsWith("COVER")) return "text-cat-software";
  return "text-muted";
}

/** Today formatted as "June 13, 2026" */
function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PortfolioPage() {
  const { positions, trades, stats, categoryBreakdown } = await getIofBook();
  const { topThemeName, topThemeWeight } = stats;

  const topThemeIntro =
    topThemeName != null && topThemeWeight != null
      ? `${topThemeName} leads at ${Math.round(topThemeWeight)}% of book weight`
      : "Five AI-infrastructure themes anchor the book";

  const heldTickers = positions.map((p) => p.ticker);

  return (
    <>
      <PortfolioPageContext tickers={heldTickers} />

      <div className="max-w-[1180px] mx-auto px-8 pb-32">
        {/* ── Editorial header ── */}
        <header className="pt-16 pb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-orange">
            {todayLabel()} · The IOF book
          </div>
          <h1 className="font-serif font-semibold text-5xl sm:text-6xl lg:text-7xl leading-[0.98] tracking-[-0.025em] text-cream mt-3.5 max-w-[34rem]">
            Portfolio.
          </h1>
          <p className="text-lg text-muted leading-relaxed max-w-[60ch] mt-5">
            {topThemeIntro}. Below is the current book — viewable as a table, a
            theme breakdown, or weight bars — and the moves of the last 30 days.
          </p>
        </header>

        {/* ── 01 — The book (Table / Pie / Themes) ── */}
        <section className="mt-4">
          <PortfolioBook rows={positions} breakdown={categoryBreakdown} />
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
            <span className="text-[13px] text-muted">Last 30 days</span>
          </div>

          {trades.length === 0 ? (
            <p className="text-muted-deep text-sm">No moves in the last 30 days.</p>
          ) : (
            <div className="border border-border rounded-2xl bg-surface px-6">
              {trades.map((t, i) => {
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
                      "grid grid-cols-[88px_64px_1fr_auto] gap-5 items-center py-4 " +
                      (i > 0 ? "border-t border-border" : "")
                    }
                  >
                    <span className="font-serif text-[15px] text-muted">
                      {formatTradeDate(t.tradeDate)}
                    </span>
                    <span className="font-bold text-[15px] tracking-wide">
                      {t.ticker}
                    </span>
                    <span className="text-sm text-muted truncate">
                      <span
                        className={`font-semibold uppercase text-[11px] tracking-wide mr-2 ${actionTone(t.action)}`}
                      >
                        {t.action}
                      </span>
                      {t.note}
                      {t.analyst && (
                        <span className="text-muted-deep"> — {t.analyst}</span>
                      )}
                    </span>
                    <span className="font-mono text-sm tabular-nums text-cream">
                      {price ?? ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
