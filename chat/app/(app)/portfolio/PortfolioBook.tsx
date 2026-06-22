"use client";

/**
 * PortfolioBook — the "01 — Holdings" surface with a Table / Pie / Trends
 * view-cycler (slice: 2026-06-14 redesign). The pie pulls the deferred
 * Portfolio-v2 donut forward, rendered with recharts; the trends view uses
 * lightweight CSS weight-bars (matching the approved mockup). All three share
 * the single-source category colors in lib/portfolio/categories.ts, so they
 * re-theme with light/dark.
 */

import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { IofPosition, CategoryWeight } from "@/lib/portfolio/iof-book";
import { categoryColorVar, categoryLabel } from "@/lib/portfolio/categories";
import { PositionsTable } from "./PositionsTable";

type View = "table" | "pie" | "trends";

const VIEWS: { id: View; label: string }[] = [
  { id: "table", label: "Table" },
  { id: "pie", label: "Pie" },
  { id: "trends", label: "Trends" },
];

export function PortfolioBook({
  rows,
  breakdown,
}: {
  rows: IofPosition[];
  breakdown: CategoryWeight[];
}) {
  const [view, setView] = useState<View>("table");
  const hasCharts = breakdown.length > 0;

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-baseline gap-3">
          <span className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-deep font-mono">
            01
          </span>
          <h2 className="font-serif text-2xl text-cream tracking-tight">Holdings</h2>
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
        {view === "table" && <PositionsTable rows={rows} />}
        {view === "pie" && <PieView breakdown={breakdown} names={rows.length} />}
        {view === "trends" && <TrendsView breakdown={breakdown} />}
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
}: {
  breakdown: CategoryWeight[];
  names: number;
}) {
  const data = breakdown.map((b) => ({
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
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
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

      <div className="flex flex-col gap-4">
        {breakdown.map((b) => (
          <div
            key={b.category}
            className="grid grid-cols-[14px_1fr_auto] gap-3.5 items-center text-[15px]"
          >
            <span
              className="w-[11px] h-[11px] rounded-[3px]"
              style={{ background: categoryColorVar(b.category) }}
            />
            <span className="text-cream">{categoryLabel(b.category)}</span>
            <span className="font-mono text-muted tabular-nums">
              {Math.round(b.sharePct)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trends (weight bars) view
// ---------------------------------------------------------------------------

function TrendsView({ breakdown }: { breakdown: CategoryWeight[] }) {
  return (
    <div className="flex flex-col gap-5 p-6 md:p-8">
      {breakdown.map((b) => (
        <div
          key={b.category}
          className="grid grid-cols-[130px_1fr_46px] sm:grid-cols-[160px_1fr_50px] gap-4 items-center text-[14.5px]"
        >
          <span className="text-cream truncate">{categoryLabel(b.category)}</span>
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
        </div>
      ))}
    </div>
  );
}
