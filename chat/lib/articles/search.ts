/**
 * Shared article search lib — used by /api/articles and the integration test.
 *
 * Mirrors the FTS pattern from lib/chat/tools.ts search_articles:
 *   - websearch_to_tsquery('english', q) against body_tsv generated column
 *   - ts_rank ordering when q is present, pub_date desc otherwise
 *   - ticker filter via UPPER(ticker) = ANY(articles.tickers)
 *   - category filter via category = $cat (case-insensitive)
 *   - since filter via pub_date >= since
 *   - Limit 50 by default
 */

import { and, desc, gte, ilike, sql as drizzleSql } from "drizzle-orm";
import { db, tables } from "@/db";

export interface ArticleRow {
  url: string;
  title: string;
  slug: string;
  pubDate: string | null;
  tickers: string[] | null;
  category: string | null;
  preview: string | null; // first non-empty body line, trimmed
}

export interface SearchArticlesResult {
  rows: ArticleRow[];
  total: number;
}

export interface SearchArticlesParams {
  q?: string;
  ticker?: string;
  category?: string;
  since?: string; // ISO date YYYY-MM-DD
  limit?: number;
}

/**
 * Extract a one-line preview from raw markdown body.
 * Skips YAML frontmatter fences, blank lines, and heading/metadata lines.
 * Returns the first non-empty prose line, truncated to 160 chars.
 */
function extractPreview(body: string | null): string | null {
  if (!body) return null;
  const lines = body.split("\n");
  let inFrontmatter = false;
  let frontmatterSeen = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!frontmatterSeen && line === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter && line === "---") {
      inFrontmatter = false;
      frontmatterSeen = true;
      continue;
    }
    if (inFrontmatter) continue;
    if (!line) continue;
    if (line.startsWith("#")) continue; // skip headings
    if (line.startsWith("---")) continue;
    // Good prose line
    return line.length > 160 ? line.slice(0, 157) + "…" : line;
  }
  return null;
}

export async function searchArticles(
  params: SearchArticlesParams,
): Promise<SearchArticlesResult> {
  const { q, ticker, category, since, limit = 50 } = params;

  const tsq = q
    ? drizzleSql`websearch_to_tsquery('english', ${q})`
    : null;

  const conditions = [];

  if (ticker) {
    conditions.push(
      drizzleSql`${ticker.toUpperCase()} = ANY(${tables.articles.tickers})`,
    );
  }
  if (category) {
    conditions.push(ilike(tables.articles.category, category));
  }
  if (since) {
    conditions.push(gte(tables.articles.pubDate, since));
  }
  if (tsq) {
    conditions.push(drizzleSql`body_tsv @@ ${tsq}`);
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const orderExprs = tsq
    ? [drizzleSql`ts_rank(body_tsv, ${tsq}) DESC`, desc(tables.articles.pubDate)]
    : [desc(tables.articles.pubDate)];

  const [rows, countResult] = await Promise.all([
    db
      .select({
        url: tables.articles.url,
        title: tables.articles.title,
        slug: tables.articles.slug,
        pubDate: tables.articles.pubDate,
        tickers: tables.articles.tickers,
        category: tables.articles.category,
        body: tables.articles.body,
      })
      .from(tables.articles)
      .where(where)
      .orderBy(...orderExprs)
      .limit(limit),

    db
      .select({ count: drizzleSql<string>`COUNT(*)` })
      .from(tables.articles)
      .where(where),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return {
    rows: rows.map((r) => ({
      url: r.url,
      title: r.title,
      slug: r.slug,
      pubDate: r.pubDate,
      tickers: r.tickers,
      category: r.category,
      preview: extractPreview(r.body),
    })),
    total,
  };
}
