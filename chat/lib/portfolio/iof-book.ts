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

export interface IofBook {
  positions: IofPosition[];
  trades: IofTrade[];
  stats: IofBookStats;
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
  const categoryWeights: Map<string, number> = new Map();
  let activeThemes = 0;

  for (const p of positions) {
    if (!p.category) continue;
    const w = parseFloat(p.baselineWeightPct ?? "0");
    categoryWeights.set(p.category, (categoryWeights.get(p.category) ?? 0) + w);
  }
  activeThemes = categoryWeights.size;

  // Top theme by summed weight.
  let topThemeName: string | null = null;
  let topThemeWeight: number | null = null;
  for (const [cat, weight] of categoryWeights.entries()) {
    if (topThemeWeight === null || weight > topThemeWeight) {
      topThemeName = cat;
      topThemeWeight = weight;
    }
  }

  const stats: IofBookStats = {
    positionsHeld: positions.length,
    topThemeName,
    topThemeWeight,
    activeThemes,
    tradesLast30d: recentTrades.length,
  };

  return {
    positions: positions as IofPosition[],
    trades: recentTrades as IofTrade[],
    stats,
  };
}
