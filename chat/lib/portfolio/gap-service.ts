import type { Holding } from "./gap-math";
import { computePortfolioGap } from "./compare";
import { getBrokerHoldings } from "@/lib/robinhood/holdings";

export async function analyzeGapForUser(
  userId: string,
  holdings?: Holding[],
) {
  let source: "screenshot" | "robinhood" = "screenshot";
  let fetchedAt: string | undefined;

  if (!holdings?.length) {
    const synced = await getBrokerHoldings(userId);
    if (!synced.connected) {
      return {
        connected: false as const,
        message:
          "No holdings provided and no Robinhood connection. Ask the user to attach a brokerage screenshot here in chat, or connect Robinhood from the account menu.",
      };
    }
    holdings = synced.holdings;
    source = "robinhood";
    fetchedAt = synced.fetchedAt.toISOString();
  }

  const gap = await computePortfolioGap(
    holdings.map((holding) => ({
      ...holding,
      ticker: holding.ticker.toUpperCase(),
    })),
  );

  return { connected: true as const, source, fetchedAt, ...gap };
}
