import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ReadingLayout } from "@/components/reading-layout";
import { stripFrontmatter } from "@/lib/fund/markdown";

export const dynamic = "force-dynamic";

export default function ThesisPage() {
  const raw = readFileSync(
    join(process.cwd(), "_data", "io-fund-thesis.md"),
    "utf8"
  );

  const body = stripFrontmatter(raw);

  return (
    <ReadingLayout
      eyebrow="Thesis"
      title="What I/O Fund believes"
      body={body}
      backHref="/fund"
      backLabel="Fund"
      engraving="peer-review"
    />
  );
}
