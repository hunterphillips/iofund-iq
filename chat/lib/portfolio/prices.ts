/**
 * Fetches current market prices from Yahoo Finance's public chart endpoint.
 * No API key, no auth — same pattern as scripts/ingest_trades.py calling
 * IOF's Firebase endpoints directly. Returns prices keyed by the input
 * ticker (as provided) so callers don't need to know about the Yahoo-side
 * rewrite for crypto symbols.
 *
 * Latency: ~200-500ms for 30 tickers in parallel. Yahoo's chart endpoint
 * is unauthenticated and has been stable for many years. Quotes are 15-min
 * delayed during market hours.
 */
const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const UA = "Mozilla/5.0 (compatible; iofund-agent/0.1)";

/** IOF stores direct-crypto tickers as e.g. BTCUSD; Yahoo uses BTC-USD. */
const TICKER_REMAP: Record<string, string> = {
  BTCUSD: "BTC-USD",
  ETHUSD: "ETH-USD",
  LINKUSD: "LINK-USD",
};

export function toYahooSymbol(ticker: string): string {
  return TICKER_REMAP[ticker.toUpperCase()] ?? ticker;
}

export interface QuoteResult {
  /** Map from input ticker (uppercased, as-provided) to current USD price. */
  prices: Map<string, number>;
  /** Tickers Yahoo didn't recognize or that failed transport. */
  missing: string[];
}

export async function fetchQuotes(tickers: string[]): Promise<QuoteResult> {
  const unique = Array.from(new Set(tickers.map((t) => t.toUpperCase())));
  if (unique.length === 0) return { prices: new Map(), missing: [] };

  const results = await Promise.all(
    unique.map(async (ticker) => {
      const symbol = toYahooSymbol(ticker);
      const url = `${CHART_URL}/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
      try {
        const r = await fetch(url, { headers: { "User-Agent": UA } });
        if (!r.ok) return { ticker, price: null as number | null };
        const j = (await r.json()) as {
          chart?: {
            result?: Array<{ meta?: { regularMarketPrice?: number } }>;
          };
        };
        const price = j.chart?.result?.[0]?.meta?.regularMarketPrice;
        return { ticker, price: typeof price === "number" ? price : null };
      } catch {
        return { ticker, price: null };
      }
    }),
  );

  const prices = new Map<string, number>();
  const missing: string[] = [];
  for (const r of results) {
    if (r.price != null) prices.set(r.ticker, r.price);
    else missing.push(r.ticker);
  }
  return { prices, missing };
}
