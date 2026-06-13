import { Suspense } from "react";
import { db, tables } from "@/db";
import { isNotNull } from "drizzle-orm";
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

export default async function ArticlesPage() {
  // Initial load: all articles newest-first (no filters).
  // Reuse initial.total for the header count — one fewer query and the numbers
  // are guaranteed consistent.
  const [initial, allCategories] = await Promise.all([
    searchArticles({ limit: 50 }),
    getCategories(),
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
          {initial.total} distilled {initial.total === 1 ? "article" : "articles"} from the I/O Fund research corpus
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
