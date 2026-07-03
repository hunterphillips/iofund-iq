/**
 * Realized P&L — strict passthrough to Robinhood's get_realized_pnl. No
 * caching: the window is a per-question parameter, and the numbers are the
 * broker's own lot-level ledger (a true realized return — unlike the
 * fund-side price-move figures, which stay caveated).
 */

import { callRobinhoodTool } from "./mcp-client";
import { getRobinhoodConnection, getValidAccessToken } from "./connection";

export interface RealizedPnlQuery {
  span?: "day" | "week" | "month" | "3month" | "year" | "all";
  startDate?: string;
  endDate?: string;
}

export type RealizedPnlResult =
  | { connected: false; message: string }
  | { connected: true; data: unknown };

export async function getRealizedPnl(
  userId: string,
  query: RealizedPnlQuery,
): Promise<RealizedPnlResult> {
  const connection = await getRobinhoodConnection(userId);
  if (!connection) {
    return { connected: false, message: "No Robinhood connection." };
  }
  const token = await getValidAccessToken(userId);
  if (!token) {
    return {
      connected: false,
      message:
        "Robinhood connection expired — the user needs to reconnect from the account menu.",
    };
  }
  // The realized-P&L endpoint keys on the RHS account id, falling back to the
  // brokerage number for accounts where they coincide.
  const accountNumber = connection.rhsAccountNumber ?? connection.accountNumber;
  const data = await callRobinhoodTool(token, "get_realized_pnl", {
    account_number: accountNumber,
    ...(query.span ? { span: query.span } : {}),
    ...(query.startDate ? { start_date: query.startDate } : {}),
    ...(query.endDate ? { end_date: query.endDate } : {}),
  });
  return { connected: true, data };
}
