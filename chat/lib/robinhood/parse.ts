/**
 * Pure parsers for Robinhood MCP payloads — no I/O, no DB import, unit-tested
 * in evals/robinhood.test.ts against captured fixtures (same pattern as
 * gap-math.ts / format-move.ts).
 */

import type { Holding } from "@/lib/portfolio/gap-math";

export interface RawEquityPosition {
  symbol?: string;
  quantity?: string;
  type?: string;
}

export interface RawEquityPositionsPayload {
  positions?: RawEquityPosition[];
  /** Pagination: URL whose `cursor` query param feeds the next request. */
  next?: string | null;
}

export interface ParsedPositionsPage {
  holdings: Holding[];
  nextCursor: string | null;
}

/**
 * One page of get_equity_positions → holdings. Long positions only (shorts
 * don't belong in a "what am I holding vs the fund" diff), zero/garbage
 * quantities dropped, symbols uppercased. Duplicate symbols within a page are
 * summed (defensive; not observed in practice).
 */
export function parseEquityPositions(
  payload: RawEquityPositionsPayload,
): ParsedPositionsPage {
  const bySymbol = new Map<string, number>();
  for (const p of payload.positions ?? []) {
    if (!p.symbol) continue;
    if (p.type && p.type !== "long") continue;
    const shares = Number(p.quantity);
    if (!Number.isFinite(shares) || shares <= 0) continue;
    const ticker = p.symbol.toUpperCase();
    bySymbol.set(ticker, (bySymbol.get(ticker) ?? 0) + shares);
  }
  return {
    holdings: [...bySymbol.entries()].map(([ticker, shares]) => ({
      ticker,
      shares,
    })),
    nextCursor: extractCursor(payload.next),
  };
}

function extractCursor(next: string | null | undefined): string | null {
  if (!next) return null;
  try {
    return new URL(next).searchParams.get("cursor");
  } catch {
    // Already a bare cursor value rather than a URL.
    return next;
  }
}

/** Merge holdings pages, summing shares on ticker collisions. */
export function mergeHoldings(pages: Holding[][]): Holding[] {
  const bySymbol = new Map<string, number>();
  for (const page of pages) {
    for (const h of page) {
      bySymbol.set(h.ticker, (bySymbol.get(h.ticker) ?? 0) + h.shares);
    }
  }
  return [...bySymbol.entries()].map(([ticker, shares]) => ({ ticker, shares }));
}

export interface RawAccount {
  account_number?: string;
  rhs_account_number?: string;
  brokerage_account_type?: string;
  type?: string;
  is_default?: boolean;
  state?: string;
  deactivated?: boolean;
  nickname?: string;
}

export interface PickedAccount {
  accountNumber: string;
  rhsAccountNumber: string | null;
}

/**
 * Choose the account the snapshot tracks: the default active brokerage
 * account, falling back to the first active individual one. (Users with
 * multiple accounts they want aggregated is a deferred feature.)
 */
export function pickDefaultAccount(
  accounts: RawAccount[],
): PickedAccount | null {
  const usable = accounts.filter(
    (a) => a.account_number && a.state === "active" && !a.deactivated,
  );
  const chosen =
    usable.find((a) => a.is_default) ??
    usable.find((a) => a.brokerage_account_type === "individual") ??
    usable[0];
  if (!chosen?.account_number) return null;
  return {
    accountNumber: chosen.account_number,
    rhsAccountNumber: chosen.rhs_account_number ?? null,
  };
}
