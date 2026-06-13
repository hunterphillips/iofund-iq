/**
 * Integration test for searchArticles() against the real Neon DB.
 *
 * Run:  pnpm test:articles
 * Or:   pnpm exec tsx --env-file=.env.local evals/articles-api.test.ts
 *
 * Assertions:
 *   (a) Result shape: rows array with expected fields + numeric total
 *   (b) Composed filters narrow the result set
 *   (c) searchArticles({ q: 'optical' }) returns rows whose tickers include AOSL, COHR, or LITE
 */

import { searchArticles } from "@/lib/articles/search";

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures++;
  }
}

async function main() {
  console.log("\narticles-api integration test");
  console.log("─".repeat(50));

  // ── (a) Result shape ───────────────────────────────────────────────────────
  console.log("\n[a] Result shape");
  const all = await searchArticles({});
  assert(Array.isArray(all.rows), "rows is an array");
  assert(typeof all.total === "number", "total is a number");
  assert(all.total > 0, `total > 0 (got ${all.total})`);
  assert(all.rows.length > 0, `rows.length > 0 (got ${all.rows.length})`);

  if (all.rows.length > 0) {
    const r = all.rows[0];
    assert(typeof r.slug === "string", "row has slug (string)");
    assert(typeof r.title === "string", "row has title (string)");
    assert(typeof r.url === "string", "row has url (string)");
    assert(
      r.pubDate === null || typeof r.pubDate === "string",
      "row has pubDate (string|null)",
    );
    assert(
      r.tickers === null || Array.isArray(r.tickers),
      "row has tickers (array|null)",
    );
    assert(
      r.category === null || typeof r.category === "string",
      "row has category (string|null)",
    );
    assert(
      r.preview === null || typeof r.preview === "string",
      "row has preview (string|null)",
    );
  }

  // Rows ordered newest-first by default.
  if (all.rows.length >= 2) {
    const d0 = all.rows[0].pubDate ?? "";
    const d1 = all.rows[1].pubDate ?? "";
    assert(d0 >= d1, `rows ordered newest-first (${d0} >= ${d1})`);
  }

  // ── (b) Composed filters narrow results ────────────────────────────────────
  console.log("\n[b] Composed filters narrow results");

  const nvda = await searchArticles({ ticker: "NVDA" });
  assert(nvda.total > 0, `ticker=NVDA returns results (got ${nvda.total})`);
  assert(
    nvda.total <= all.total,
    `ticker=NVDA (${nvda.total}) <= all (${all.total})`,
  );
  if (nvda.rows.length > 0) {
    const tickersIncludeNVDA = nvda.rows.every(
      (r) => r.tickers?.includes("NVDA"),
    );
    assert(tickersIncludeNVDA, "all ticker=NVDA rows include NVDA in tickers");
  }

  const aiStocks = await searchArticles({ category: "ai-stocks" });
  assert(
    aiStocks.total > 0,
    `category=ai-stocks returns results (got ${aiStocks.total})`,
  );
  assert(
    aiStocks.total <= all.total,
    `category=ai-stocks (${aiStocks.total}) <= all (${all.total})`,
  );

  // Combined ticker + category should be <= ticker-only
  const nvdaAi = await searchArticles({ ticker: "NVDA", category: "ai-stocks" });
  assert(
    nvdaAi.total <= nvda.total,
    `ticker+category (${nvdaAi.total}) <= ticker-only (${nvda.total})`,
  );

  // Since filter
  const recent = await searchArticles({ since: "2026-05-01" });
  const older = await searchArticles({ since: "2026-01-01" });
  assert(
    recent.total <= older.total,
    `since=2026-05-01 (${recent.total}) <= since=2026-01-01 (${older.total})`,
  );
  if (recent.rows.length > 0) {
    const allAfterMay = recent.rows.every(
      (r) => (r.pubDate ?? "") >= "2026-05-01",
    );
    assert(allAfterMay, "all since=2026-05-01 rows have pubDate >= 2026-05-01");
  }

  // ── (c) optical → AOSL/COHR/LITE ──────────────────────────────────────────
  console.log('\n[c] searchArticles({ q: "optical" }) surfaces AOSL/COHR/LITE');

  const optical = await searchArticles({ q: "optical" });
  assert(optical.total > 0, `q=optical returns results (got ${optical.total})`);

  const opticalTickers = new Set(
    optical.rows.flatMap((r) => r.tickers ?? []),
  );
  console.log(
    `    optical tickers found: ${Array.from(opticalTickers).join(", ")}`,
  );
  assert(
    opticalTickers.has("COHR") || opticalTickers.has("LITE") || opticalTickers.has("AOSL"),
    "optical results include at least one of AOSL, COHR, LITE",
  );

  // Log the matching titles for transparency
  if (optical.rows.length > 0) {
    console.log("    Matching articles:");
    for (const r of optical.rows.slice(0, 5)) {
      console.log(`      ${r.pubDate}  ${r.title}  [${(r.tickers ?? []).join(", ")}]`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(50));
  if (failures === 0) {
    console.log("All assertions passed.");
  } else {
    console.error(`${failures} assertion(s) FAILED.`);
  }
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(2);
});
