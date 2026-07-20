import { CATEGORY_COLOR_VAR } from "@/lib/portfolio/categories";
import { getDemoBook, getDemoPositionRecord } from "@/lib/demo/book";
import { formatMove } from "@/lib/portfolio/format-move";
import { derivePriceMove } from "@/lib/portfolio/price-move";

const AS_OF = "2026-07-19";
let failures = 0;

function assert(condition: boolean, label: string): void {
  if (condition) console.log(`  PASS  ${label}`);
  else {
    console.error(`  FAIL  ${label}`);
    failures++;
  }
}

function daysBefore(date: string, earlier: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000);
}

console.log("\ndemo-book unit tests");
console.log("─".repeat(50));

const book = getDemoBook(AS_OF);
const closed = ["SNOW", "DDOG"].map((ticker) => getDemoPositionRecord(ticker, AS_OF)!);
const allRecords = [...book.positions.map((p) => getDemoPositionRecord(p.ticker, AS_OF)!), ...closed];

assert(Math.abs(book.positions.reduce((sum, p) => sum + Number(p.baselineWeightPct), 0) - 100) < 0.01, "held weights sum to 100.0");
assert(new Set(allRecords.map((r) => r.position.ticker)).size === allRecords.length, "held and closed tickers are unique");
assert(book.positions.every((p) => p.category != null && p.category in CATEGORY_COLOR_VAR), "every category has a swatch");

const moves = allRecords.flatMap((record) => record.trades.map((trade) => ({ trade, formatted: formatMove(trade.action, trade.note) })));
assert(moves.every(({ formatted }) => formatted.tone !== "neutral"), "every trade has a non-neutral tone");
assert(moves.every(({ trade, formatted }) => {
  const size = trade.note?.match(/(\d+(?:\.\d+)?)\s*%/)?.[1];
  return size == null || formatted.sizePct === `${size}%`;
}), "all explicit sizes are extracted");
assert(moves.filter(({ trade }) => trade.note?.includes("Started")).every(({ formatted }) => formatted.detail === "Started"), "Started maps to Started detail");
assert(moves.filter(({ trade }) => trade.note?.includes("Add")).every(({ formatted }) => formatted.kind === "Add"), "Add maps to Add kind");
assert(moves.filter(({ trade }) => /Trim/i.test(trade.note ?? "")).every(({ formatted }) => formatted.kind === "Trim"), "Trim maps to Trim kind");
assert(moves.find(({ trade }) => trade.note === "Closed")?.formatted.kind === "Close", "Closed maps to Close kind");
assert(moves.find(({ trade }) => trade.note === "Stop hit")?.formatted.kind === "Stop hit", "Stop hit maps to Stop hit kind");

assert(book.positions.every((p) => derivePriceMove(getDemoPositionRecord(p.ticker, AS_OF)!.trades) !== null), "every held ticker has a derivable price move");
assert(book.trades.every((trade) => trade.tradeDate <= AS_OF), "recent trades do not exceed as-of date");
for (const [label, min, max] of [["0–30", 0, 30], ["31–90", 31, 90], ["91–180", 91, 180]] as const) {
  const count = book.trades.filter((trade) => {
    const age = daysBefore(AS_OF, trade.tradeDate);
    return age >= min && age <= max;
  }).length;
  assert(count >= 5, `${label} day bucket has at least five rows`);
}
assert(book.positions.every((position) => position.firstEntryDate === getDemoPositionRecord(position.ticker, AS_OF)!.trades[0].tradeDate), "first entry dates match earliest history rows");

const snow = getDemoPositionRecord("snow", AS_OF);
assert(snow?.position.status === "closed", "case-insensitive SNOW record is closed");
assert(snow?.trades.at(-1)?.action === "SELL" && snow.trades.at(-1)?.note === "Closed", "SNOW timeline ends with closing SELL");
assert(getDemoPositionRecord("unknown", AS_OF) === null, "unknown ticker returns null");

console.log("─".repeat(50));
if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll demo-book tests passed.\n");
