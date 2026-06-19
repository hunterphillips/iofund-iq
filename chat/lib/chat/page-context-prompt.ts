/**
 * Per-turn page-context injection for the chat system prompt.
 *
 * The drawer (and /chat) send an `x-page-context` header describing what the
 * user is currently looking at. `/api/chat` parses it and calls
 * `buildSystemPrompt(SYSTEM_PROMPT, ctx)` to prepend a single concise context
 * block BEFORE invoking streamText. The drawer never mutates the prompt itself —
 * the API route is the sole owner of injection logic (this module).
 *
 * `buildSystemPrompt` is intentionally PURE (no I/O, no DB) so it can be unit
 * tested directly in evals/page-context.test.ts without an LLM round-trip.
 */

import type { PageContext } from "@/lib/page-context/context";

/**
 * Returns `base` unchanged when `ctx` is null/absent; otherwise prepends a
 * single-line-ish context block naming the route and any page specifics
 * (article slug + tickers, portfolio tickers, or fund doc name) so the model
 * can ground its answer in what the user is viewing.
 */
export function buildSystemPrompt(
  base: string,
  ctx: PageContext | null | undefined,
): string {
  if (!ctx || typeof ctx.route !== "string" || !ctx.route) return base;

  const block = describeContext(ctx);
  if (!block) return base;

  return `${block}\n\n${base}`;
}

function describeContext(ctx: PageContext): string {
  const tickers = (ctx.tickers ?? []).filter(
    (t): t is string => typeof t === "string" && t.trim().length > 0,
  );

  switch (ctx.route) {
    case "/articles/[slug]": {
      const slug = ctx.articleSlug ? ` "${ctx.articleSlug}"` : "";
      const tail = tickers.length
        ? ` It references these tickers: ${tickers.join(", ")}.`
        : "";
      return (
        `[Page context] The user is viewing the I/O Fund article${slug} ` +
        `(route /articles/[slug]). Its distilled body is available via the ` +
        `search_articles + read_article tools — search for this article and ` +
        `read it before answering questions about "this article" or "the takeaway".${tail}`
      );
    }

    case "/portfolio": {
      const tail = tickers.length
        ? ` The IOF portfolio currently in view holds: ${tickers.join(", ")}.`
        : "";
      return (
        `[Page context] The user is viewing the I/O Fund portfolio ` +
        `(route /portfolio).${tail} Ground answers about "the portfolio", ` +
        `"top positions", or "the book" in these current holdings, not defaults.`
      );
    }

    case "/fund/strategy": {
      return (
        `[Page context] The user is viewing the I/O Fund strategy doc ` +
        `(route /fund/strategy). Prefer read_doc('strategy') for framework, ` +
        `sizing, and hedging questions about what they're reading.`
      );
    }

    case "/fund/thesis": {
      return (
        `[Page context] The user is viewing the I/O Fund thesis doc ` +
        `(route /fund/thesis). Prefer read_doc('thesis') for per-ticker ` +
        `conviction context about what they're reading.`
      );
    }

    default: {
      // Fall back to docName if a producer published one without a known route.
      if (ctx.docName === "strategy" || ctx.docName === "thesis") {
        return (
          `[Page context] The user is viewing the I/O Fund ${ctx.docName} doc. ` +
          `Prefer read_doc('${ctx.docName}') for questions about what they're reading.`
        );
      }
      // Unrecognized route with no doc specifics (e.g. /chat, /fund, /profile):
      // emit nothing so buildSystemPrompt falls back to the base prompt. A generic
      // "user is on /X" line is pure noise for the model.
      return "";
    }
  }
}
