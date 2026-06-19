import { tool } from "ai";
import { and, desc, eq, gte, sql as drizzleSql } from "drizzle-orm";
import { z } from "zod";
import { db, tables } from "@/db";
import { auth } from "@/lib/auth/server";
import type { Holding } from "@/lib/portfolio/extract";
import { fetchQuotes } from "@/lib/portfolio/prices";
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
      "Compare the user's uploaded portfolio holdings against IOF's current portfolio using live market prices. Returns two lists: tickers IOF holds that the user doesn't (buy-list signal), and the overlap with weight deltas (where the user is over/under-weighted relative to IOF's sizing). Use when the user asks about THEIR portfolio, gaps, what they're missing, how their portfolio compares to IOF's, or which positions are over/under-weighted. After calling, enrich the response with thesis context per ticker via read_doc('thesis') or search_articles when relevant. Returns { connected: false } if no portfolio is uploaded — when this happens, mention they can upload a brokerage screenshot at /portfolio.",
    inputSchema: z.object({}),
    execute: async () => {
      const { data: session } = await auth.getSession();
      if (!session?.user) {
        return {
          connected: false as const,
          message: "User is not signed in.",
        };
      }

      const [row] = await db
        .select({
          holdings: tables.userHoldings.holdings,
          uploadedAt: tables.userHoldings.uploadedAt,
        })
        .from(tables.userHoldings)
        .where(eq(tables.userHoldings.userId, session.user.id))
        .limit(1);

      if (!row) {
        return {
          connected: false as const,
          message:
            "User has not uploaded a portfolio. Direct them to /portfolio to upload a brokerage screenshot.",
        };
      }

      const holdings = row.holdings as Holding[];
      const { prices, missing } = await fetchQuotes(
        holdings.map((h) => h.ticker),
      );

      // Compute live user weights from shares × current price.
      let totalValue = 0;
      const userBook = new Map<
        string,
        { shares: number; value_usd: number; weight: number }
      >();
      for (const h of holdings) {
        const upper = h.ticker.toUpperCase();
        const price = prices.get(upper);
        if (price == null) continue;
        const value = h.shares * price;
        totalValue += value;
        userBook.set(upper, { shares: h.shares, value_usd: value, weight: 0 });
      }
      for (const v of userBook.values()) {
        v.weight = totalValue > 0 ? (v.value_usd / totalValue) * 100 : 0;
      }

      const iofRows = await db
        .select({
          ticker: tables.positions.ticker,
          company: tables.positions.company,
          category: tables.positions.category,
          iofWeight: tables.positions.baselineWeightPct,
        })
        .from(tables.positions)
        .where(eq(tables.positions.status, "held"));

      const iofOnly = iofRows
        .filter((r) => !userBook.has(r.ticker.toUpperCase()))
        .map((r) => ({
          ticker: r.ticker,
          company: r.company,
          category: r.category,
          iof_weight_pct: Number(r.iofWeight),
        }));

      const overlap = iofRows
        .filter((r) => userBook.has(r.ticker.toUpperCase()))
        .map((r) => {
          const yours = userBook.get(r.ticker.toUpperCase())!;
          return {
            ticker: r.ticker,
            iof_weight_pct: Number(r.iofWeight),
            your_weight_pct: Math.round(yours.weight * 10) / 10,
            delta_pct:
              Math.round((yours.weight - Number(r.iofWeight)) * 10) / 10,
          };
        });

      return {
        connected: true as const,
        uploaded_at: row.uploadedAt,
        total_value_usd: Math.round(totalValue),
        missing_prices: missing,
        iof_only: iofOnly,
        overlap,
      };
    },
  }),
};
