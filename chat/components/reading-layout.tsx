"use client";

import { useEffect, useRef, useState } from "react";
import { MarkdownBody } from "./markdown-body";

interface TocItem {
  id: string;
  text: string;
  level: number; // 2 = ##, 3 = ###
}

/**
 * Extract ## and ### headings from raw markdown to build a table of contents.
 * Generates slugified IDs that match react-markdown's default anchor rendering.
 */
function extractHeadings(markdown: string): TocItem[] {
  const lines = markdown.split("\n");
  const items: TocItem[] = [];
  for (const line of lines) {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].trim();
    // Slug: lowercase, strip non-alphanumeric except spaces, replace spaces with -
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    items.push({ id, text, level });
  }
  return items;
}

interface ReadingLayoutProps {
  eyebrow: string;
  title: string;
  meta?: string; // subtitle / date line
  body: string;
  backHref?: string;
  backLabel?: string;
}

/**
 * Reading-optimized layout: centered ~720px content column with a sticky
 * table-of-contents aside on desktop. Used by /fund/strategy, /fund/thesis,
 * and /fund/digests/[date].
 */
export function ReadingLayout({
  eyebrow,
  title,
  meta,
  body,
  backHref = "/fund",
  backLabel = "Fund",
}: ReadingLayoutProps) {
  const toc = extractHeadings(body);
  const [activeId, setActiveId] = useState<string>("");
  const articleRef = useRef<HTMLElement>(null);

  // Intersection observer to highlight the current heading in the TOC.
  useEffect(() => {
    const el = articleRef.current;
    if (!el || toc.length === 0) return;

    const headings = Array.from(
      el.querySelectorAll<HTMLElement>("h2, h3")
    );

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "0px 0px -60% 0px", threshold: 0 }
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [toc.length]);

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-12">
      {/* Back breadcrumb */}
      <a
        href={backHref}
        className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-muted hover:text-cream transition-colors mb-10"
      >
        <span aria-hidden="true">←</span> {backLabel}
      </a>

      <div className="flex gap-16 items-start">
        {/* Main content column */}
        <article
          ref={articleRef}
          className="min-w-0 flex-1 max-w-[720px]"
        >
          <div className="text-xs uppercase tracking-[0.18em] mb-3 text-orange">
            {eyebrow}
          </div>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-cream mb-2">
            {title}
          </h1>
          {meta && (
            <p className="text-sm text-muted mb-10 tabular-nums">{meta}</p>
          )}

          {/* Editorial prose: larger line-height, generous spacing */}
          <div className="reading-prose">
            <MarkdownBody>{body}</MarkdownBody>
          </div>
        </article>

        {/* Sticky TOC — hidden on mobile, visible md+ */}
        {toc.length > 0 && (
          <nav
            aria-label="Table of contents"
            className="hidden lg:block flex-none w-52 sticky top-8 self-start"
          >
            <div className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-deep mb-3">
              On this page
            </div>
            <ul className="flex flex-col gap-1">
              {toc.map((item) => (
                <li key={item.id} style={{ paddingLeft: item.level === 3 ? "0.75rem" : "0" }}>
                  <a
                    href={`#${item.id}`}
                    className={
                      "block text-xs leading-snug py-0.5 transition-colors hover:text-cream " +
                      (activeId === item.id ? "text-gold" : "text-muted")
                    }
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}
