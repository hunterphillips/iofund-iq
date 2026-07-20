import { Engraving } from "@/components/engraving";
import { getDemoBook } from "@/lib/demo/book";
import { PortfolioContent } from "../PortfolioContent";
import { PortfolioPageContext } from "../PortfolioPageContext";

export const dynamic = "force-dynamic";

function dateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function DemoPortfolioPage() {
  const asOf = new Date().toISOString().slice(0, 10);
  const { positions, trades, categoryBreakdown } = getDemoBook(asOf);
  const demoTickers = positions.map((position) => position.ticker);

  return (
    <>
      <PortfolioPageContext tickers={demoTickers} />

      <div className="relative max-w-[1180px] mx-auto px-8 pb-32 overflow-x-clip">
        <Engraving
          name="colosseum"
          className="absolute right-0 top-[-80px] w-[520px] lg:w-[600px] h-auto opacity-[0.18] [[data-theme=dark]_&]:opacity-[0.12] -z-10 pointer-events-none"
        />

        <header className="relative z-20 pt-16 pb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-orange">
            I/O Fund holdings · {dateLabel(asOf)}
          </div>
          <h1 className="font-serif font-semibold text-5xl sm:text-6xl lg:text-7xl leading-[0.98] tracking-[-0.025em] text-cream mt-3.5 max-w-[34rem]">
            Portfolio
          </h1>
        </header>

        <PortfolioContent
          positions={positions}
          breakdown={categoryBreakdown}
          trades={trades}
          asOf={asOf}
          gapEndpoint="/api/demo/gap"
          positionsBasePath="/positions/demo"
        />
      </div>
    </>
  );
}
