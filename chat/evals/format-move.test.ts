/**
 * Pure unit tests for the recent-moves formatter. No DB, no network.
 *
 * Run:  pnpm test:format-move
 * Or:   pnpm exec tsx evals/format-move.test.ts
 *
 * Pins formatMove against the real note shapes seen in public.trades
 * (size% + kind verb, mixed casing, reversed order, redundant verbs).
 */

import { formatMove } from "@/lib/portfolio/format-move";

let failures = 0;
function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures++;
  }
}

console.log("\nformat-move unit tests");
console.log("─".repeat(50));

// ── action → label + tone ───────────────────────────────────────────────────
console.log("\n[a] action label + tone");
{
  assert(formatMove("BUY", "").label === "Buy", "BUY → Buy");
  assert(formatMove("BUY", "").tone === "buy", "BUY tone = buy");
  assert(formatMove("SELL", "").label === "Sell", "SELL → Sell");
  assert(formatMove("SELL", "").tone === "sell", "SELL tone = sell");
  assert(formatMove("HEDGE", "").label === "Hedge", "HEDGE → Hedge");
  assert(formatMove("COVER-HEDGE", "").label === "Cover", "COVER-HEDGE → Cover");
  assert(formatMove("COVER-HEDGE", "").tone === "cover", "COVER tone = cover");
  // Unknown action falls back to title-cased text, neutral tone.
  assert(formatMove("split", "").label === "Split", "unknown action title-cased");
  assert(formatMove("split", "").tone === "neutral", "unknown action neutral");
  assert(formatMove("", "").label === "—", "empty action → em dash");
}

// ── size extraction ─────────────────────────────────────────────────────────
console.log("\n[b] size percent");
{
  assert(formatMove("BUY", "1% Add").sizePct === "1%", "1% Add → 1%");
  assert(formatMove("BUY", "0.5% add").sizePct === "0.5%", "decimal percent kept");
  assert(formatMove("SELL", "Trim 3%").sizePct === "3%", "reversed order: Trim 3%");
  assert(formatMove("BUY", "Momo").sizePct === null, "no percent → null");
  assert(formatMove("BUY", "").sizePct === null, "empty note → null size");
}

// ── kind classification (case + synonyms) ───────────────────────────────────
console.log("\n[c] kind verb");
{
  assert(formatMove("BUY", "1% Add").kind === "Add", "Add");
  assert(formatMove("BUY", "2% add").kind === "Add", "lowercase add");
  assert(formatMove("BUY", "0.5% allocation").kind === "Add", "allocation → Add");
  assert(formatMove("SELL", "2% Trim").kind === "Trim", "Trim");
  assert(formatMove("SELL", "1% trim").kind === "Trim", "lowercase trim");
  assert(formatMove("SELL", "Sell Half").kind === "Trim", "half → Trim");
  assert(formatMove("SELL", "Close").kind === "Close", "Close");
  assert(formatMove("SELL", "Closed").kind === "Close", "Closed → Close");
  assert(formatMove("SELL", "closed").kind === "Close", "lowercase closed");
  assert(formatMove("SELL", "Stop hit").kind === "Stop hit", "Stop hit");
  assert(formatMove("BUY", "Momo").kind === "Momo", "Momo");
}

// ── redundant verbs + leftover detail ───────────────────────────────────────
console.log("\n[d] redundant verbs + detail");
{
  // "1% buy" restates the action — drop the verb, keep just the size.
  const m = formatMove("BUY", "1% buy");
  assert(m.sizePct === "1%" && m.kind === null && m.detail === null, "1% buy → size only");
  // Bare percent.
  const p = formatMove("BUY", "2%");
  assert(p.sizePct === "2%" && p.kind === null && p.detail === null, "bare 2%");
  // Unrecognized note becomes title-cased detail.
  const d = formatMove("BUY", "rebalance basket");
  assert(d.kind === null && d.detail === "Rebalance Basket", "unknown note → detail");
  // Phrase notes still classify by keyword.
  assert(
    formatMove("SELL", "Stop hit, closing position").kind === "Stop hit",
    "phrase note classifies to Stop hit",
  );
  // Null/undefined note is safe.
  assert(formatMove("BUY", null).kind === null, "null note safe");
  assert(formatMove("BUY", undefined).sizePct === null, "undefined note safe");
}

console.log("\n" + "─".repeat(50));
if (failures === 0) {
  console.log("All format-move tests passed.\n");
} else {
  console.error(`${failures} format-move test(s) failed.\n`);
  process.exit(1);
}
