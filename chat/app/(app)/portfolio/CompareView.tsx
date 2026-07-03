"use client";

/**
 * CompareView — "Compare" pane in the Holdings view-cycler: the user's synced
 * Robinhood holdings diffed against the fund's book (per-ticker weights via
 * /api/robinhood/gap, which serves the lazy 30-min snapshot; the Refresh
 * button forces a live re-sync). Unconnected users get the connect CTA.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { categoryColorVar } from "@/lib/portfolio/categories";

type SortKey = "ticker" | "fund" | "you" | "delta";
type Sort = { key: SortKey; dir: 1 | -1 };

interface GapPayload {
  total_value_usd: number;
  missing_prices: string[];
  iof_only: {
    ticker: string;
    company: string | null;
    category: string | null;
    iof_weight_pct: number;
  }[];
  overlap: {
    ticker: string;
    company: string | null;
    category: string | null;
    iof_weight_pct: number;
    your_weight_pct: number;
    delta_pct: number;
  }[];
  yours_only: { ticker: string; your_weight_pct: number }[];
}

type State =
  | { kind: "loading" }
  | { kind: "unconnected" }
  | { kind: "error" }
  | {
      kind: "ready";
      gap: GapPayload;
      fetchedAt: string;
      stale: boolean;
      refreshing: boolean;
    };

export function CompareView() {
  const [state, setState] = useState<State>({ kind: "loading" });
  // Overlap-table sort: fund weight desc by default; clicking a header
  // sorts by it, clicking again flips direction.
  const [sort, setSort] = useState<Sort>({ key: "fund", dir: -1 });

  const sortedOverlap = useMemo(() => {
    if (state.kind !== "ready") return [];
    const value = (o: GapPayload["overlap"][number]) =>
      sort.key === "ticker"
        ? o.ticker
        : sort.key === "fund"
          ? o.iof_weight_pct
          : sort.key === "you"
            ? o.your_weight_pct
            : o.delta_pct;
    return [...state.gap.overlap].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp =
        typeof va === "string"
          ? va.localeCompare(vb as string)
          : (va as number) - (vb as number);
      return cmp * sort.dir;
    });
  }, [state, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 1 ? -1 : 1 }
        : // New column: tickers read naturally ascending, numbers descending.
          { key, dir: key === "ticker" ? 1 : -1 },
    );

  const load = useCallback(async (force: boolean) => {
    if (force) {
      setState((s) =>
        s.kind === "ready" ? { ...s, refreshing: true } : { kind: "loading" },
      );
    }
    try {
      const res = await fetch(`/api/robinhood/gap${force ? "?force=1" : ""}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as
        | { connected: false }
        | {
            connected: true;
            gap: GapPayload;
            fetchedAt: string;
            stale: boolean;
          };
      if (!json.connected) {
        setState({ kind: "unconnected" });
        return;
      }
      setState({
        kind: "ready",
        gap: json.gap,
        fetchedAt: json.fetchedAt,
        stale: json.stale,
        refreshing: false,
      });
    } catch {
      setState((s) =>
        s.kind === "ready" ? { ...s, refreshing: false } : { kind: "error" },
      );
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  if (state.kind === "loading") {
    return (
      <div className="p-8 text-sm text-muted-deep">Syncing with Robinhood…</div>
    );
  }

  if (state.kind === "unconnected") {
    return (
      <div className="p-8 md:p-10 max-w-xl">
        <h3 className="font-serif text-xl text-cream">
          Compare your portfolio
        </h3>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          Connect your Robinhood account to compare your actual weights with the
          fund&apos;s, spot names you&apos;re missing, and ask the assistant
          about your own positions. Read-only: this app never places trades.
          Robinhood&apos;s connection flow requires a desktop browser.
        </p>
        <a
          href="/api/robinhood/connect"
          className="inline-block mt-5 text-[13px] font-semibold px-4 py-2 rounded-[8px] bg-orange text-white hover:brightness-110 transition-[filter]"
        >
          Connect Robinhood
        </a>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="p-8 text-sm text-muted">
        Couldn&apos;t load your holdings.{" "}
        <button
          type="button"
          onClick={() => load(false)}
          className="font-semibold text-orange hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const { gap, fetchedAt, stale, refreshing } = state;

  return (
    <div className="p-5 md:p-7">
      {/* Sync status */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="text-[12px] text-muted-deep font-mono">
          Robinhood account as of {formatTime(fetchedAt)}
          {stale && <span className="text-orange"> · may be out of date</span>}
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="text-[12px] font-semibold px-3 py-1 rounded-[7px] border border-border text-muted hover:text-cream hover:border-muted-deep transition-colors disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Overlap — weight comparison */}
      {gap.overlap.length > 0 && (
        <div className="mb-8">
          <SectionLabel>Overlap</SectionLabel>
          <div className="mt-3">
            <div className="grid grid-cols-[1fr_64px_64px_64px] gap-3 px-2 pb-2 text-[11px] uppercase tracking-[0.14em] text-muted-deep font-mono border-b border-border">
              <SortHeader
                label="Ticker"
                k="ticker"
                sort={sort}
                onSort={toggleSort}
              />
              <SortHeader
                label="Fund"
                k="fund"
                sort={sort}
                onSort={toggleSort}
                right
              />
              <SortHeader
                label="You"
                k="you"
                sort={sort}
                onSort={toggleSort}
                right
              />
              <SortHeader
                label="Δ"
                k="delta"
                sort={sort}
                onSort={toggleSort}
                right
              />
            </div>
            {sortedOverlap.map((o) => (
              <div
                key={o.ticker}
                className="grid grid-cols-[1fr_64px_64px_64px] gap-3 items-center px-2 py-2.5 border-b border-border/60 last:border-b-0"
              >
                <span className="flex items-center gap-2 min-w-0">
                  {o.category && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: categoryColorVar(o.category) }}
                      aria-hidden="true"
                    />
                  )}
                  <Link
                    href={`/positions/${o.ticker}`}
                    className="font-bold text-[14px] tracking-wide hover:text-orange transition-colors"
                  >
                    {o.ticker}
                  </Link>
                  {o.company && (
                    <span className="text-[13px] text-muted-deep truncate hidden sm:inline">
                      {o.company}
                    </span>
                  )}
                </span>
                <span className="font-mono text-sm tabular-nums text-right text-muted">
                  {o.iof_weight_pct.toFixed(1)}%
                </span>
                <span className="font-mono text-sm tabular-nums text-right text-cream">
                  {o.your_weight_pct.toFixed(1)}%
                </span>
                <span className="font-mono text-sm tabular-nums text-right text-muted">
                  {o.delta_pct > 0 ? "+" : ""}
                  {o.delta_pct.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* In the fund's book, not the user's */}
        <div>
          <SectionLabel>I/O Fund</SectionLabel>
          {gap.iof_only.length === 0 ? (
            <p className="text-sm text-muted-deep mt-3">
              You hold every name in the fund&apos;s portfolio.
            </p>
          ) : (
            <div className="mt-3">
              {[...gap.iof_only]
                .sort((a, b) => b.iof_weight_pct - a.iof_weight_pct)
                .map((p) => (
                  <div
                    key={p.ticker}
                    className="flex items-center gap-2 px-2 py-2 border-b border-border/60 last:border-b-0"
                  >
                    {p.category && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: categoryColorVar(p.category) }}
                        aria-hidden="true"
                      />
                    )}
                    <Link
                      href={`/positions/${p.ticker}`}
                      className="font-bold text-[14px] tracking-wide hover:text-orange transition-colors"
                    >
                      {p.ticker}
                    </Link>
                    <span className="text-[13px] text-muted-deep truncate flex-1">
                      {p.company ?? ""}
                    </span>
                    <span className="font-mono text-sm tabular-nums text-muted">
                      {p.iof_weight_pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* In the user's account, not the fund's book */}
        <div>
          <SectionLabel>You</SectionLabel>
          {gap.yours_only.length === 0 ? (
            <p className="text-sm text-muted-deep mt-3">
              Every position you hold is in the fund&apos;s portfolio.
            </p>
          ) : (
            <div className="mt-3">
              {gap.yours_only.map((p) => (
                <div
                  key={p.ticker}
                  className="flex items-center gap-2 px-2 py-2 border-b border-border/60 last:border-b-0"
                >
                  <span className="font-bold text-[14px] tracking-wide">
                    {p.ticker}
                  </span>
                  <span className="flex-1" />
                  <span className="font-mono text-sm tabular-nums text-muted">
                    {p.your_weight_pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {gap.missing_prices.length > 0 && (
        <p className="text-[12px] text-muted-deep mt-6">
          No live price for {gap.missing_prices.join(", ")} — excluded from
          weights.
        </p>
      )}
    </div>
  );
}

function SortHeader({
  label,
  k,
  sort,
  onSort,
  right = false,
}: {
  label: string;
  k: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  right?: boolean;
}) {
  const active = sort.key === k;
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      aria-sort={
        active ? (sort.dir === 1 ? "ascending" : "descending") : undefined
      }
      className={
        "font-mono uppercase tracking-[0.14em] text-[11px] transition-colors hover:text-cream " +
        (right ? "text-right " : "text-left ") +
        (active ? "text-cream" : "text-muted-deep")
      }
    >
      {label}
      <span aria-hidden="true">
        {active ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-deep font-mono">
      {children}
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
