import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { ReadingLayout } from "@/components/reading-layout";
import { ArticlePageContext } from "./ArticlePageContext";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params;

  const [row] = await db
    .select({
      title: tables.articles.title,
      url: tables.articles.url,
      pubDate: tables.articles.pubDate,
      tickers: tables.articles.tickers,
      category: tables.articles.category,
      body: tables.articles.body,
      slug: tables.articles.slug,
    })
    .from(tables.articles)
    .where(eq(tables.articles.slug, slug))
    .limit(1);

  if (!row?.body) {
    notFound();
  }

  // Body is stored frontmatter-stripped in Postgres; stripFrontmatter stays as
  // a defensive no-op in case a legacy row still carries the YAML header.
  const bodyWithoutFrontmatter = stripFrontmatter(row.body);

  const categoryLabel = row.category
    ? row.category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Article";

  const meta = row.pubDate
    ? new Date(row.pubDate + "T00:00:00").toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : undefined;

  return (
    <>
      {/* Page-context producer for slice #9's drawer */}
      <ArticlePageContext
        slug={row.slug}
        title={row.title}
        url={row.url}
        tickers={row.tickers ?? []}
      />

      <ReadingLayout
        eyebrow={categoryLabel}
        title={row.title}
        meta={meta}
        body={bodyWithoutFrontmatter}
        backHref="/articles"
        backLabel="Articles"
        assistantCta
        footer={<ArticleFooter tickers={row.tickers ?? []} url={row.url} />}
      />
    </>
  );
}

/** Strip leading YAML frontmatter (--- ... ---) from markdown. */
function stripFrontmatter(md: string): string {
  const trimmed = md.trimStart();
  if (!trimmed.startsWith("---")) return md;
  const end = trimmed.indexOf("\n---", 3);
  if (end === -1) return md;
  return trimmed.slice(end + 4).trimStart();
}

function ArticleFooter({
  tickers,
  url,
}: {
  tickers: string[];
  url: string;
}) {
  return (
    <div className="mt-12 pt-8 border-t border-border">
      {tickers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs text-muted-deep mr-1 self-center">Covered tickers:</span>
          {tickers.map((t) => (
            <a
              key={t}
              href={`/articles?ticker=${encodeURIComponent(t)}`}
              className="text-[0.65rem] uppercase tracking-[0.1em] px-2.5 py-1 rounded border border-border text-muted-deep font-mono hover:border-orange hover:text-orange transition-colors"
            >
              {t}
            </a>
          ))}
        </div>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-orange hover:text-gold transition-colors"
      >
        Read original on io-fund.com →
      </a>
    </div>
  );
}
