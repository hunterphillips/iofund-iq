/**
 * Server-side data for a single position dossier (`/positions/[ticker]`).
 *
 * Pulls the position row, its full trade timeline (oldest-first — a replay reads
 * forward), and related distilled articles (those tagged with the ticker). The
 * caveated price-move figure is computed by the pure derivePriceMove() helper;
 * this module holds only I/O.
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, tables } from "@/db";
import type { IofPosition, IofTrade } from "./iof-book";
import { derivePriceMove, type PriceMove } from "./price-move";

export interface RelatedArticle {
  id: string;
  slug: string;
  title: string;
  pubDate: string | null;
  category: string | null;
}

export interface PositionDetail {
  position: IofPosition;
  trades: IofTrade[];
  priceMove: PriceMove | null;
  relatedArticles: RelatedArticle[];
}

/**
 * @returns the dossier for `ticker`, or null when no position row exists for it
 *   (trades-only tickers — closed before the positions table was bootstrapped —
 *   are treated as not-found; they're a rare edge case).
 */
export async function getPositionDetail(
  ticker: string,
): Promise<PositionDetail | null> {
  const symbol = ticker.toUpperCase();

  const [positionRow, trades, relatedArticles] = await Promise.all([
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
      .where(eq(tables.positions.ticker, symbol))
      .limit(1),

    // Full timeline, oldest-first.
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
      .where(eq(tables.trades.ticker, symbol))
      .orderBy(asc(tables.trades.tradeDate)),

    // Distilled articles tagged with this ticker, newest-first. Same array
    // membership pattern as lib/articles/search.ts; tickers stored uppercase.
    db
      .select({
        id: tables.articles.id,
        slug: tables.articles.slug,
        title: tables.articles.title,
        pubDate: tables.articles.pubDate,
        category: tables.articles.category,
      })
      .from(tables.articles)
      .where(
        and(
          eq(tables.articles.premium, true),
          sql`${symbol} = ANY(${tables.articles.tickers})`,
        ),
      )
      .orderBy(desc(tables.articles.pubDate))
      .limit(8),
  ]);

  const position = positionRow[0];
  if (!position) return null;

  return {
    position: position as IofPosition,
    trades: trades as IofTrade[],
    priceMove: derivePriceMove(trades),
    relatedArticles: relatedArticles as RelatedArticle[],
  };
}
