"use client";

import { useState } from "react";
import Link from "next/link";
import type { IofPosition } from "@/lib/portfolio/iof-book";
import {
  categoryColorVar,
  categoryLabel,
  OTHER_CATEGORY_COLOR_VAR,
} from "@/lib/portfolio/categories";

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

type SortCol = "ticker" | "company" | "category" | "weight" | "firstEntry";
type SortDir = "asc" | "desc";

function sortRows(
  rows: IofPosition[],
  col: SortCol,
  dir: SortDir,
): IofPosition[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (col) {
      case "ticker":
        cmp = a.ticker.localeCompare(b.ticker);
        break;
      case "company":
        cmp = (a.company ?? "").localeCompare(b.company ?? "");
        break;
      case "category":
        cmp = (a.category ?? "").localeCompare(b.category ?? "");
        break;
      case "weight": {
        const wa = a.baselineWeightPct != null ? parseFloat(a.baselineWeightPct) : null;
        const wb = b.baselineWeightPct != null ? parseFloat(b.baselineWeightPct) : null;
        // Null-weight rows always sort last, regardless of direction.
        if (wa === null && wb === null) { cmp = 0; break; }
        if (wa === null) return 1;
        if (wb === null) return -1;
        cmp = wa - wb;
        break;
      }
      case "firstEntry": {
        const da = a.firstEntryDate ?? "";
        const db_ = b.firstEntryDate ?? "";
        cmp = da < db_ ? -1 : da > db_ ? 1 : 0;
        break;
      }
    }
    return cmp * sign;
  });
}

// ---------------------------------------------------------------------------
// ChevronIcon (module scope — not inside the render body)
// ---------------------------------------------------------------------------

function ChevronIcon({
  col,
  sortCol,
  sortDir,
}: {
  col: SortCol;
  sortCol: SortCol;
  sortDir: SortDir;
}) {
  if (sortCol !== col) {
    return <span className="sort-icon sort-icon-inactive">↕</span>;
  }
  return (
    <span className="sort-icon sort-icon-active">
      {sortDir === "asc" ? "↑" : "↓"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  rows: IofPosition[];
}

export function PositionsTable({ rows }: Props) {
  const [sortCol, setSortCol] = useState<SortCol>("weight");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleHeader(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "weight" || col === "firstEntry" ? "desc" : "asc");
    }
  }

  const sorted = sortRows(rows, sortCol, sortDir);

  // aria-sort tells assistive tech which column orders the table and in which
  // direction; non-active columns report "none".
  const ariaSort = (col: SortCol): "ascending" | "descending" | "none" =>
    sortCol !== col ? "none" : sortDir === "asc" ? "ascending" : "descending";

  return (
    <div className="overflow-x-auto">
      <table className="positions-table">
        <thead>
          <tr>
            <th aria-sort={ariaSort("ticker")}>
              <button
                className="col-header"
                onClick={() => handleHeader("ticker")}
              >
                Ticker <ChevronIcon col="ticker" sortCol={sortCol} sortDir={sortDir} />
              </button>
            </th>
            <th aria-sort={ariaSort("company")}>
              <button
                className="col-header"
                onClick={() => handleHeader("company")}
              >
                Company <ChevronIcon col="company" sortCol={sortCol} sortDir={sortDir} />
              </button>
            </th>
            <th aria-sort={ariaSort("category")}>
              <button
                className="col-header"
                onClick={() => handleHeader("category")}
              >
                Trend <ChevronIcon col="category" sortCol={sortCol} sortDir={sortDir} />
              </button>
            </th>
            <th className="text-right" aria-sort={ariaSort("weight")}>
              <button
                className="col-header col-header-right"
                onClick={() => handleHeader("weight")}
              >
                <ChevronIcon col="weight" sortCol={sortCol} sortDir={sortDir} /> Weight
              </button>
            </th>
            <th aria-sort={ariaSort("firstEntry")}>
              <button
                className="col-header"
                onClick={() => handleHeader("firstEntry")}
              >
                First entry <ChevronIcon col="firstEntry" sortCol={sortCol} sortDir={sortDir} />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const weight = row.baselineWeightPct
              ? parseFloat(row.baselineWeightPct)
              : null;
            const color = categoryColorVar(row.category);
            const entry = row.firstEntryDate
              ? new Date(row.firstEntryDate + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", year: "numeric" },
                )
              : "—";

            return (
              <tr key={row.ticker}>
                <td>
                  <Link
                    href={`/positions/${row.ticker}`}
                    className="ticker-mono hover:text-orange transition-colors"
                  >
                    {row.ticker}
                  </Link>
                </td>
                <td className="company-cell">
                  {row.company ?? <span className="text-muted-deep">—</span>}
                </td>
                <td>
                  {row.category ? (
                    <span className="theme-cell">
                      <span
                        className="theme-dot"
                        style={{ background: color }}
                        aria-hidden="true"
                      />
                      <span className="theme-label">{categoryLabel(row.category)}</span>
                    </span>
                  ) : (
                    <span className="theme-cell">
                      <span
                        className="theme-dot"
                        style={{ background: OTHER_CATEGORY_COLOR_VAR }}
                        aria-hidden="true"
                      />
                      <span className="theme-label text-muted-deep">
                        Uncategorized
                      </span>
                    </span>
                  )}
                </td>
                <td className="weight-cell">
                  {weight !== null && weight > 0 ? (
                    <span className="weight-num">{weight.toFixed(1)}%</span>
                  ) : (
                    <span className="text-muted-deep tabular-nums">—</span>
                  )}
                </td>
                <td className="entry-cell">{entry}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
