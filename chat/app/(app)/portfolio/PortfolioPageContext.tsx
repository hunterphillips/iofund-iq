"use client";

/**
 * Client component that publishes the IOF portfolio page context for slice #9's
 * drawer to consume via usePageContext(). No visible output.
 *
 * Injects the full list of held tickers so the drawer can surface them as
 * a page-context header per chat turn.
 */

import { useSetPageContext } from "@/lib/page-context/context";

interface Props {
  tickers: string[];
}

export function PortfolioPageContext({ tickers }: Props) {
  useSetPageContext({ route: "/portfolio", tickers });
  return null;
}
