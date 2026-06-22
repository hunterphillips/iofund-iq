import { getIofBook } from '@/lib/portfolio/iof-book';
import { PortfolioContent } from './PortfolioContent';
import { PortfolioPageContext } from './PortfolioPageContext';
import { Engraving } from '@/components/engraving';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Today formatted as "June 13, 2026" */
function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PortfolioPage() {
  // Fetch up to 6 months of trades so the Recent-moves range selector
  // (30d / 3m / 6m) can filter client-side without a refetch.
  const { positions, trades, categoryBreakdown } = await getIofBook(180);

  const heldTickers = positions.map((p) => p.ticker);
  const asOf = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PortfolioPageContext tickers={heldTickers} />

      <div className="relative max-w-[1180px] mx-auto px-8 pb-32 overflow-x-clip">
        {/* Colosseum — large engraving that bleeds from the masthead down
            *behind* the holdings card (-z-10). The frosted-glass holdings card +
            view-cycler render on top and let it show through, blurred, so the
            top layer's readability stays priority. pointer-events-none. */}
        <Engraving
          name="colosseum"
          className="absolute right-0 top-[-80px] w-[520px] lg:w-[600px] h-auto opacity-[0.18] [[data-theme=dark]_&]:opacity-[0.12] -z-10 pointer-events-none"
        />

        {/* ── Editorial header ── */}
        <header className="relative z-20 pt-16 pb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-orange">
            I/O Fund holdings · {todayLabel()}
          </div>
          <h1 className="font-serif font-semibold text-5xl sm:text-6xl lg:text-7xl leading-[0.98] tracking-[-0.025em] text-cream mt-3.5 max-w-[34rem]">
            Portfolio
          </h1>
        </header>

        {/* ── Holdings (01) + Recent moves (02) — share the category filter,
            so both live in one client surface. ── */}
        <PortfolioContent
          positions={positions}
          breakdown={categoryBreakdown}
          trades={trades}
          asOf={asOf}
        />
      </div>
    </>
  );
}
