import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ReadingLayout } from "@/components/reading-layout";
import { stripFrontmatter } from "@/lib/fund/markdown";

export const dynamic = "force-dynamic";

export default function StrategyPage() {
  const raw = readFileSync(
    join(process.cwd(), "_data", "io-fund-strategy.md"),
    "utf8"
  );
  const body = stripFrontmatter(raw);

  return (
    <ReadingLayout
      eyebrow="Strategy"
      title="How I/O Fund runs the portfolio"
      body={body}
      backHref="/fund"
      backLabel="Fund"
      engraving="book"
    />
  );
}
