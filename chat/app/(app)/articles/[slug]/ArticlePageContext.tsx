"use client";

/**
 * Client component that publishes the current article's context for slice #9's
 * drawer to consume via usePageContext(). No visible output.
 *
 * Calls useSetPageContext on mount (cleared on unmount) so the drawer always
 * knows which article slug + tickers are currently in view.
 *
 * Slice #9 reads usePageContext() from lib/page-context/context.tsx to inject
 *   { route: '/articles/[slug]', articleSlug, tickers }
 * as a system header per chat turn.
 */

import { useSetPageContext } from "@/lib/page-context/context";

interface Props {
  slug: string;
  tickers: string[];
}

export function ArticlePageContext({ slug, tickers }: Props) {
  // Sets context on mount, clears on unmount (navigation away).
  // TODO(slice #9): drawer reads usePageContext() to inject into chat header.
  useSetPageContext({ route: "/articles/[slug]", articleSlug: slug, tickers });
  return null;
}
