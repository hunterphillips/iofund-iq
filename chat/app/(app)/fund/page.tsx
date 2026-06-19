import Link from "next/link";
import { listDigests, readDigest } from "@/lib/fund/digests";
import {
  getStrategyPullQuote,
  getStrategyHeadingChips,
  getThesisLastModified,
  getThesisThemeChips,
} from "@/lib/fund/docs";
import { getIofBook } from "@/lib/portfolio/iof-book";
import { categoryColorVar } from "@/lib/portfolio/categories";
import { MarkdownBody } from "@/components/markdown-body";
import { Engraving, RuleOrnament } from "@/components/engraving";

export const dynamic = "force-dynamic";

/** "2026-05-22" → "May 22, 2026" */
function formatLongDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** "2026-05-20" → "May 20" */
function formatShortDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function moveTone(action: string): string {
  const u = action.toUpperCase();
  if (u.startsWith("BUY")) return "text-cat-energy";
  if (u.startsWith("SELL")) return "text-cat-memory";
  return "text-gold";
}

export default async function FundPage() {
  const digests = listDigests(); // sorted newest first
  const newest = digests[0] ? readDigest(digests[0].date) : null;
  const pastDigests = digests.slice(1);

  const { stats, trades } = await getIofBook();
  const recentMoves = trades.slice(0, 3);

  const strategyPullQuote = getStrategyPullQuote();
  const strategyChips = getStrategyHeadingChips();
  const thesisLastModified = getThesisLastModified();
  const thesisChips = getThesisThemeChips();

  return (
    <div className="max-w-[1180px] mx-auto px-8 pb-32">
      {/* ── Page header + KPIs — a tall hourglass runs down the right edge and
          tucks behind the cards (z-0), giving the masthead depth. `isolate`
          keeps its overflow from painting over the digest section below. ── */}
      <div className="relative isolate">
        <Engraving
          name="peer-review"
          className="hidden md:block absolute right-0 top-0 w-[440px] lg:w-[520px] h-auto opacity-[0.14] [[data-theme=dark]_&]:opacity-[0.6] z-0"
        />
        <div className="relative z-10 pt-16 pb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-orange">
            Fund Overview
            {newest ? ` · Week of ${formatLongDate(newest.date)}` : ""}
          </div>
          <h1 className="font-serif font-semibold text-5xl sm:text-6xl lg:text-7xl leading-[0.98] tracking-[-0.025em] text-cream mt-3.5">
            The week
            <br />
            in review.
          </h1>
        </div>

        {/* ── KPI dashboard ── */}
        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-[18px]">
        <KpiCard
          href="/portfolio"
          dotColor={categoryColorVar(stats.topThemeName)}
          label="Top portfolio theme"
          value={stats.topThemeWeight != null ? `${Math.round(stats.topThemeWeight)}%` : "—"}
          sub={stats.topThemeName ? stats.topThemeName : "—"}
        />
        <KpiCard
          href="/portfolio"
          dotColor="var(--color-orange)"
          label="New trades"
          value={newest ? String(newest.newTradesCount) : "0"}
          sub={newest ? "Recorded this week" : "No digest yet"}
        />
        <KpiCard
          href="/articles"
          dotColor="var(--color-gold)"
          label="New articles"
          value={newest ? String(newest.newArticlesCount) : "0"}
          sub={newest ? "Distilled this week" : "No digest yet"}
        />
        <KpiCard
          href="/portfolio"
          dotColor="var(--color-cat-energy)"
          label="Positions held"
          value={String(stats.positionsHeld)}
          sub={`Across ${stats.activeThemes} active themes`}
        />
        </div>
      </div>

      {/* ── Digest hero — summary + highlights + full digest behind disclosure ── */}
      {newest && (
        <section className="mt-16">
          <div className="flex items-baseline justify-between mb-5">
            <div className="flex items-baseline gap-3">
              <span className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-deep font-mono">
                01
              </span>
              <h2 className="font-serif text-2xl font-semibold tracking-tight text-cream">
                This week&apos;s digest
              </h2>
            </div>
            <span className="text-[13px] text-muted font-mono tabular-nums">
              {formatLongDate(newest.date)}
            </span>
          </div>

          <div className="border border-border rounded-2xl bg-surface p-8 md:p-11 grid md:grid-cols-[1.4fr_1fr] gap-10 items-start">
            <div>
              {newest.summary && (
                <h3 className="font-serif text-2xl md:text-3xl font-medium leading-[1.14] tracking-[-0.015em] text-cream">
                  {newest.summary}
                </h3>
              )}
              <details className="group mt-6 border-t border-border pt-5">
                <summary className="list-none cursor-pointer text-sm font-semibold text-orange inline-flex items-center gap-2 select-none">
                  <span className="transition-transform group-open:rotate-90">›</span>
                  Read the full digest
                </summary>
                <div className="mt-5 reading-prose">
                  <MarkdownBody>{newest.body}</MarkdownBody>
                </div>
              </details>
            </div>

            {newest.highlights.length > 0 && (
              <ul className="flex flex-col gap-3.5">
                {newest.highlights.map((h) => (
                  <li key={h.lead} className="flex gap-3 text-[15px] leading-relaxed text-cream">
                    <span className="flex-none w-1.5 h-1.5 rounded-full bg-orange mt-2" />
                    <span>
                      <b className="text-gold font-semibold">{h.lead}.</b>{" "}
                      {h.rest}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <RuleOrnament className="mt-16" />

      {/* ── Strategy + Thesis cards ── */}
      <section className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-[18px]">
        <DocCard
          href="/fund/strategy"
          eyebrow="The framework"
          title="Strategy"
          blurb={strategyPullQuote || "Alert decoding, position sizing, and the hedging framework that governs every move."}
          chips={strategyChips}
        />
        <DocCard
          href="/fund/thesis"
          eyebrow={thesisLastModified ? `Updated ${formatShortDate(thesisLastModified)}` : "The conviction"}
          title="Thesis"
          blurb="Per-ticker conviction history and the theme evolution behind the current portfolio."
          chips={thesisChips}
        />
      </section>

      {/* ── Recent moves preview ── */}
      {recentMoves.length > 0 && (
        <section className="mt-16">
          <div className="flex items-baseline justify-between mb-5">
            <div className="flex items-baseline gap-3">
              <span className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-deep font-mono">
                02
              </span>
              <h2 className="font-serif text-2xl font-semibold tracking-tight text-cream">
                Recent moves
              </h2>
            </div>
            <Link href="/portfolio" className="text-sm font-semibold text-orange hover:underline">
              Open Portfolio →
            </Link>
          </div>
          <div className="border border-border rounded-2xl bg-surface px-6">
            {recentMoves.map((t, i) => (
              <div
                key={t.id}
                className={
                  "grid grid-cols-[88px_64px_1fr_auto] gap-5 items-center py-4 " +
                  (i > 0 ? "border-t border-border" : "")
                }
              >
                <span className="font-serif text-[15px] text-muted">
                  {formatShortDate(t.tradeDate)}
                </span>
                <span className="font-bold text-[15px] tracking-wide">{t.ticker}</span>
                <span className="text-sm text-muted truncate">
                  <span className={`font-semibold uppercase text-[11px] tracking-wide mr-2 ${moveTone(t.action)}`}>
                    {t.action}
                  </span>
                  {t.note}
                </span>
                <span className="font-mono text-sm tabular-nums text-cream">
                  {t.price ? `$${parseFloat(t.price).toFixed(2)}` : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Past digests ── */}
      {pastDigests.length > 0 && (
        <section className="mt-16">
          <div className="flex items-baseline gap-3 mb-5">
            <span className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-deep font-mono">
              03
            </span>
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-cream">
              Past digests
            </h2>
          </div>
          <div className="border border-border rounded-2xl bg-surface px-6">
            {pastDigests.map((d, i) => (
              <Link
                key={d.slug}
                href={`/fund/digests/${d.slug}`}
                className={
                  "group grid grid-cols-[88px_1fr_auto] gap-5 items-center py-4 " +
                  (i > 0 ? "border-t border-border" : "")
                }
              >
                <span className="font-serif text-[15px] text-muted">
                  {formatShortDate(d.date)}
                </span>
                <span className="text-sm text-muted group-hover:text-cream transition-colors truncate">
                  {d.summary}
                </span>
                <span className="flex flex-wrap gap-1.5 justify-end">
                  {d.tickers.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-border text-muted font-mono"
                    >
                      {t}
                    </span>
                  ))}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  href,
  dotColor,
  label,
  value,
  sub,
}: {
  href: string;
  dotColor: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden border border-border rounded-2xl bg-surface px-[22px] pt-[22px] pb-5 hover:border-muted-deep transition-colors"
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide font-semibold text-muted">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: dotColor }} />
        {label}
      </div>
      <div className="font-serif font-semibold text-[42px] leading-none tracking-[-0.02em] text-cream mt-4 mb-1.5 tabular-nums">
        {value}
      </div>
      <div className="text-[13px] text-muted-deep">{sub}</div>
      <span className="absolute right-[18px] top-5 text-muted-deep group-hover:text-orange group-hover:translate-x-0.5 transition-all">
        →
      </span>
    </Link>
  );
}

function DocCard({
  href,
  eyebrow,
  title,
  blurb,
  chips,
}: {
  href: string;
  eyebrow: string;
  title: string;
  blurb: string;
  chips: string[];
}) {
  return (
    <Link
      href={href}
      className="group border border-border rounded-2xl bg-surface p-7 flex flex-col gap-3.5 hover:border-muted-deep hover:-translate-y-0.5 transition-all"
    >
      <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-deep">
        {eyebrow}
      </div>
      <h3 className="font-serif text-2xl font-semibold text-cream">{title}</h3>
      <p className="text-sm text-muted leading-relaxed flex-1 line-clamp-3">{blurb}</p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-border text-muted bg-surface-2/60"
          >
            {chip}
          </span>
        ))}
      </div>
      <span className="mt-1 w-[34px] h-[34px] rounded-full border border-border grid place-items-center text-cream group-hover:bg-orange group-hover:border-orange group-hover:text-white transition-colors">
        →
      </span>
    </Link>
  );
}
