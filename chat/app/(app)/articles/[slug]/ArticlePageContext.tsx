"use client";

/**
 * Client component that publishes the current article's context for the chat
 * surfaces to consume via usePageContext(). No visible output.
 *
 * Calls useSetPageContext on mount (cleared on unmount) so the drawer / chat
 * always know which article slug + tickers are in view. ChatThread reads
 * usePageContext() and sends it as the `x-page-context` header; /api/chat
 * injects it into the system prompt as
 *   { route: '/articles/[slug]', articleSlug, tickers }.
 */

import { useSetPageContext } from "@/lib/page-context/context";

interface Props {
  slug: string;
  tickers: string[];
}

export function ArticlePageContext({ slug, tickers }: Props) {
  // Sets context on mount, clears on unmount (navigation away).
  useSetPageContext({ route: "/articles/[slug]", articleSlug: slug, tickers });
  return null;
}
