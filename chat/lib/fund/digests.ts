import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { stripFrontmatter } from "./markdown";

const DIGESTS_DIR = join(process.cwd(), "_data", "digests");

export interface DigestMeta {
  date: string; // YYYY-MM-DD filename stem
  summary: string; // first non-empty line after the frontmatter (## Week at a glance body)
  tickers: string[]; // uppercase tickers extracted from "New trades" section
  slug: string; // same as date, used for the URL
}

/** A bolded-lead bullet pulled from the "Themes & patterns" section. */
export interface DigestHighlight {
  lead: string; // the bolded lead phrase, period stripped
  rest: string; // the remaining sentence(s)
}

export interface DigestFull extends DigestMeta {
  body: string; // raw markdown, frontmatter stripped
  highlights: DigestHighlight[]; // up to 3, from "Themes & patterns"
  newTradesCount: number; // items under "## New trades"
  newArticlesCount: number; // items under "## New articles"
}

/**
 * Extract the paragraph body under the first `## Week at a glance` heading.
 * Returns the first non-empty, non-heading, non-hr line.
 */
function extractSummary(body: string): string {
  const lines = body.split("\n");
  let inSection = false;
  for (const line of lines) {
    if (line.startsWith("## Week at a glance")) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (line.startsWith("##") || line.startsWith("---")) break;
      const trimmed = line.trim();
      if (trimmed) return trimmed;
    }
  }
  // Fallback: first non-empty non-heading line
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed !== "---") return trimmed;
  }
  return "";
}

/**
 * Extract uppercase tickers from the "## New trades" section.
 * Trade lines have the format: - **YYYY-MM-DD · TICKER · ACTION @ $price**
 * We match the ticker sitting between two middot (·) separators.
 */
function extractTickers(body: string): string[] {
  const lines = body.split("\n");
  const tickers: string[] = [];
  const seen = new Set<string>();
  let inSection = false;

  for (const line of lines) {
    if (line.startsWith("## New trades")) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("##")) break;
    if (!inSection) continue;

    // Match ticker between middot separators: · TICKER ·
    const m = line.match(/·\s+([A-Z]{1,5})\s+·/);
    if (m) {
      const t = m[1];
      if (!seen.has(t)) {
        seen.add(t);
        tickers.push(t);
      }
    }
  }
  return tickers;
}

/**
 * Pull up to `limit` bolded-lead bullets from the "## Themes & patterns"
 * section, e.g. `- **Optical leads.** The week clustered around …` →
 * { lead: "Optical leads", rest: "The week clustered around …" }.
 */
function extractHighlights(body: string, limit = 3): DigestHighlight[] {
  const lines = body.split("\n");
  const out: DigestHighlight[] = [];
  let inSection = false;

  for (const line of lines) {
    if (line.startsWith("## Themes & patterns")) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    if (line.startsWith("##")) break;

    const m = line.match(/^[-*]\s+\*\*(.+?)\*\*\s*(.*)$/);
    if (m) {
      const lead = m[1].replace(/[.:]\s*$/, "").trim();
      const rest = m[2].replace(/^[—–-]\s*/, "").trim();
      out.push({ lead, rest });
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Count top-level list items (`- `/`* `) under a `## <heading>` section. */
function countSectionItems(body: string, heading: string): number {
  const lines = body.split("\n");
  let inSection = false;
  let count = 0;

  for (const line of lines) {
    if (line.startsWith(`## ${heading}`)) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    if (line.startsWith("##")) break;
    if (/^[-*]\s+/.test(line)) count += 1;
  }
  return count;
}

/** List all digest files sorted newest first by date (filename stem). */
export function listDigests(): DigestMeta[] {
  let files: string[];
  try {
    files = readdirSync(DIGESTS_DIR).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }

  files.sort((a, b) => b.localeCompare(a)); // descending by date string

  return files.map((filename) => {
    const date = filename.replace(/\.md$/, "");
    const raw = readFileSync(join(DIGESTS_DIR, filename), "utf8");
    const body = stripFrontmatter(raw);
    return {
      date,
      slug: date,
      summary: extractSummary(body),
      tickers: extractTickers(body),
    };
  });
}

/** Read a single digest by date slug (YYYY-MM-DD). Returns null if not found. */
export function readDigest(slug: string): DigestFull | null {
  const filename = `${slug}.md`;
  let raw: string;
  try {
    raw = readFileSync(join(DIGESTS_DIR, filename), "utf8");
  } catch {
    return null;
  }
  const body = stripFrontmatter(raw);
  return {
    date: slug,
    slug,
    summary: extractSummary(body),
    tickers: extractTickers(body),
    body,
    highlights: extractHighlights(body),
    newTradesCount: countSectionItems(body, "New trades"),
    newArticlesCount: countSectionItems(body, "New articles"),
  };
}
