"use client";

/**
 * Client component: search bar + filter chips + scrolling article list.
 * Reads initial props from the server shell; subsequent fetches go to /api/articles.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ArticleRow } from "@/lib/articles/search";

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

  // Debounce ref for q input.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchArticles = useCallback(
    async (params: {
      q: string;
      ticker: string;
      category: string;
      since: string;
    }) => {
      setLoading(true);
      try {
        const sp = new URLSearchParams();
        if (params.q) sp.set("q", params.q);
        if (params.ticker) sp.set("ticker", params.ticker);
        if (params.category) sp.set("category", params.category);
        if (params.since) sp.set("since", params.since);

        const res = await fetch(`/api/articles?${sp.toString()}`);
        if (!res.ok) throw new Error("fetch failed");
        const data: { rows: ArticleRow[]; total: number } = await res.json();
        setRows(data.rows);
        setTotal(data.total);

        // Keep URL in sync.
        router.replace(`/articles?${sp.toString()}`, { scroll: false });
      } catch {
        // keep previous results on error
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  // On filter-chip / date changes — immediate.
  useEffect(() => {
    fetchArticles({ q, ticker, category, since });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, category, since]);

  // On search input — debounced 300ms.
  function handleQChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchArticles({ q: value, ticker, category, since });
    }, 300);
  }

  function toggleCategory(cat: string) {
    setCategory((prev) => (prev === cat ? "" : cat));
  }

  return (
    <div>
      {/* Search bar */}
      <div className="mb-6">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => handleQChange(e.target.value)}
            placeholder="Search articles…"
            className="w-full bg-surface border border-border rounded-lg pl-10 pr-4 py-3 text-sm text-cream placeholder:text-muted focus:outline-none focus:border-muted transition-colors"
          />
        </div>
      </div>

      {/* Filter chips row */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {/* Category chips */}
        {allCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => toggleCategory(cat)}
            className={
              "text-[0.65rem] uppercase tracking-[0.12em] px-3 py-1 rounded-full border transition-colors " +
              (category === cat
                ? "border-orange text-orange bg-orange/10"
                : "border-border text-muted-deep hover:border-muted hover:text-muted")
            }
          >
            {categoryLabel(cat)}
          </button>
        ))}

        {/* Date-range: simple "since" shortcut chips */}
        {[
          { label: "Last 30d", value: sinceDate(30) },
          { label: "Last 90d", value: sinceDate(90) },
        ].map(({ label, value }) => (
          <button
            key={label}
            type="button"
            onClick={() => setSince((prev) => (prev === value ? "" : value))}
            className={
              "text-[0.65rem] uppercase tracking-[0.12em] px-3 py-1 rounded-full border transition-colors " +
              (since === value
                ? "border-gold text-gold bg-gold/10"
                : "border-border text-muted-deep hover:border-muted hover:text-muted")
            }
          >
            {label}
          </button>
        ))}

        {/* Ticker filter — shown when ticker is set via deep link */}
        {ticker && (
          <button
            type="button"
            onClick={() => setTicker("")}
            className="text-[0.65rem] uppercase tracking-[0.12em] px-3 py-1 rounded-full border border-gold text-gold bg-gold/10 hover:bg-gold/20 transition-colors"
          >
            {ticker} ×
          </button>
        )}

        {/* Active filter count + clear */}
        {(q || ticker || category || since) && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setTicker("");
              setCategory("");
              setSince("");
              fetchArticles({ q: "", ticker: "", category: "", since: "" });
            }}
            className="ml-auto text-[0.65rem] uppercase tracking-[0.12em] text-muted-deep hover:text-muted transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Result count */}
      <div className="text-xs text-muted-deep mb-5 tabular-nums">
        {loading ? (
          <span className="opacity-60">Searching…</span>
        ) : (
          <span>
            {total} {total === 1 ? "article" : "articles"}
            {q || ticker || category || since ? " matching filters" : ""}
          </span>
        )}
      </div>

      {/* Article list */}
      {rows.length === 0 && !loading ? (
        <EmptyState q={q} ticker={ticker} category={category} />
      ) : (
        <div className={`flex flex-col divide-y divide-border ${loading ? "opacity-60" : ""} transition-opacity`}>
          {rows.map((row) => (
            <ArticleRow key={row.slug} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function ArticleRow({ row }: { row: ArticleRow }) {
  return (
    <Link
      href={`/articles/${row.slug}`}
      className="group py-6 -mx-2 px-2 rounded transition-colors hover:bg-surface/60 block"
    >
      <div className="flex items-baseline gap-4">
        {/* Date */}
        <span className="flex-none text-xs text-muted-deep tabular-nums w-28 pt-0.5">
          {formatDate(row.pubDate)}
        </span>

        <div className="flex-1 min-w-0">
          {/* Category eyebrow */}
          {row.category && (
            <div className="text-[0.6rem] uppercase tracking-[0.16em] text-orange mb-1">
              {categoryLabel(row.category)}
            </div>
          )}

          {/* Title */}
          <h2 className="font-serif text-lg leading-snug text-cream group-hover:text-gold transition-colors mb-1">
            {row.title}
          </h2>

          {/* Preview takeaway */}
          {row.preview && (
            <p className="text-sm text-muted leading-relaxed line-clamp-2 mb-2">
              {row.preview}
            </p>
          )}

          {/* Ticker chips */}
          {row.tickers && row.tickers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {row.tickers.map((t) => (
                <span
                  key={t}
                  className="text-[0.6rem] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded border border-border text-muted-deep font-mono"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <span className="flex-none text-xs text-muted group-hover:text-orange transition-colors pt-0.5">
          Read →
        </span>
      </div>
    </Link>
  );
}

function EmptyState({
  q,
  ticker,
  category,
}: {
  q: string;
  ticker: string;
  category: string;
}) {
  return (
    <div className="py-20 text-center">
      <div className="text-muted-deep mb-2 text-3xl">∅</div>
      <p className="text-sm text-muted">
        No articles found
        {q ? ` for "${q}"` : ""}
        {ticker ? ` · ticker ${ticker}` : ""}
        {category ? ` · category ${category}` : ""}
        .
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

function sinceDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
