import { z } from "zod";
import type { Holding } from "@/lib/portfolio/gap-math";
import { requireIofEntitlement } from "./auth";

export type McpToolGate = "iof" | "broker" | "none";

export interface McpToolDef {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  gate: McpToolGate;
  execute(userId: string, args: any): Promise<unknown>;
}

export interface RunToolDependencies {
  hasIofEntitlement(userId: string): Promise<boolean>;
  hasBrokerConnection(userId: string): Promise<boolean>;
}

const defaultDependencies: RunToolDependencies = {
  hasIofEntitlement: requireIofEntitlement,
  async hasBrokerConnection(userId) {
    const { hasRobinhoodConnection } = await import(
      "@/lib/robinhood/connection"
    );
    return hasRobinhoodConnection(userId);
  },
};

const NOT_ENTITLED = {
  error: "not_entitled" as const,
  message:
    "This key's user has no I/O Fund credentials connected. Connect them in the app at /onboarding/connect-iof.",
};

const BROKER_NOT_CONNECTED = {
  error: "broker_not_connected" as const,
  message:
    "This key's user has no Robinhood connection. Connect Robinhood in the app from the account menu.",
};

const UPSTREAM_UNAVAILABLE = {
  error: "upstream_unavailable" as const,
  message: "The requested data is temporarily unavailable. Try again shortly.",
};

