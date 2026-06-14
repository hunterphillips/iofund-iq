/**
 * Server-side data helpers for the IOF portfolio editorial page.
 *
 * Fetches held positions + recent trades from Postgres and derives the
 * four stat callouts (positions held, top-theme weight, active themes,
 * trades last 30d).
 */

import { desc, eq, gte, sql } from "drizzle-orm";
import { db, tables } from "@/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IofPosition {
  ticker: string;
  company: string | null;
  category: string | null;
  status: string;
  baselineWeightPct: string | null;
  firstEntryDate: string | null;
  lastActionDate: string | null;
  lastActionType: string | null;
}

export interface IofTrade {
  id: string;
  tradeDate: string;
  ticker: string;
  action: string;
  price: string | null;
  note: string | null;
  analyst: string | null;
}

export interface IofBookStats {
  positionsHeld: number;
  topThemeName: string | null;
  topThemeWeight: number | null;
  activeThemes: number;
  tradesLast30d: number;
}

/** One theme slice for the portfolio pie / theme-bar charts. */
export interface CategoryWeight {
  category: string;
  weight: number; // summed baseline weight % across held positions in the theme
  sharePct: number; // weight normalized so the tracked book sums to 100
  count: number; // held positions in the theme
}

export interface IofBook {
  positions: IofPosition[];
  trades: IofTrade[];
  stats: IofBookStats;
  categoryBreakdown: CategoryWeight[]; // sorted by weight desc
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ISO date string for N days ago (UTC). */
function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

export async function getIofBook(): Promise<IofBook> {
  const since30d = daysAgo(30);

  const [positions, recentTrades] = await Promise.all([
    // All held positions, sorted weight desc for default table order.
    db
      .select({
        ticker: tables.positions.ticker,
        company: tables.positions.company,
        category: tables.positions.category,
        status: tables.positions.status,
        baselineWeightPct: tables.positions.baselineWeightPct,
        firstEntryDate: tables.positions.firstEntryDate,
        lastActionDate: tables.positions.lastActionDate,
        lastActionType: tables.positions.lastActionType,
      })
      .from(tables.positions)
      .where(eq(tables.positions.status, "held"))
      .orderBy(
        // nulls last for weight, then alpha ticker fallback
        sql`${tables.positions.baselineWeightPct}::numeric desc nulls last`,
        tables.positions.ticker,
      ),

    // Recent trades — last 30 days, newest first.
    db
      .select({
        id: tables.trades.id,
        tradeDate: tables.trades.tradeDate,
        ticker: tables.trades.ticker,
        action: tables.trades.action,
        price: tables.trades.price,
        note: tables.trades.note,
        analyst: tables.trades.analyst,
      })
      .from(tables.trades)
      .where(gte(tables.trades.tradeDate, since30d))
      .orderBy(desc(tables.trades.tradeDate)),
  ]);

  // Derive category-level stats from held positions.
  const categoryWeights = new Map<string, number>();
  const categoryCounts = new Map<string, number>();

  for (const p of positions) {
    if (!p.category) continue;
    const w = parseFloat(p.baselineWeightPct ?? "0");
    categoryWeights.set(p.category, (categoryWeights.get(p.category) ?? 0) + w);
    categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
  }
  const activeThemes = categoryWeights.size;

  // Normalize summed weights into shares of the tracked book (baseline weights
  // need not sum to 100), then sort heaviest theme first.
  const totalWeight = [...categoryWeights.values()].reduce((a, b) => a + b, 0);
  const categoryBreakdown: CategoryWeight[] = [...categoryWeights.entries()]
    .map(([category, weight]) => ({
      category,
      weight,
      sharePct: totalWeight > 0 ? (weight / totalWeight) * 100 : 0,
      count: categoryCounts.get(category) ?? 0,
    }))
    .sort((a, b) => b.weight - a.weight);

  const top = categoryBreakdown[0] ?? null;

  const stats: IofBookStats = {
    positionsHeld: positions.length,
    topThemeName: top?.category ?? null,
    topThemeWeight: top?.weight ?? null,
    activeThemes,
    tradesLast30d: recentTrades.length,
  };

  return {
    positions: positions as IofPosition[],
    trades: recentTrades as IofTrade[],
    stats,
    categoryBreakdown,
  };
}
