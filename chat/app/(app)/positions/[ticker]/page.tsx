import { notFound } from "next/navigation";
import Link from "next/link";
import { getPositionDetail } from "@/lib/portfolio/position-detail";
import { categoryColorVar, categoryLabel } from "@/lib/portfolio/categories";
import { MoveDescription } from "@/components/move-description";
import { PositionClient } from "./PositionClient";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null, withYear = true): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function formatPrice(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PositionPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const detail = await getPositionDetail(ticker);
  if (!detail) notFound();

  const { position, trades, priceMove, relatedArticles } = detail;
  const symbol = position.ticker;
  const held = position.status === "held";
  const weight = position.baselineWeightPct
    ? parseFloat(position.baselineWeightPct)
    : null;
  const moveUp = priceMove ? priceMove.pctMove >= 0 : false;

  return (
    <div className="relative max-w-[860px] mx-auto px-8 pb-32 overflow-x-clip">
      {/* ── Header ── */}
      <header className="pt-16 pb-10">
        <Link
          href="/portfolio"
          className="text-[12px] uppercase tracking-[0.16em] text-muted-deep hover:text-cream transition-colors"
        >
          ← Portfolio
        </Link>

        <div className="flex flex-wrap items-end gap-x-5 gap-y-3 mt-5">
          <h1 className="font-mono font-semibold text-5xl sm:text-6xl tracking-tight text-cream">
            {symbol}
          </h1>
          <span
            className={
              "mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full border " +
              (held
                ? "border-cat-energy/40 text-cat-energy"
                : "border-border text-muted-deep")
            }
          >
            {held ? "Held" : "Closed"}
          </span>
        </div>

        {position.company && (
          <div className="font-serif text-2xl text-muted mt-2">
            {position.company}
          </div>
        )}

        {/* Quick facts */}
        <div className="flex flex-wrap gap-x-10 gap-y-4 mt-8">
          {position.category && (
            <Fact label="Trend">
              <span className="inline-flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: categoryColorVar(position.category) }}
                />
                {categoryLabel(position.category)}
              </span>
            </Fact>
          )}
          <Fact label="Weight">
            {weight !== null && weight > 0 ? (
              <span className="font-mono tabular-nums">{weight.toFixed(1)}%</span>
            ) : (
              <span className="text-muted-deep">—</span>
            )}
          </Fact>
          <Fact label="First entry">
            <span className="font-serif">
              {formatDate(position.firstEntryDate)}
            </span>
          </Fact>
          <div className="ml-auto self-end">
            <PositionClient ticker={symbol} company={position.company} />
          </div>
        </div>
      </header>

      {/* ── Price move (caveated) ── */}
      {priceMove && (
        <Section index="01" title="Price move">
          <div className="border border-border rounded-2xl bg-surface/40 backdrop-blur-lg p-6">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span
                className={
                  "font-serif text-4xl tabular-nums " +
                  (moveUp ? "text-cat-energy" : "text-cat-memory")
                }
              >
                {formatPct(priceMove.pctMove)}
              </span>
              <span className="text-muted text-[15px]">
                {formatPrice(priceMove.firstEntryPrice)} (
                {formatDate(priceMove.firstEntryDate)}) →{" "}
                {formatPrice(priceMove.lastPrice)} (
                {formatDate(priceMove.lastDate)})
              </span>
            </div>
            <p className="text-[12.5px] text-muted-deep mt-3 max-w-[44rem] leading-relaxed">
              Move in the recorded trade price between the first and last logged
              trades — a price move, not a return estimate. Share counts and cost
              basis aren&rsquo;t tracked, so this doesn&rsquo;t reflect realized
              gains or position sizing.
            </p>
          </div>
        </Section>
      )}

      {/* ── Trade timeline ── */}
      <Section index="02" title="Trade timeline">
        {trades.length === 0 ? (
          <p className="text-muted-deep text-sm">No trades logged for {symbol}.</p>
        ) : (
          <div className="border border-border rounded-2xl bg-surface/40 backdrop-blur-lg px-6">
            {trades.map((t, i) => {
              const price = t.price ? formatPrice(parseFloat(t.price)) : null;
              return (
                <div
                  key={t.id}
                  className={
                    "grid grid-cols-[88px_1fr_auto] gap-4 sm:gap-6 items-center py-4 " +
                    (i > 0 ? "border-t border-border" : "")
                  }
                >
                  <span className="font-serif text-[15px] text-muted">
                    {formatDate(t.tradeDate)}
                  </span>
                  <div className="min-w-0">
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
      </Section>

      {/* ── Related articles ── */}
      <Section index="03" title="Related coverage">
        {relatedArticles.length === 0 ? (
          <p className="text-muted-deep text-sm">
            No distilled articles tagged {symbol} yet.
          </p>
        ) : (
          <div className="border border-border rounded-2xl bg-surface/40 backdrop-blur-lg px-6">
            {relatedArticles.map((a, i) => (
              <Link
                key={a.id}
                href={`/articles/${a.slug}`}
                className={
                  "flex items-baseline justify-between gap-4 py-4 group " +
                  (i > 0 ? "border-t border-border" : "")
                }
              >
                <span className="text-cream group-hover:text-orange transition-colors leading-snug">
                  {a.title}
                </span>
                <span className="font-serif text-[13px] text-muted-deep shrink-0">
                  {formatDate(a.pubDate)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-deep mb-1.5">
        {label}
      </div>
      <div className="text-[15px] text-cream">{children}</div>
    </div>
  );
}

function Section({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <div className="flex items-baseline gap-3 mb-6">
        <span className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-deep font-mono">
          {index}
        </span>
        <h2 className="font-serif text-2xl text-cream tracking-tight">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
