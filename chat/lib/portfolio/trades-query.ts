import { and, desc, gte, sql as drizzleSql } from "drizzle-orm";
import { db, tables } from "@/db";

export interface TradeRow {
  date: string;
  ticker: string;
  action: string;
  price: string | null;
  note: string | null;
  analyst: string | null;
}

export interface QueryTradesParams {
  ticker?: string;
  since?: string;
  limit?: number;
}

/** Query the official trade log, newest first. */
export async function queryTrades({
  ticker,
  since,
  limit = 25,
}: QueryTradesParams): Promise<TradeRow[]> {
  const conditions = [];
  if (ticker) {
    conditions.push(
      drizzleSql`upper(${tables.trades.ticker}) = ${ticker.toUpperCase()}`,
    );
  }
  if (since) {
    conditions.push(gte(tables.trades.tradeDate, since));
  }

  return db
    .select({
      date: tables.trades.tradeDate,
      ticker: tables.trades.ticker,
      action: tables.trades.action,
      price: tables.trades.price,
      note: tables.trades.note,
      analyst: tables.trades.analyst,
    })
    .from(tables.trades)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(tables.trades.tradeDate))
    .limit(limit);
}
