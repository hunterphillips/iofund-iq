import { Suspense } from "react";
import { db, tables } from "@/db";
import { count, isNotNull } from "drizzle-orm";
import { searchArticles } from "@/lib/articles/search";
import { ArticlesList } from "./ArticlesList";

export const dynamic = "force-dynamic";

/** Unique non-null categories in the corpus, sorted alphabetically. */
async function getCategories(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: tables.articles.category })
    .from(tables.articles)
    .where(isNotNull(tables.articles.category))
    .orderBy(tables.articles.category);

  return rows.map((r) => r.category as string);
}

/** Total article count in the corpus (unfiltered) — for the hero header. */
async function getCorpusTotal(): Promise<number> {
  const [row] = await db.select({ count: count() }).from(tables.articles);
  return Number(row?.count ?? 0);
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ticker?: string; category?: string; since?: string }>;
}) {
  const { q, ticker, category, since } = await searchParams;

  // SSR-filter the initial rows so deep links like /articles?ticker=NVDA
  // render the correct filtered results on first paint.
  const [initial, allCategories, corpusTotal] = await Promise.all([
    searchArticles({ q, ticker, category, since, limit: 50 }),
    getCategories(),
    getCorpusTotal(),
  ]);

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-12">
      {/* Hero header — always shows the full corpus count, not the filtered count */}
      <div className="mb-10">
        <div className="text-xs uppercase tracking-[0.18em] mb-3 text-orange">
          The library
        </div>
        <h1 className="font-serif text-5xl leading-tight tracking-tight text-cream mb-2">
          Articles
        </h1>
        <p className="text-sm text-muted tabular-nums">
          {corpusTotal} distilled {corpusTotal === 1 ? "article" : "articles"} from the I/O Fund research corpus
        </p>
      </div>

      {/* Client browse: search + chips + list */}
      <Suspense>
        <ArticlesList
          initialRows={initial.rows}
          initialTotal={initial.total}
          allCategories={allCategories}
        />
      </Suspense>
    </div>
  );
}
