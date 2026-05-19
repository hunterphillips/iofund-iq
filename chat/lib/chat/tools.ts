import { tool } from "ai";
import { and, desc, eq, gte, sql as drizzleSql } from "drizzle-orm";
import { z } from "zod";
import { db, tables } from "@/db";
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
      const conditions = [];
      if (ticker) {
        conditions.push(
          drizzleSql`${ticker.toUpperCase()} = ANY(${tables.articles.tickers})`,
        );
      }
      if (query) {
        conditions.push(
          drizzleSql`${tables.articles.title} ILIKE ${"%" + query + "%"}`,
        );
      }
      const rows = await db
        .select({
          url: tables.articles.url,
          title: tables.articles.title,
          pubDate: tables.articles.pubDate,
          tickers: tables.articles.tickers,
          category: tables.articles.category,
        })
        .from(tables.articles)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(tables.articles.pubDate))
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
      "Read the full distilled summary of a specific I/O Fund article by URL. Use after search_articles to get the actual content.",
    inputSchema: z.object({
      url: z.string().url().describe("Article URL returned by search_articles."),
    }),
    execute: async ({ url }: { url: string }) => {
      const [row] = await db
        .select({ distilledPath: tables.articles.distilledPath })
        .from(tables.articles)
        .where(eq(tables.articles.url, url))
        .limit(1);
      if (!row?.distilledPath) {
        return `No distilled article for ${url}.`;
      }
      return readDocFile(row.distilledPath);
    },
  }),
};

function readDocFile(distilledPath: string): string {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { basename, join } = require("node:path") as typeof import("node:path");
  // distilledPath like "data/articles/2026-05-07-foo.md" — strip the leading
  // "data/" since prebuild copies them under chat/_data/articles/.
  const articleFile = basename(distilledPath);
  const full = join(process.cwd(), "_data", "articles", articleFile);
  return readFileSync(full, "utf8");
}
