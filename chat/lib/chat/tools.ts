import { tool } from "ai";
import { and, desc, eq, gte, sql as drizzleSql } from "drizzle-orm";
import { z } from "zod";
import { db, tables } from "@/db";
import { auth } from "@/lib/auth/server";
import type { Holding } from "@/lib/portfolio/gap-math";
import { computePortfolioGap } from "@/lib/portfolio/compare";
import { getBrokerHoldings } from "@/lib/robinhood/holdings";
import { getRealizedPnl } from "@/lib/robinhood/pnl";
import { readDoc, type DocName } from "./docs";

export const chatTools = {
  read_doc: tool({
    description:
      "Read one of the two distilled I/O Fund knowledge docs. Use 'strategy' for the alert-decoding, sizing-rules, and hedging framework. Use 'thesis' for per-ticker conviction state, theme evolution, and decision-reasoning patterns.",
    inputSchema: z.object({
      name: z
        .enum(["strategy", "thesis"])
        .describe("Which distilled doc to read."),
    }),
    execute: async ({ name }: { name: DocName }) => {
      return readDoc(name);
    },
  }),

  query_trades: tool({
    description:
      "Query I/O Fund's official trade log. Use this to answer questions about specific positions, recent activity in a ticker, or what IOF has been buying/selling/trimming. Returns ordered by most-recent trade_date first.",
    inputSchema: z.object({
      ticker: z
        .string()
        .optional()
        .describe(
          "Stock ticker (e.g. 'NVDA', 'TSM'). Case-insensitive. Omit to query across all tickers.",
        ),
      since: z
        .string()
        .optional()
        .describe(
          "ISO date (YYYY-MM-DD). Returns trades on/after this date. Omit for all-time.",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(25)
        .describe("Max rows to return (1-100). Default 25."),
    }),
    execute: async ({
      ticker,
      since,
      limit,
    }: {
      ticker?: string;
      since?: string;
      limit: number;
    }) => {
      const conditions = [];
      if (ticker) {
        conditions.push(
          drizzleSql`upper(${tables.trades.ticker}) = ${ticker.toUpperCase()}`,
        );
      }
      if (since) {
        conditions.push(gte(tables.trades.tradeDate, since));
      }
      const rows = await db
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

      if (rows.length === 0) {
        return "No matching trades.";
      }

      return rows
        .map(
          (r) =>
            `${r.date} · ${r.ticker} · ${r.action}${
              r.price ? ` @ ${r.price}` : ""
            }${r.note ? ` (${r.note})` : ""}${
              r.analyst ? ` — ${r.analyst}` : ""
            }`,
        )
        .join("\n");
    },
  }),

  search_articles: tool({
    description:
      "Search distilled summaries of I/O Fund articles by topic, ticker, or theme. Returns matching titles + URLs, newest first. Use whenever the user asks about IOF's analysis or commentary on a stock, sector, or theme. Pair with read_article to fetch the full distilled summary.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe(
          "Free-text keyword(s) for theme/topic search (e.g. 'optical networking', 'AI energy', 'CPO'). Omit when filtering by ticker only.",
        ),
      ticker: z
        .string()
        .optional()
        .describe(
          "Stock ticker (e.g. 'NVDA', 'BE'). Case-insensitive. Use when the user mentions a specific company; prefer this over query when you know the ticker.",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Max rows to return (1-50). Default 10."),
    }),
    execute: async ({
      query,
      ticker,
      limit,
    }: {
      query?: string;
      ticker?: string;
      limit: number;
    }) => {
      // Postgres FTS on title + body via the body_tsv generated column.
      // ts_rank ordering surfaces the most relevant article first; ties
      // break on recency. When no query is given, fall back to recency.
      const tsq = query
        ? drizzleSql`websearch_to_tsquery('english', ${query})`
        : null;

      const conditions = [];
      if (ticker) {
        conditions.push(
          drizzleSql`${ticker.toUpperCase()} = ANY(${tables.articles.tickers})`,
        );
      }
      if (tsq) {
        conditions.push(drizzleSql`body_tsv @@ ${tsq}`);
      }

      const rankExpr = tsq
        ? drizzleSql<number>`ts_rank(body_tsv, ${tsq})`
        : drizzleSql<number>`0`;

      const orderExprs = tsq
        ? [drizzleSql`ts_rank(body_tsv, ${tsq}) DESC`, desc(tables.articles.pubDate)]
        : [desc(tables.articles.pubDate)];

      const rows = await db
        .select({
          url: tables.articles.url,
          title: tables.articles.title,
          pubDate: tables.articles.pubDate,
          tickers: tables.articles.tickers,
          category: tables.articles.category,
          rank: rankExpr,
        })
        .from(tables.articles)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(...orderExprs)
        .limit(limit);

      if (rows.length === 0) return "No matching articles.";

      return rows
        .map(
          (r) =>
            `${r.pubDate} · ${r.title}${
              r.tickers?.length ? ` [${r.tickers.join(", ")}]` : ""
            } → ${r.url}`,
        )
        .join("\n");
    },
  }),

  read_article: tool({
    description:
      "Read the full distilled summary of a specific I/O Fund article by URL. Use after search_articles to get the actual content. Returns { found: true, title, pub_date, body } on success; { found: false } when the URL isn't in the index. URLs the agent has read are surfaced to the user as clickable sources automatically — don't paste URLs inline in the response.",
    inputSchema: z.object({
      url: z.string().url().describe("Article URL returned by search_articles."),
    }),
    execute: async ({ url }: { url: string }) => {
      const [row] = await db
        .select({
          title: tables.articles.title,
          pubDate: tables.articles.pubDate,
          body: tables.articles.body,
        })
        .from(tables.articles)
        .where(eq(tables.articles.url, url))
        .limit(1);
      if (!row?.body) {
        return {
          found: false as const,
          message: `No distilled article for ${url}.`,
        };
      }
      return {
        found: true as const,
        title: row.title,
        pub_date: row.pubDate,
        body: row.body,
      };
    },
  }),

  analyze_portfolio_gap: tool({
    description:
      "Compare the user's portfolio holdings against IOF's current portfolio using live market prices. Returns two lists: tickers IOF holds that the user doesn't (buy-list signal), and the overlap with weight deltas (where the user is over/under-weighted relative to IOF's sizing). Use when the user asks about THEIR portfolio, gaps, what they're missing, how their portfolio compares to IOF's, or which positions are over/under-weighted. Holdings come from one of two places: (1) if the user has connected Robinhood, call with NO holdings and their synced positions are used automatically; (2) otherwise the user attaches a portfolio/brokerage screenshot in chat — read each holding's ticker + share count from it and pass them as `holdings` (explicit holdings always win over the sync). After calling, enrich the response with thesis context per ticker via read_doc('thesis') or search_articles when relevant. Returns { connected: false } when neither source is available — then ask the user to attach a brokerage screenshot here in chat, or connect Robinhood from the account menu.",
    inputSchema: z.object({
      holdings: z
        .array(
          z.object({
            ticker: z.string().min(1).max(10),
            shares: z.number().positive(),
          }),
        )
        .optional()
        .describe(
          "Holdings read from a portfolio image the user attached this turn (ticker uppercased + share count). Omit entirely when the user has a Robinhood connection and attached no image.",
        ),
    }),
    execute: async ({ holdings }: { holdings?: Holding[] }) => {
      const { data: session } = await auth.getSession();
      if (!session?.user) {
        return {
          connected: false as const,
          message: "User is not signed in.",
        };
      }

      let source: "screenshot" | "robinhood" = "screenshot";
      let fetchedAt: string | undefined;
      if (!holdings?.length) {
        const synced = await getBrokerHoldings(session.user.id);
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
        holdings.map((h) => ({ ...h, ticker: h.ticker.toUpperCase() })),
      );

      return { connected: true as const, source, fetchedAt, ...gap };
    },
  }),

  get_my_portfolio: tool({
    description:
      "Read the user's current Robinhood holdings (ticker + share count) from their connected account. Synced from the broker, at most 30 minutes old. Use for 'what do I hold?', 'how many shares of X do I have?', and as raw material for custom analysis. For a full comparison against I/O Fund's portfolio, prefer analyze_portfolio_gap. Returns { connected: false } when the user hasn't connected Robinhood.",
    inputSchema: z.object({}),
    execute: async () => {
      const { data: session } = await auth.getSession();
      if (!session?.user) {
        return { connected: false as const, message: "User is not signed in." };
      }
      const result = await getBrokerHoldings(session.user.id);
      if (!result.connected) {
        return {
          connected: false as const,
          message:
            "No Robinhood connection. The user can connect from the account menu, or attach a portfolio screenshot instead.",
        };
      }
      return {
        connected: true as const,
        as_of: result.fetchedAt.toISOString(),
        stale: result.stale,
        holdings: result.holdings,
      };
    },
  }),

  get_my_realized_pnl: tool({
    description:
      "The user's realized profit & loss from their connected Robinhood account: per-bucket realized gain ($ and %), closing-trade counts, and window totals, computed by the broker from actual closed lots. This is a TRUE realized return for the user's own trading (unlike fund-side price moves, which are not return estimates). Use for 'how did my trades do this month/quarter/year?'. Pick either a preset span or explicit start/end dates, not both.",
    inputSchema: z.object({
      span: z
        .enum(["day", "week", "month", "3month", "year", "all"])
        .optional()
        .describe("Preset window. Defaults to 3month (last 90 days)."),
      start_date: z
        .string()
        .optional()
        .describe("Custom window start, YYYY-MM-DD. Use with end_date instead of span."),
      end_date: z
        .string()
        .optional()
        .describe("Custom window end, YYYY-MM-DD, inclusive."),
    }),
    execute: async ({
      span,
      start_date,
      end_date,
    }: {
      span?: "day" | "week" | "month" | "3month" | "year" | "all";
      start_date?: string;
      end_date?: string;
    }) => {
      const { data: session } = await auth.getSession();
      if (!session?.user) {
        return { connected: false as const, message: "User is not signed in." };
      }
      return getRealizedPnl(session.user.id, {
        span,
        startDate: start_date,
        endDate: end_date,
      });
    },
  }),
};
