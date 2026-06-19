"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ComponentPropsWithoutRef } from "react";
import { slugify } from "@/lib/fund/markdown";

/** Extract a plain-text string from ReactMarkdown children (string | ReactNode[]). */
function textOf(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children
      .map((child) => (typeof child === "string" ? child : ""))
      .join("");
  }
  return "";
}

function H2({ children, ...props }: ComponentPropsWithoutRef<"h2">) {
  const id = slugify(textOf(children));
  return (
    <h2 id={id || undefined} {...props}>
      {children}
    </h2>
  );
}

function H3({ children, ...props }: ComponentPropsWithoutRef<"h3">) {
  const id = slugify(textOf(children));
  return (
    <h3 id={id || undefined} {...props}>
      {children}
    </h3>
  );
}

/**
 * Lightweight wrapper around react-markdown that applies the `.markdown` prose
 * class defined in globals.css. Shared by chat-thread and the fund reading pages.
 *
 * `headingAnchors` (default true) slugifies h2/h3 into `id` attributes so reading
 * pages' TOC anchors resolve. Chat messages pass `false`: heading ids are
 * document-global, and two assistant messages with the same heading text would
 * otherwise collide.
 */
export function MarkdownBody({
  children,
  headingAnchors = true,
}: {
  children: string;
  headingAnchors?: boolean;
}) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={headingAnchors ? { h2: H2, h3: H3 } : undefined}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
