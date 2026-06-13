"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Lightweight wrapper around react-markdown that applies the `.markdown` prose
 * class defined in globals.css. Shared by chat-thread and the fund reading pages.
 */
export function MarkdownBody({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
