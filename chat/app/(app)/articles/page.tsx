import { Suspense } from "react";
import { db, tables } from "@/db";
import { desc } from "drizzle-orm";
import { searchArticles } from "@/lib/articles/search";
import { ArticlesList } from "./ArticlesList";

export const dynamic = "force-dynamic";

/** Unique non-null categories in the corpus, sorted. */
async function getCategories(): Promise<string[]> {
  const rows = await db
    .select({ category: tables.articles.category })
    .from(tables.articles)
    .orderBy(desc(tables.articles.pubDate));

  const seen = new Set<string>();
  for (const r of rows) {
    if (r.category) seen.add(r.category);
  }
  return Array.from(seen).sort();
}

async function getCorpusCount(): Promise<number> {
  const rows = await db
    .select({ id: tables.articles.id })
    .from(tables.articles);
  return rows.length;
}

export default async function ArticlesPage() {
  // Initial load: all articles newest-first (no filters).
  const [initial, allCategories, total] = await Promise.all([
    searchArticles({ limit: 50 }),
    getCategories(),
    getCorpusCount(),
  ]);

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-12">
      {/* Hero header */}
      <div className="mb-10">
        <div className="text-xs uppercase tracking-[0.18em] mb-3 text-orange">
          The library
        </div>
        <h1 className="font-serif text-5xl leading-tight tracking-tight text-cream mb-2">
          Articles
        </h1>
        <p className="text-sm text-muted tabular-nums">
          {total} distilled {total === 1 ? "article" : "articles"} from the I/O Fund research corpus
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
