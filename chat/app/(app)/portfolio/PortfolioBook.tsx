"use client";

/**
 * PortfolioBook — the "01 — Holdings" surface with a Table / Pie / Trends
 * view-cycler (slice: 2026-06-14 redesign). The pie pulls the deferred
 * Portfolio-v2 donut forward, rendered with recharts; the trends view uses
 * lightweight CSS weight-bars (matching the approved mockup). All three share
 * the single-source category colors in lib/portfolio/categories.ts, so they
 * re-theme with light/dark.
 *
 * Category filter: clicking a category in the Pie or Trends view sets `selected`
 * (lifted to PortfolioContent so it also scopes Recent moves). When a filter is
 * active the table is filtered, the non-selected categories grey out in the
 * charts, and a removable pill shows next to the "Holdings" heading. Clicking
 * the selected category again clears the filter.
 */

import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { IofPosition, CategoryWeight } from "@/lib/portfolio/iof-book";
import { categoryColorVar, categoryLabel } from "@/lib/portfolio/categories";
import { PositionsTable } from "./PositionsTable";
import { CompareView } from "./CompareView";

type View = "table" | "pie" | "trends" | "compare";

const VIEWS: { id: View; label: string }[] = [
  { id: "table", label: "Table" },
  { id: "pie", label: "Pie" },
  { id: "trends", label: "Trends" },
  { id: "compare", label: "Compare" },
];

const DIMMED = 0.22;

