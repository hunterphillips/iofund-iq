/**
 * One-shot seed: bulk-load data/iofund-trades.csv into public.trades.
 *
 * Run from `chat/`:
 *   node --experimental-strip-types scripts/seed-trades.ts
 *
 * Idempotent: ID is sha256(date|action|ticker|price|note|analyst) so re-runs
 * dedupe via ON CONFLICT DO NOTHING.
 */
import { config as loadEnv } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

loadEnv({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(process.env.DATABASE_URL);

interface TradeRow {
  date: string;
  action: string;
  ticker: string;
  price: string;
  note: string;
  analyst: string;
}

const csvPath = join(process.cwd(), "..", "data", "iofund-trades.csv");
const csvText = readFileSync(csvPath, "utf8");
const rows = parse(csvText, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
}) as TradeRow[];

console.log(`Parsed ${rows.length} rows from ${csvPath}`);

function tradeId(r: TradeRow): string {
  return createHash("sha256")
    .update([r.date, r.action, r.ticker, r.price, r.note, r.analyst].join("|"))
    .digest("hex")
    .slice(0, 16);
}

const BATCH = 200;
let inserted = 0;

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const values = batch.map((r) => [
    tradeId(r),
    r.date,
    r.ticker,
    r.action,
    r.price === "" ? null : r.price,
    r.note === "" ? null : r.note,
    r.analyst === "" ? null : r.analyst,
  ]);

  const placeholders = values
    .map(
      (_, j) =>
        `($${j * 7 + 1},$${j * 7 + 2},$${j * 7 + 3},$${j * 7 + 4},$${j * 7 + 5},$${j * 7 + 6},$${j * 7 + 7})`,
    )
    .join(",");
  const params = values.flat();

  const result = await sql.query(
    `INSERT INTO trades (id, trade_date, ticker, action, price, note, analyst)
     VALUES ${placeholders}
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    params,
  );
  inserted += result.length;
  process.stdout.write(
    `\r  batch ${Math.min(i + BATCH, rows.length)} / ${rows.length}`,
  );
}

process.stdout.write("\n");

const [{ count }] = (await sql.query(
  "SELECT count(*)::int AS count FROM trades",
)) as Array<{ count: number }>;

console.log(
  `Inserted ${inserted} new rows · ${rows.length - inserted} skipped (already present) · trades table now has ${count} rows total`,
);
