import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ReadingLayout } from "@/components/reading-layout";

export const dynamic = "force-dynamic";

function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return content;
  return content.slice(end + 4).trimStart();
}

export default function ThesisPage() {
  const raw = readFileSync(
    join(process.cwd(), "_data", "io-fund-thesis.md"),
    "utf8"
  );

  const body = stripFrontmatter(raw);

  // Extract last_distilled from frontmatter for the meta line
  const lastDistilledMatch = raw.match(/^last_distilled:\s*(\S+)/m);
  const lastDistilled = lastDistilledMatch ? lastDistilledMatch[1] : null;

  return (
    <ReadingLayout
      eyebrow="Thesis"
      title="Conviction History & Theme Evolution"
      meta={lastDistilled ? `Last distilled: ${lastDistilled}` : undefined}
      body={body}
      backHref="/fund"
      backLabel="Fund"
    />
  );
}
