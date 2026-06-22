"use client";

/**
 * Page-context system — two-sided contract between producer (pages) and
 * consumer (slice #9 drawer).
 *
 * Architecture:
 *   • <PageContextRoot> wraps the entire app layout (app/(app)/layout.tsx).
 *     It holds mutable state and exposes the context.
 *   • Pages call useSetPageContext() to publish their context on mount.
 *   • The drawer (slice #9) calls usePageContext() to read the current value
 *     and inject it as a system header per chat turn.
 *
 * No prop-drilling. Context flows from the root down to both the page subtree
 * (producer) and the drawer (consumer).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface PageContext {
  route: string;
  articleSlug?: string;
  // Human-readable article title — used for the prompt grounding and the visible
  // "Asking about …" chip in the chat. Falls back to the slug when absent.
  articleTitle?: string;
  // Canonical article URL. When present, the prompt tells the model to call
  // read_article(articleUrl) directly, skipping the search_articles hop.
  articleUrl?: string;
  tickers?: string[];
  docName?: "strategy" | "thesis";
  // Position dossier context (/positions/[ticker]): the ticker in view + its
  // company name, so chat can ground a "this position" question.
  positionTicker?: string;
  positionCompany?: string;
}

interface PageContextState {
  ctx: PageContext | null;
  setCtx: (value: PageContext | null) => void;
}

const PageContextCtx = createContext<PageContextState>({
  ctx: null,
  setCtx: () => {},
});

/** Root provider — mount once in app/(app)/layout.tsx. */
export function PageContextRoot({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<PageContext | null>(null);
  return (
    <PageContextCtx.Provider value={{ ctx, setCtx }}>
      {children}
    </PageContextCtx.Provider>
  );
}

/** Read the current page context. Returns null on non-article pages. */
export function usePageContext(): PageContext | null {
  return useContext(PageContextCtx).ctx;
}

/**
 * Publish page context from a detail page (called on mount, cleared on unmount).
 * Usage in a client component:  useSetPageContext({ route, articleSlug, tickers })
 */
export function useSetPageContext(value: PageContext | null): void {
  const { setCtx } = useContext(PageContextCtx);
  const stable = JSON.stringify(value);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setValue = useCallback(() => setCtx(value), [stable, setCtx]);

  useEffect(() => {
    setValue();
    return () => setCtx(null);
  }, [setValue, setCtx]);
}
