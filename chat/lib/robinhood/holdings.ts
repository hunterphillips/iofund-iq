/**
 * Lazy broker-holdings snapshot. Nothing polls: a consumer (chat tool,
 * Compare view) asks for holdings, and only if the stored snapshot is older
 * than STALE_MINUTES (or force-refreshed) do we hit the Robinhood MCP —
 * paginating positions, then replacing the user's rows wholesale.
 */

import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import type { Holding } from "@/lib/portfolio/gap-math";
import { callRobinhoodTool } from "./mcp-client";
import { getRobinhoodConnection, getValidAccessToken } from "./connection";
import {
  mergeHoldings,
  parseEquityPositions,
  type RawEquityPositionsPayload,
} from "./parse";

const STALE_MINUTES = 30;
const MAX_PAGES = 10;

export interface HoldingsSnapshot {
  holdings: Holding[];
  fetchedAt: Date;
  /** True when this call couldn't refresh and is serving old data. */
  stale: boolean;
}

export type HoldingsResult =
  | { connected: false }
  | ({ connected: true } & HoldingsSnapshot);

async function readSnapshotRows(userId: string): Promise<HoldingsSnapshot | null> {
  const rows = await db
    .select({
      ticker: tables.brokerHoldings.ticker,
      shares: tables.brokerHoldings.shares,
      fetchedAt: tables.brokerHoldings.fetchedAt,
    })
    .from(tables.brokerHoldings)
    .where(eq(tables.brokerHoldings.userId, userId));
  if (rows.length === 0) return null;
  return {
    holdings: rows.map((r) => ({ ticker: r.ticker, shares: Number(r.shares) })),
    fetchedAt: rows[0].fetchedAt,
    stale: false,
  };
}

async function fetchLiveHoldings(
  token: string,
  accountNumber: string,
): Promise<Holding[]> {
  const pages: Holding[][] = [];
  let cursor: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const payload = (await callRobinhoodTool(token, "get_equity_positions", {
      account_number: accountNumber,
      ...(cursor ? { cursor } : {}),
    })) as RawEquityPositionsPayload;
    const page = parseEquityPositions(payload);
    pages.push(page.holdings);
    cursor = page.nextCursor;
    if (!cursor) break;
  }
  return mergeHoldings(pages);
}

async function replaceSnapshot(
  userId: string,
  holdings: Holding[],
  fetchedAt: Date,
): Promise<void> {
  // Wholesale replace. neon-http can't do interactive transactions; db.batch
  // runs both statements atomically.
  const del = db
    .delete(tables.brokerHoldings)
    .where(eq(tables.brokerHoldings.userId, userId));
  if (holdings.length === 0) {
    await del;
    return;
  }
  await db.batch([
    del,
    db.insert(tables.brokerHoldings).values(
      holdings.map((h) => ({
        userId,
        ticker: h.ticker,
        shares: String(h.shares),
        source: "robinhood",
        fetchedAt,
      })),
    ),
  ]);
}

/**
 * The user's broker holdings, refreshed from Robinhood when the snapshot is
 * older than 30 minutes (or `force`). Falls back to the stale snapshot when
 * the refresh can't run (expired connection, MCP failure) — flagged `stale`
 * so surfaces can label the timestamp honestly.
 */
export async function getBrokerHoldings(
  userId: string,
  opts: { force?: boolean } = {},
): Promise<HoldingsResult> {
  const connection = await getRobinhoodConnection(userId);
  if (!connection) return { connected: false };

  const snapshot = await readSnapshotRows(userId);
  const ageMs = snapshot ? Date.now() - snapshot.fetchedAt.getTime() : Infinity;
  if (snapshot && !opts.force && ageMs < STALE_MINUTES * 60 * 1000) {
    return { connected: true, ...snapshot };
  }

  const token = await getValidAccessToken(userId);
  if (token) {
    try {
      const holdings = await fetchLiveHoldings(token, connection.accountNumber);
      const fetchedAt = new Date();
      await replaceSnapshot(userId, holdings, fetchedAt);
      return { connected: true, holdings, fetchedAt, stale: false };
    } catch {
      // Fall through to stale snapshot (rate limit, transient MCP failure).
    }
  }

  if (snapshot) return { connected: true, ...snapshot, stale: true };
  return { connected: false };
}