/** Enforce one declarative gate before invoking a tool implementation. */
export async function runTool(
  def: McpToolDef,
  userId: string,
  args: unknown,
  dependencies: RunToolDependencies = defaultDependencies,
): Promise<unknown> {
  try {
    if (
      def.gate === "iof" &&
      !(await dependencies.hasIofEntitlement(userId))
    ) {
      return NOT_ENTITLED;
    }
    if (
      def.gate === "broker" &&
      !(await dependencies.hasBrokerConnection(userId))
    ) {
      return BROKER_NOT_CONNECTED;
    }
    return await def.execute(userId, args);
  } catch {
    return UPSTREAM_UNAVAILABLE;
  }
}

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: "get_fund_book",
    description:
      "Read the I/O Fund's current portfolio, category weights, summary statistics, and recent trades.",
    schema: {},
    gate: "iof",
    async execute() {
      const { getIofBook } = await import("@/lib/portfolio/iof-book");
      return getIofBook();
    },
  },
  {
    name: "get_position",
    description:
      "Read the fund's position details, trade history, related distilled articles, and recorded price move for one ticker.",
    schema: {
      ticker: z.string().min(1).max(10).describe("Stock ticker."),
    },
    gate: "iof",
    async execute(_userId, { ticker }: { ticker: string }) {
      const { getPositionDetail } = await import(
        "@/lib/portfolio/position-detail"
      );
      const result = await getPositionDetail(ticker);
      return (
        result ?? {
          error: "not_found",
          message: `No fund position was found for ${ticker.toUpperCase()}.`,
        }
      );
    },
  },
  {
    name: "query_trades",
    description:
      "Query the I/O Fund's official trade log, newest first. Each row includes normalized move labels and sizing fields.",
    schema: {
      ticker: z
        .string()
        .optional()
        .describe("Case-insensitive stock ticker. Omit for all tickers."),
      since: z
        .string()
        .optional()
        .describe("Return trades on or after this ISO date (YYYY-MM-DD)."),
      limit: z.number().int().min(1).max(100).default(25),
    },
    gate: "iof",
    async execute(
      _userId,
      args: { ticker?: string; since?: string; limit?: number },
    ) {
      const [{ queryTrades }, { formatMove }] = await Promise.all([
        import("@/lib/portfolio/trades-query"),
        import("@/lib/portfolio/format-move"),
      ]);
      const rows = await queryTrades(args);
      return {
        rows: rows.map((row) => ({
          ...row,
          ...formatMove(row.action, row.note),
        })),
      };
    },
  },
  {
    name: "list_digests",
    description: "List the available weekly fund digests, newest first.",
    schema: {},
    gate: "iof",
    async execute() {
      const { listDigests } = await import("@/lib/fund/digests");
      return listDigests();
    },
  },
  {
    name: "get_digest",
    description:
      "Read a weekly fund digest by date. Omit the date to read the latest digest.",
    schema: {
      date: z
        .string()
        .optional()
        .describe("Digest date in YYYY-MM-DD format. Omit for the latest."),
    },
    gate: "iof",
    async execute(_userId, { date }: { date?: string }) {
      const { listDigests, readDigest } = await import("@/lib/fund/digests");
      const selectedDate = date ?? listDigests()[0]?.date;
      const digest = selectedDate ? readDigest(selectedDate) : null;
      return (
        digest ?? {
          error: "not_found",
          message: selectedDate
            ? `No digest was found for ${selectedDate}.`
            : "No digests are available.",
        }
      );
    },
  },
  {
    name: "read_doc",
    description:
      "Read a distilled fund reference. Strategy covers alert semantics and sizing rules; thesis covers conviction and theme reasoning.",
    schema: {
      name: z.enum(["strategy", "thesis"]),
    },
    gate: "iof",
    async execute(_userId, { name }: { name: "strategy" | "thesis" }) {
      const { readDoc } = await import("@/lib/chat/docs");
      return readDoc(name);
    },
  },
  {
    name: "search_articles",
    description:
      "Search transformative, distilled summaries of paid I/O Fund articles by topic or ticker. Returns matching metadata, not source prose.",
    schema: {
      query: z.string().optional().describe("Topic or theme search terms."),
      ticker: z
        .string()
        .optional()
        .describe("Case-insensitive stock ticker."),
      limit: z.number().int().min(1).max(50).default(10),
    },
    gate: "iof",
    async execute(
      _userId,
      args: { query?: string; ticker?: string; limit?: number },
    ) {
      const { searchArticles } = await import("@/lib/articles/search");
      return searchArticles(args);
    },
  },
  {
    name: "read_article",
    description:
      "Read the transformative distilled summary of one paid I/O Fund article by its canonical URL.",
    schema: {
      url: z.url().describe("Canonical article URL from search_articles."),
    },
    gate: "iof",
    async execute(_userId, { url }: { url: string }) {
      const { readArticleByUrl } = await import("@/lib/articles/search");
      return readArticleByUrl(url);
    },
  },
  {
    name: "analyze_portfolio_gap",
    description:
      "Compare a user's holdings with the fund's current portfolio. Explicit ticker and share counts win; otherwise the synced Robinhood snapshot is used. Weights use live server-side prices.",
    schema: {
      holdings: z
        .array(
          z.object({
            ticker: z.string().min(1).max(10),
            shares: z.number().positive(),
          }),
        )
        .optional()
        .describe(
          "Explicit ticker and share-count holdings. Omit to use the synced Robinhood snapshot.",
        ),
    },
    gate: "iof",
    async execute(userId, { holdings }: { holdings?: Holding[] }) {
      if (!holdings?.length) {
        const { hasRobinhoodConnection } = await import(
          "@/lib/robinhood/connection"
        );
        if (!(await hasRobinhoodConnection(userId))) {
          return BROKER_NOT_CONNECTED;
        }
      }

      const { analyzeGapForUser } = await import(
        "@/lib/portfolio/gap-service"
      );
      const result = await analyzeGapForUser(userId, holdings);
      return result.connected ? result : UPSTREAM_UNAVAILABLE;
    },
  },
  {
    name: "get_my_holdings",
    description:
      "Read the user's current Robinhood ticker and share-count snapshot. Successful results include the timestamp and any stale-data flag.",
    schema: {},
    gate: "broker",
    async execute(userId) {
      const { getBrokerHoldings } = await import(
        "@/lib/robinhood/holdings"
      );
      const result = await getBrokerHoldings(userId);
      if (!result.connected) return UPSTREAM_UNAVAILABLE;
      return {
        connected: true,
        as_of: result.fetchedAt.toISOString(),
        stale: result.stale,
        holdings: result.holdings,
      };
    },
  },
  {
    name: "get_quotes",
    description:
      "Look up current Yahoo Finance prices for listed or crypto tickers. Quotes are about 15 minutes delayed during market hours.",
    schema: {
      tickers: z.array(z.string()).min(1).max(30),
    },
    gate: "none",
    async execute(_userId, { tickers }: { tickers: string[] }) {
      const { fetchQuotes } = await import("@/lib/portfolio/prices");
      const { prices, missing } = await fetchQuotes(tickers);
      return { prices: Object.fromEntries(prices), missing };
    },
  },
];
