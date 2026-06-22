/**
 * Unit test for buildSystemPrompt() — the PURE per-turn page-context injection
 * applied in /api/chat (lib/chat/page-context-prompt.ts).
 *
 * Run:  pnpm test:page-context
 * Or:   pnpm exec tsx --env-file=.env.local evals/page-context.test.ts
 *
 * No LLM / DB calls. This satisfies the slice #9 AC: "the per-turn context block
 * appears in the system prompt when the header is set." The route provably
 * injects this block (system: buildSystemPrompt(SYSTEM_PROMPT, parsedCtx)) and
 * the drawer provably sends the x-page-context header, so the live LLM behavior
 * is satisfied structurally by these assertions + the wiring.
 *
 * Assertions:
 *   (a) buildSystemPrompt(base, null) === base  (no header → prompt unchanged)
 *   (b) article context → result CONTAINS base AND names the article/route
 *   (c) portfolio context → block names the in-view tickers
 *   (d) {docName:'strategy'} context → block names the strategy doc
 */

import { buildSystemPrompt } from "@/lib/chat/page-context-prompt";

const BASE = "SYSTEM PROMPT BASE — sentinel.";

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures++;
  }
}

function main() {
  console.log("\npage-context buildSystemPrompt unit test");
  console.log("─".repeat(50));

  // ── (a) null context → unchanged ───────────────────────────────────────────
  console.log("\n[a] null context leaves the base prompt unchanged");
  assert(buildSystemPrompt(BASE, null) === BASE, "null → identical base");
  assert(
    buildSystemPrompt(BASE, undefined) === BASE,
    "undefined → identical base",
  );

  // ── (b) article context ────────────────────────────────────────────────────
  console.log("\n[b] article context");
  const article = buildSystemPrompt(BASE, {
    route: "/articles/[slug]",
    articleSlug: "nvda-deep-dive",
    tickers: ["NVDA"],
  });
  assert(article.includes(BASE), "result still contains the base prompt");
  assert(article !== BASE, "result differs from the base (block prepended)");
  assert(
    article.includes("/articles/[slug]"),
    "block names the article route",
  );
  assert(
    article.includes("nvda-deep-dive"),
    "block names the article slug",
  );
  assert(
    article.includes("read_article"),
    "block points the model at read_article",
  );
  assert(article.includes("NVDA"), "block lists the article tickers");
  assert(
    !article.includes("read_article(\""),
    "without a URL, block does NOT hardcode a read_article(url) call",
  );

  // ── (b2) article context WITH canonical URL ────────────────────────────────
  console.log("\n[b2] article context with url");
  const articleUrl = "https://io-fund.com/some/nvda-deep-dive";
  const articleWithUrl = buildSystemPrompt(BASE, {
    route: "/articles/[slug]",
    articleSlug: "nvda-deep-dive",
    articleUrl,
    tickers: ["NVDA"],
  });
  assert(
    articleWithUrl.includes(`read_article("${articleUrl}")`),
    "with a URL, block points the model straight at read_article(url)",
  );
  assert(
    !articleWithUrl.includes("search_articles"),
    "with a URL, block drops the search_articles hop",
  );

  // ── (b3) article context prefers the title over the slug ───────────────────
  console.log("\n[b3] article context prefers title");
  const articleTitled = buildSystemPrompt(BASE, {
    route: "/articles/[slug]",
    articleSlug: "nvda-deep-dive",
    articleTitle: "NVIDIA's Q1 blowout",
    tickers: ["NVDA"],
  });
  assert(
    articleTitled.includes("NVIDIA's Q1 blowout"),
    "block names the article title when present",
  );
  assert(
    !articleTitled.includes("nvda-deep-dive"),
    "block uses the title instead of the slug",
  );

  // ── (c) portfolio context ──────────────────────────────────────────────────
  console.log("\n[c] portfolio context");
  const portfolio = buildSystemPrompt(BASE, {
    route: "/portfolio",
    tickers: ["NVDA", "TSM", "PLTR"],
  });
  assert(portfolio.includes(BASE), "result still contains the base prompt");
  assert(portfolio.includes("/portfolio"), "block names the portfolio route");
  assert(portfolio.includes("NVDA"), "block names ticker NVDA");
  assert(portfolio.includes("TSM"), "block names ticker TSM");
  assert(portfolio.includes("PLTR"), "block names ticker PLTR");

  // ── (d) strategy doc context ───────────────────────────────────────────────
  console.log("\n[d] strategy doc context");
  const strategy = buildSystemPrompt(BASE, {
    route: "/fund/strategy",
    docName: "strategy",
  });
  assert(strategy.includes(BASE), "result still contains the base prompt");
  assert(strategy.includes("strategy"), "block names the strategy doc");
  assert(
    strategy.includes("read_doc"),
    "block points the model at read_doc",
  );

  // docName-only fallback (no recognized route) also names the doc.
  const strategyFallback = buildSystemPrompt(BASE, {
    route: "/some/other/page",
    docName: "strategy",
  });
  assert(
    strategyFallback.includes("strategy") && strategyFallback.includes(BASE),
    "docName fallback names the strategy doc + keeps base",
  );

  // ── (e) unrecognized route, no doc specifics → base unchanged ───────────────
  console.log("\n[e] unrecognized route with no docName leaves base unchanged");
  assert(
    buildSystemPrompt(BASE, { route: "/chat" }) === BASE,
    "/chat → identical base (no noise block)",
  );
  assert(
    buildSystemPrompt(BASE, { route: "/profile" }) === BASE,
    "/profile → identical base (no noise block)",
  );

  console.log("\n" + "─".repeat(50));
  if (failures === 0) {
    console.log("All assertions passed.");
  } else {
    console.error(`${failures} assertion(s) FAILED.`);
  }
  process.exit(failures > 0 ? 1 : 0);
}

main();
