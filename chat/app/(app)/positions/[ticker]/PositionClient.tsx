"use client";

/**
 * Client island for the position dossier: publishes the page context (so chat
 * grounds "this position" questions — see lib/chat/page-context-prompt.ts) and
 * renders the "Ask about {ticker}" CTA that opens the assistant modal.
 */

import { useSetPageContext } from "@/lib/page-context/context";
import { openAssistant } from "@/lib/chat/open-assistant";

export function PositionClient({
  ticker,
  company,
}: {
  ticker: string;
  company: string | null;
}) {
  useSetPageContext({
    route: "/positions/[ticker]",
    positionTicker: ticker,
    positionCompany: company ?? undefined,
  });

  return (
    <button
      type="button"
      onClick={openAssistant}
      className="inline-flex items-center gap-2 text-[13px] font-semibold px-4 py-2 rounded-full border border-border bg-surface-2/60 text-cream hover:border-orange hover:text-orange transition-colors"
    >
      <span className="text-orange">✦</span> Ask about {ticker}
    </button>
  );
}