export function PortfolioBook({
  rows,
  breakdown,
  selected,
  onSelect,
}: {
  rows: IofPosition[];
  breakdown: CategoryWeight[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}) {
  const [view, setView] = useState<View>("table");
  const hasCharts = breakdown.length > 0;

  // Toggle: clicking the active category clears the filter.
  const toggle = (category: string) =>
    onSelect(selected === category ? null : category);

  const tableRows = selected
    ? rows.filter((r) => r.category === selected)
    : rows;

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-deep font-mono">
            01
          </span>
          <h2 className="font-serif text-2xl text-cream tracking-tight">
            Holdings
          </h2>
          {selected && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="group inline-flex items-center gap-1.5 text-[12px] font-semibold pl-2 pr-2.5 py-1 rounded-full border border-border bg-surface-2/60 text-cream hover:border-muted-deep transition-colors"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: categoryColorVar(selected) }}
              />
              {categoryLabel(selected)}
              <span
                className="text-muted-deep group-hover:text-cream transition-colors"
                aria-hidden="true"
              >
                ✕
              </span>
              <span className="sr-only">Clear filter</span>
            </button>
          )}
        </div>

        {hasCharts && (
          <div
            className="inline-flex bg-surface-2/60 backdrop-blur-md border border-border rounded-[10px] p-1 gap-0.5"
            role="tablist"
            aria-label="Portfolio view"
          >
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                onClick={() => setView(v.id)}
                className={
                  "text-[13px] font-semibold px-4 py-1.5 rounded-[7px] transition-colors " +
                  (view === v.id
                    ? "bg-orange text-white"
                    : "text-muted hover:text-cream")
                }
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border border-border rounded-2xl bg-surface/30 backdrop-blur-lg px-4 py-3">
        {view === "table" && <PositionsTable rows={tableRows} />}
        {view === "pie" && (
          <PieView
            breakdown={breakdown}
            names={rows.length}
            selected={selected}
            onToggle={toggle}
          />
        )}
        {view === "trends" && (
          <TrendsView
            breakdown={breakdown}
            selected={selected}
            onToggle={toggle}
          />
        )}
        {view === "compare" && <CompareView />}

        {/*
          Filtered holdings beneath the chart. When a category is selected in the
          Pie or Trends view, show the matching holdings here so the user doesn't
          have to switch back to the Table view to see what's in the slice.
        */}
        {view !== "table" && view !== "compare" && selected && (
          <div className="mt-2 border-t border-border pt-3 px-2 md:px-4">
            <div className="flex items-center gap-2 mb-3 text-[12px] uppercase tracking-[0.14em] text-muted-deep font-mono">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: categoryColorVar(selected) }}
              />
              {categoryLabel(selected)} holdings
            </div>
            <PositionsTable rows={tableRows} />
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pie (donut) view
// ---------------------------------------------------------------------------

function PieView({
  breakdown,
  names,
  selected,
  onToggle,
}: {
  breakdown: CategoryWeight[];
  names: number;
  selected: string | null;
  onToggle: (category: string) => void;
}) {
  const data = breakdown.map((b) => ({
    category: b.category,
    name: categoryLabel(b.category),
    value: Number(b.sharePct.toFixed(1)),
    color: categoryColorVar(b.category),
  }));

  return (
    <div className="grid md:grid-cols-[auto_1fr] gap-10 md:gap-14 items-center p-6 md:p-8">
      <div className="relative w-[236px] h-[236px] mx-auto">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={72}
              outerRadius={116}
              paddingAngle={1.5}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              onClick={(_, index) => onToggle(data[index].category)}
              style={{ cursor: "pointer" }}
            >
              {data.map((d) => (
                <Cell
                  key={d.name}
                  fill={d.color}
                  fillOpacity={selected && d.category !== selected ? DIMMED : 1}
                />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              // Lift the tooltip above the absolutely-positioned center "N names"
              // overlay, which otherwise paints over it (it's later in the DOM).
              wrapperStyle={{ zIndex: 50 }}
              formatter={(value, name) => [`${value}%`, name]}
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                color: "var(--color-cream)",
                fontSize: 13,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-content-center text-center pointer-events-none">
          <div className="font-serif text-4xl font-semibold leading-none text-cream tabular-nums">
            {names}
          </div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-muted mt-1.5">
            names
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {breakdown.map((b) => {
          const dim = selected !== null && b.category !== selected;
          return (
            <button
              key={b.category}
              type="button"
              aria-pressed={selected === b.category}
              onClick={() => onToggle(b.category)}
              className={
                "grid grid-cols-[14px_1fr_auto] gap-3.5 items-center text-[15px] text-left rounded-lg px-2 py-1.5 -mx-2 hover:bg-surface-2/50 transition-[background-color,opacity] " +
                (dim ? "opacity-40" : "opacity-100")
              }
            >
              <span
                className="w-[11px] h-[11px] rounded-[3px]"
                style={{ background: categoryColorVar(b.category) }}
              />
              <span className="text-cream">{categoryLabel(b.category)}</span>
              <span className="font-mono text-muted tabular-nums">
                {Math.round(b.sharePct)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trends (weight bars) view
// ---------------------------------------------------------------------------

function TrendsView({
  breakdown,
  selected,
  onToggle,
}: {
  breakdown: CategoryWeight[];
  selected: string | null;
  onToggle: (category: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 p-6 md:p-8">
      {breakdown.map((b) => {
        const dim = selected !== null && b.category !== selected;
        return (
          <button
            key={b.category}
            type="button"
            aria-pressed={selected === b.category}
            onClick={() => onToggle(b.category)}
            className={
              "grid grid-cols-[130px_1fr_46px] sm:grid-cols-[160px_1fr_50px] gap-4 items-center text-[14.5px] text-left rounded-lg px-2 py-1.5 -mx-2 hover:bg-surface-2/50 transition-[background-color,opacity] " +
              (dim ? "opacity-40" : "opacity-100")
            }
          >
            <span className="text-cream truncate">
              {categoryLabel(b.category)}
            </span>
            <div className="h-[13px] rounded-[7px] bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-[7px]"
                style={{
                  width: `${b.sharePct}%`,
                  background: categoryColorVar(b.category),
                }}
              />
            </div>
            <span className="font-mono text-muted tabular-nums text-right">
              {Math.round(b.sharePct)}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
