"use client";

import { useState } from "react";
import type { IofPosition } from "@/lib/portfolio/iof-book";

// ---------------------------------------------------------------------------
// Category → swatch color mapping (matches globals.css --color-cat-* tokens)
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  "AI Accelerators": "#E94E1B",
  "AI Networking": "#D4AF37",
  "AI Memory": "#C26B6B",
  "AI Energy": "#8FA86E",
  "AI Software": "#A98BC9",
  Cryptocurrency: "#D97706",
};
const OTHER_COLOR = "#7A6F66";

function swatchColor(category: string | null): string {
  if (!category) return OTHER_COLOR;
  return CATEGORY_COLORS[category] ?? OTHER_COLOR;
}

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
        const wa = parseFloat(a.baselineWeightPct ?? "0");
        const wb = parseFloat(b.baselineWeightPct ?? "0");
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

  function ChevronIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) {
      return <span className="sort-icon sort-icon-inactive">↕</span>;
    }
    return (
      <span className="sort-icon sort-icon-active">
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="positions-table">
        <thead>
          <tr>
            <th>
              <button
                className="col-header"
                onClick={() => handleHeader("ticker")}
              >
                Ticker <ChevronIcon col="ticker" />
              </button>
            </th>
            <th>
              <button
                className="col-header"
                onClick={() => handleHeader("company")}
              >
                Company <ChevronIcon col="company" />
              </button>
            </th>
            <th>
              <button
                className="col-header"
                onClick={() => handleHeader("category")}
              >
                Theme <ChevronIcon col="category" />
              </button>
            </th>
            <th className="text-right">
              <button
                className="col-header col-header-right"
                onClick={() => handleHeader("weight")}
              >
                <ChevronIcon col="weight" /> Weight
              </button>
            </th>
            <th>
              <button
                className="col-header"
                onClick={() => handleHeader("firstEntry")}
              >
                First entry <ChevronIcon col="firstEntry" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const weight = row.baselineWeightPct
              ? parseFloat(row.baselineWeightPct)
              : null;
            const color = swatchColor(row.category);
            const entry = row.firstEntryDate
              ? new Date(row.firstEntryDate + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", year: "numeric" },
                )
              : "—";

            return (
              <tr key={row.ticker}>
                <td>
                  <span className="ticker-mono">{row.ticker}</span>
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
                      <span className="theme-label">{row.category}</span>
                    </span>
                  ) : (
                    <span className="theme-cell">
                      <span
                        className="theme-dot"
                        style={{ background: OTHER_COLOR }}
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
