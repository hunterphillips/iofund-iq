import { getIofBook } from "@/lib/portfolio/iof-book";
import { PositionsTable } from "./PositionsTable";
import { PortfolioPageContext } from "./PortfolioPageContext";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a trade date as a big serif display date, e.g. "Jun 9" */
function formatTradeDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Action → label + color class */
function actionChip(action: string): { label: string; cls: string } {
  const upper = action.toUpperCase();
  if (upper.startsWith("BUY")) return { label: action, cls: "chip-buy" };
  if (upper.startsWith("SELL")) return { label: action, cls: "chip-sell" };
  if (upper.startsWith("HEDGE")) return { label: action, cls: "chip-hedge" };
  if (upper.startsWith("COVER")) return { label: action, cls: "chip-cover" };
  return { label: action, cls: "chip-other" };
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
  const { positions, trades, stats } = await getIofBook();

  const {
    positionsHeld,
    topThemeName,
    topThemeWeight,
    activeThemes,
    tradesLast30d,
  } = stats;

  // Build the intro copy from real data.
  const headlineCount =
    positionsHeld === 1
      ? "One name"
      : positionsHeld < 20
        ? numberWord(positionsHeld) + " names"
        : `${positionsHeld} names`;

  const themesPhrase =
    activeThemes === 1
      ? "one theme"
      : activeThemes < 10
        ? numberWord(activeThemes) + " themes"
        : `${activeThemes} themes`;

  // Top-theme intro phrasing
  const topThemeIntro =
    topThemeName && topThemeWeight
      ? `${topThemeName} leads at ${topThemeWeight.toFixed(0)}% of book weight`
      : "across five AI infrastructure themes";

  const held = positions;
  const heldTickers = held.map((p) => p.ticker);

  return (
    <>
      <PortfolioPageContext tickers={heldTickers} />

      <div className="max-w-[1100px] mx-auto px-8 py-12">
        {/* ------------------------------------------------------------------ */}
        {/* 1 — Editorial header                                                */}
        {/* ------------------------------------------------------------------ */}
        <header className="mb-12 border-b border-border pb-10">
          <div className="text-xs uppercase tracking-[0.18em] mb-4 text-orange">
            {todayLabel()} · I/O Fund book
          </div>
          <h1 className="font-serif text-[2.75rem] leading-[1.1] tracking-tight text-cream mb-5 max-w-[34rem]">
            {headlineCount}, {themesPhrase}, one book.
          </h1>
          <p className="text-muted text-sm leading-relaxed max-w-[42rem]">
            {topThemeIntro}. The table below reflects I/O Fund&apos;s publicly
            disclosed positions as of the last recorded trade, with baseline
            weights from the most recent portfolio snapshot. Recent move
            history scrolls below the book.
          </p>
        </header>

        {/* ------------------------------------------------------------------ */}
        {/* 2 — Stat callouts                                                   */}
        {/* ------------------------------------------------------------------ */}
        <section
          className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border mb-14 border border-border rounded-lg overflow-hidden"
          aria-label="Portfolio statistics"
        >
          <StatCallout
            value={String(positionsHeld)}
            label="Positions held"
          />
          <StatCallout
            value={
              topThemeWeight !== null ? `${topThemeWeight.toFixed(0)}%` : "—"
            }
            label={topThemeName ? `Top theme · ${topThemeName}` : "Top theme"}
          />
          <StatCallout
            value={String(activeThemes)}
            label="Active themes"
          />
          <StatCallout
            value={String(tradesLast30d)}
            label="Trades · last 30d"
          />
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* 3 — "01 — The book" sortable positions table                        */}
        {/* ------------------------------------------------------------------ */}
        <section className="mb-16">
          <SectionHeader index="01" title="The book" />
          <PositionsTable rows={held} />
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* 4 — "02 — Recent moves" narrative rows                              */}
        {/* ------------------------------------------------------------------ */}
        <section>
          <SectionHeader index="02" title="Recent moves" />
          {trades.length === 0 ? (
            <p className="text-muted-deep text-sm">
              No moves in the last 30 days.
            </p>
          ) : (
            <ol className="recent-moves-list">
              {trades.map((t) => {
                const chip = actionChip(t.action);
                const price = t.price
                  ? `$${parseFloat(t.price).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : null;
                return (
                  <li key={t.id} className="recent-move-row">
                    <span className="move-date font-serif">
                      {formatTradeDate(t.tradeDate)}
                    </span>
                    <span className="move-ticker">{t.ticker}</span>
                    <span className={`move-chip ${chip.cls}`}>
                      {chip.label}
                    </span>
                    {price && <span className="move-price">{price}</span>}
                    {t.note && <span className="move-note">{t.note}</span>}
                    {t.analyst && (
                      <span className="move-analyst">— {t.analyst}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCallout({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-surface px-6 py-7 flex flex-col gap-1.5">
      <span className="font-serif text-4xl tabular-nums text-cream leading-none">
        {value}
      </span>
      <span className="text-[0.7rem] uppercase tracking-[0.12em] text-muted-deep leading-snug">
        {label}
      </span>
    </div>
  );
}

function SectionHeader({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-6 border-b border-border pb-3">
      <span className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-deep font-mono">
        {index}
      </span>
      <h2 className="font-serif text-xl text-cream tracking-tight">{title}</h2>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility: small integers to words
// ---------------------------------------------------------------------------

const WORDS = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
];

function numberWord(n: number): string {
  if (n >= 1 && n < WORDS.length) {
    return WORDS[n].charAt(0).toUpperCase() + WORDS[n].slice(1);
  }
  return String(n);
}
