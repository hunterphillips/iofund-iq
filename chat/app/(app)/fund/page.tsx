import Link from "next/link";
import { listDigests, readDigest } from "@/lib/fund/digests";
import {
  getStrategyPullQuote,
  getStrategyHeadingChips,
  getThesisLastModified,
  getThesisThemeChips,
} from "@/lib/fund/docs";
import { MarkdownBody } from "@/components/markdown-body";

export const dynamic = "force-dynamic";

export default async function FundPage() {
  const digests = listDigests(); // sorted newest first
  const newest = digests[0] ? readDigest(digests[0].date) : null;
  const pastDigests = digests.slice(1);

  const strategyPullQuote = getStrategyPullQuote();
  const strategyChips = getStrategyHeadingChips();
  const thesisLastModified = getThesisLastModified();
  const thesisChips = getThesisThemeChips();

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-12">
      {/* ── Page header ── */}
      <div className="mb-10">
        <div className="text-xs uppercase tracking-[0.18em] mb-3 text-orange">
          Fund
        </div>
        <h1 className="font-serif text-5xl leading-tight tracking-tight text-cream">
          Overview
        </h1>
      </div>

      {/* ── Newest digest — inline at top ── */}
      {newest && (
        <section className="mb-14">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-serif text-2xl tracking-tight text-cream">
              Latest digest
            </h2>
            <span className="text-xs text-muted tabular-nums">{newest.date}</span>
          </div>
          <div className="border border-border rounded-lg bg-surface px-8 py-8">
            <MarkdownBody>{newest.body}</MarkdownBody>
          </div>
        </section>
      )}

      {/* ── Strategy + Thesis cards ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
        {/* Strategy card */}
        <Link
          href="/fund/strategy"
          className="group block border border-border bg-surface rounded-lg p-6 hover:border-muted-deep transition-colors"
        >
          <div className="text-[0.65rem] uppercase tracking-[0.16em] text-muted mb-2">
            Strategy
          </div>
          <h3 className="font-serif text-xl leading-snug text-cream mb-3 group-hover:text-gold transition-colors">
            Alert decoding, sizing & hedging
          </h3>
          {strategyPullQuote && (
            <p className="text-sm text-muted leading-relaxed mb-4 line-clamp-3">
              {strategyPullQuote}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {strategyChips.map((chip) => (
              <span
                key={chip}
                className="text-[0.65rem] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border border-border text-muted-deep"
              >
                {chip}
              </span>
            ))}
          </div>
          <span className="text-xs text-orange group-hover:text-gold transition-colors">
            Read strategy →
          </span>
        </Link>

        {/* Thesis card */}
        <Link
          href="/fund/thesis"
          className="group block border border-border bg-surface rounded-lg p-6 hover:border-muted-deep transition-colors"
        >
          <div className="text-[0.65rem] uppercase tracking-[0.16em] text-muted mb-2">
            Thesis
          </div>
          <h3 className="font-serif text-xl leading-snug text-cream mb-3 group-hover:text-gold transition-colors">
            Conviction history & theme evolution
          </h3>
          {thesisLastModified && (
            <p className="text-xs text-muted-deep mb-3 tabular-nums">
              Last distilled: {thesisLastModified}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {thesisChips.map((chip) => (
              <span
                key={chip}
                className="text-[0.65rem] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border border-border text-muted-deep"
              >
                {chip}
              </span>
            ))}
          </div>
          <span className="text-xs text-orange group-hover:text-gold transition-colors">
            Read thesis →
          </span>
        </Link>
      </section>

      {/* ── Past digests list ── */}
      {pastDigests.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl tracking-tight text-cream mb-4">
            Past digests
          </h2>
          <div className="flex flex-col divide-y divide-border">
            {pastDigests.map((d) => (
              <Link
                key={d.slug}
                href={`/fund/digests/${d.slug}`}
                className="group flex items-start gap-6 py-4 hover:bg-surface/50 -mx-3 px-3 rounded transition-colors"
              >
                <span className="flex-none text-sm text-muted-deep tabular-nums pt-0.5 w-24">
                  {d.date}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-cream group-hover:text-gold transition-colors line-clamp-2 mb-1">
                    {d.summary}
                  </span>
                  {d.tickers.length > 0 && (
                    <span className="flex flex-wrap gap-1">
                      {d.tickers.map((t) => (
                        <span
                          key={t}
                          className="text-[0.6rem] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded border border-border text-muted-deep font-mono"
                        >
                          {t}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className="flex-none text-xs text-muted group-hover:text-orange transition-colors pt-0.5">
                  Read →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
