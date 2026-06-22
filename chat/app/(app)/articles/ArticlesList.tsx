"use client";

/**
 * Client component: search bar + filter chips + scrolling article list.
 * Reads initial props from the server shell; subsequent fetches go to /api/articles.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ArticleRow } from "@/lib/articles/search";

function sinceDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

interface Props {
  initialRows: ArticleRow[];
  initialTotal: number;
  allCategories: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  "ai-stocks": "AI Stocks",
  "broad-market": "Broad Market",
  crypto: "Crypto",
  premium: "Premium",
};

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

/** Format YYYY-MM-DD date as "Jun 12, 2026" */
function formatDate(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ArticlesList({
  initialRows,
  initialTotal,
  allCategories,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Derive initial state from URL search params (supports deep-linking).
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [ticker, setTicker] = useState(searchParams.get("ticker") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [since, setSince] = useState(searchParams.get("since") ?? "");

  const [rows, setRows] = useState<ArticleRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);

  // Stable since-date strings computed once at mount (Fix 3: avoid midnight cliff
  // where re-renders produce new strings that break the active-chip comparison).
  const sinceDates = useMemo(
    () => ({ d30: sinceDate(30), d90: sinceDate(90) }),
    [],
  );

  // Debounce ref for q input.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AbortController ref — abort the in-flight request before starting a new one
  // so that out-of-order responses from fast typing / rapid chip clicks can't
  // clobber results (Fix 1).
  const abortRef = useRef<AbortController | null>(null);

  // Mount guard — skip the first effect run when filters are empty so the
  // initialRows from SSR are used directly (Fix 4).
  const mountedRef = useRef(false);

  const fetchArticles = useCallback(
    async (params: {
      q: string;
      ticker: string;
      category: string;
      since: string;
    }) => {
      // Cancel any in-flight request.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const sp = new URLSearchParams();
        if (params.q) sp.set("q", params.q);
        if (params.ticker) sp.set("ticker", params.ticker);
        if (params.category) sp.set("category", params.category);
        if (params.since) sp.set("since", params.since);

        const res = await fetch(`/api/articles?${sp.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("fetch failed");
        const data: { rows: ArticleRow[]; total: number } = await res.json();
        setRows(data.rows);
        setTotal(data.total);

        // Keep URL in sync.
        router.replace(`/articles?${sp.toString()}`, { scroll: false });
      } catch (err) {
        // Ignore aborted requests — keep previous results displayed.
        if (err instanceof Error && err.name === "AbortError") return;
        // For other errors, keep previous results on error.
      } finally {
        // Only clear loading if this controller wasn't already superseded.
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [router],
  );

  // On filter-chip / date changes — immediate.
  // Skip the very first run when all filters are empty: initialRows from SSR
  // already reflect the unfiltered state (Fix 4). If the page was deep-linked
  // with filters (non-empty initial state), the server shell already fetched
  // with those filters, so we also skip — the initial data is already correct.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    fetchArticles({ q, ticker, category, since });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, category, since]);

  // On search input — debounced 500ms so the query only fires once typing
  // settles, not on every keystroke. Enter (runSearch) bypasses the wait.
  function handleQChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchArticles({ q: value, ticker, category, since });
    }, 600);
  }

  function toggleCategory(cat: string) {
    setCategory((prev) => (prev === cat ? "" : cat));
  }

  function runSearch() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    fetchArticles({ q, ticker, category, since });
  }

  const hasFilters = !!(q || ticker || category || since);
  // Editorial featured cards only on the unfiltered view, where "newest 2" reads
  // as a deliberate highlight rather than an arbitrary slice of a filtered set.
  const featured = hasFilters ? [] : rows.slice(0, 2);
  const listRows = hasFilters ? rows : rows.slice(2);

  return (
    <div>
      {/* Search bar */}
      <div className="flex gap-3 max-w-[680px] mb-5">
        <div className="flex-1 flex items-center gap-3 bg-surface/20 backdrop-blur-sm border border-border rounded-2xl px-[18px] h-14 transition-[border-color,box-shadow] focus-within:border-orange focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-orange)_14%,transparent)]">
          <span className="text-muted-deep pointer-events-none">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => handleQChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Search recent articles and tickers…"
            className="flex-1 bg-transparent border-none outline-none text-base text-cream placeholder:text-muted-deep min-w-0"
          />
        </div>
        <button
          type="button"
          onClick={runSearch}
          className="h-14 px-6 rounded-2xl bg-cream/80 backdrop-blur-sm text-bg font-semibold text-[15px] hover:bg-cream hover:brightness-[1.06] transition-[filter,background-color]"
        >
          Search
        </button>
      </div>

      {/* Filter chips row */}
      <div className="flex flex-wrap items-center gap-2.5 mb-9">
        {allCategories.map((cat) => (
          <FilterChip
            key={cat}
            on={category === cat}
            tone="orange"
            onClick={() => toggleCategory(cat)}
          >
            {categoryLabel(cat)}
          </FilterChip>
        ))}

        {[
          { label: "Last 30 days", value: sinceDates.d30 },
          { label: "Last 90 days", value: sinceDates.d90 },
        ].map(({ label, value }) => (
          <FilterChip
            key={label}
            on={since === value}
            tone="gold"
            onClick={() => setSince((prev) => (prev === value ? "" : value))}
          >
            {label}
          </FilterChip>
        ))}

        {ticker && (
          <FilterChip on tone="gold" onClick={() => setTicker("")}>
            {ticker} ×
          </FilterChip>
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setTicker("");
              setCategory("");
              setSince("");
              fetchArticles({ q: "", ticker: "", category: "", since: "" });
            }}
            className="ml-auto text-xs font-semibold tracking-wide text-muted-deep hover:text-muted transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Featured cards (unfiltered only) */}
      {featured.length > 0 && (
        <div className="grid md:grid-cols-[1.3fr_1fr] gap-[18px] mb-10">
          {featured.map((row, i) => (
            <FeatureCard key={row.slug} row={row} big={i === 0} />
          ))}
        </div>
      )}

      {/* Result count */}
      <div className="text-xs text-muted-deep mb-4 tabular-nums">
        {loading ? (
          <span className="opacity-60">Searching…</span>
        ) : (
          <span>
            {total} {total === 1 ? "article" : "articles"}
            {hasFilters ? " matching filters" : ""}
          </span>
        )}
      </div>

      {/* Article list */}
      {rows.length === 0 && !loading ? (
        <EmptyState q={q} ticker={ticker} category={category} since={since} />
      ) : (
        <div
          className={`flex flex-col ${loading ? "opacity-60" : ""} transition-opacity`}
        >
          {listRows.map((row) => (
            <ArticleListRow key={row.slug} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  on,
  tone,
  onClick,
  children,
}: {
  on: boolean;
  tone: "orange" | "gold";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const onClasses =
    tone === "orange"
      ? "bg-orange border-orange text-white"
      : "bg-gold border-gold text-bg";
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "text-[13px] font-semibold px-[15px] py-2 rounded-full border transition-colors " +
        (on
          ? onClasses
          : "bg-surface/20 backdrop-blur-sm border-border text-muted hover:text-cream hover:border-muted-deep")
      }
    >
      {children}
    </button>
  );
}

function FeatureCard({ row, big }: { row: ArticleRow; big: boolean }) {
  return (
    <Link
      href={`/articles/${row.slug}`}
      className={
        "group relative overflow-hidden border border-border rounded-2xl bg-surface p-7 flex flex-col gap-4 hover:-translate-y-0.5 hover:border-muted-deep transition-all " +
        (big ? "justify-end min-h-[230px]" : "min-h-[230px]")
      }
    >
      {row.category && (
        <span className="self-start text-[10.5px] uppercase tracking-[0.16em] font-bold px-3 py-1.5 border border-border rounded-full text-muted">
          {categoryLabel(row.category)}
        </span>
      )}
      <div className="mt-auto">
        <h3
          className={
            "font-serif font-semibold leading-[1.08] tracking-[-0.02em] text-cream group-hover:text-orange transition-colors " +
            (big ? "text-2xl md:text-3xl" : "text-2xl")
          }
        >
          {row.title}
        </h3>
        <div className="font-mono text-[13px] text-muted-deep mt-3">
          {formatDate(row.pubDate)}
          {row.tickers && row.tickers.length > 0
            ? " · " + row.tickers.slice(0, 4).join(" · ")
            : ""}
        </div>
      </div>
    </Link>
  );
}

function ArticleListRow({ row }: { row: ArticleRow }) {
  return (
    <Link
      href={`/articles/${row.slug}`}
      className="group grid grid-cols-[96px_1fr] sm:grid-cols-[118px_1fr_150px] gap-5 sm:gap-7 items-start py-6 px-2 -mx-2 border-t border-border rounded-xl transition-colors hover:bg-surface/60"
    >
      {/* Date */}
      <span className="font-serif text-sm text-muted pt-1">
        {formatDate(row.pubDate)}
      </span>

      <div className="min-w-0">
        {row.category && (
          <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-orange mb-2">
            {categoryLabel(row.category)}
          </div>
        )}
        <h2 className="font-serif text-[23px] font-semibold leading-[1.18] tracking-[-0.01em] text-cream group-hover:text-orange transition-colors">
          {row.title}
        </h2>
        {row.preview && (
          <p className="text-[14.5px] text-muted leading-relaxed mt-2.5 max-w-[62ch] line-clamp-2">
            {row.preview}
          </p>
        )}
      </div>

      {/* Ticker chips */}
      {row.tickers && row.tickers.length > 0 && (
        <div className="hidden sm:flex flex-wrap gap-1.5 justify-end pt-1">
          {row.tickers.slice(0, 4).map((t) => (
            <span
              key={t}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-border text-muted font-mono"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function EmptyState({
  q,
  ticker,
  category,
  since,
}: {
  q: string;
  ticker: string;
  category: string;
  since: string;
}) {
  return (
    <div className="py-20 text-center">
      <div className="text-muted-deep mb-2 text-3xl">∅</div>
      <p className="text-sm text-muted">
        No articles found
        {q ? ` for "${q}"` : ""}
        {ticker ? ` · ticker ${ticker}` : ""}
        {category ? ` · category ${category}` : ""}
        {since ? ` · since ${since}` : ""}.
      </p>
      <p className="text-xs text-muted-deep mt-2">Try broader search terms.</p>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
