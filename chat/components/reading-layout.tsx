"use client";

import { useEffect, useRef, useState } from "react";
import { MarkdownBody } from "./markdown-body";
import { Engraving, type EngravingName } from "./engraving";
import { slugify } from "@/lib/fund/markdown";
import { openAssistant } from "@/lib/chat/open-assistant";

interface TocItem {
  id: string;
  text: string;
  level: number; // 2 = ##, 3 = ###
}

/**
 * Extract ## and ### headings from raw markdown to build a table of contents.
 * Uses the shared slugify helper so TOC hrefs match the rendered heading IDs.
 */
function extractHeadings(markdown: string): TocItem[] {
  const lines = markdown.split("\n");
  const items: TocItem[] = [];
  for (const line of lines) {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].trim();
    const id = slugify(text);
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
  footer?: React.ReactNode; // optional content appended after the prose body
  assistantCta?: boolean; // show an "Ask about this" button in the sidebar
  engraving?: EngravingName; // optional faint brand etching atop the TOC rail
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
  footer,
  assistantCta = false,
  engraving,
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
    <div className="max-w-[1100px] mx-auto px-8 pt-12 pb-28 md:pb-12">
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
          <div className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-3 text-orange">
            {eyebrow}
          </div>
          <h1 className="font-serif font-semibold text-4xl md:text-5xl leading-[1.05] tracking-[-0.02em] text-cream mb-2">
            {title}
          </h1>
          {meta && (
            <p className="text-sm text-muted mb-10 tabular-nums">{meta}</p>
          )}

          {/* Editorial prose: larger line-height, generous spacing */}
          <div className="reading-prose">
            <MarkdownBody>{body}</MarkdownBody>
          </div>

          {/* Optional footer slot (e.g. ticker chips + external link on article detail) */}
          {footer}

          {/* Mobile/tablet assistant CTA — the sidebar rail (with its own CTA) is
              hidden below lg, so surface the action inline here instead. */}
          {assistantCta && (
            <div className="lg:hidden mt-10">
              <button
                type="button"
                onClick={openAssistant}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-border text-sm font-semibold text-cream hover:border-orange hover:text-orange transition-colors"
              >
                <span className="text-orange">✦</span> Ask about this article
              </button>
            </div>
          )}
        </article>

        {/* Sticky TOC + optional assistant CTA — hidden on mobile, visible lg+ */}
        {(toc.length > 0 || assistantCta || engraving) && (
          <nav
            aria-label="Table of contents"
            className="hidden lg:block flex-none w-52 sticky top-[88px] self-start"
          >
            {engraving && (
              <Engraving
                name={engraving}
                className="w-24 h-auto opacity-[0.13] mb-7"
              />
            )}
            {toc.length > 0 && (
              <>
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
              </>
            )}

            {assistantCta && (
              <div className={toc.length > 0 ? "mt-7 pt-6 border-t border-border" : ""}>
                <button
                  type="button"
                  onClick={openAssistant}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm font-semibold text-cream hover:border-orange hover:text-orange transition-colors"
                >
                  <span className="text-orange">✦</span> Ask about this article
                </button>
              </div>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
