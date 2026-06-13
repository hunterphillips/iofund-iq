import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIGESTS_DIR = join(process.cwd(), "_data", "digests");

export interface DigestMeta {
  date: string; // YYYY-MM-DD filename stem
  summary: string; // first non-empty line after the frontmatter (## Week at a glance body)
  tickers: string[]; // uppercase tickers extracted from "New trades" section
  slug: string; // same as date, used for the URL
}

export interface DigestFull extends DigestMeta {
  body: string; // raw markdown, frontmatter stripped
}

/** Strip YAML frontmatter (--- ... ---) from markdown. */
function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return content;
  return content.slice(end + 4).trimStart();
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
 * Looks for bold ticker symbols like **PLTR**, **RDDT**, etc.
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

    // Match **TICKER** patterns (2-5 uppercase letters/digits)
    const matches = line.matchAll(/\*\*([A-Z]{2,5})\*\*/g);
    for (const m of matches) {
      const t = m[1];
      if (!seen.has(t)) {
        seen.add(t);
        tickers.push(t);
      }
    }
  }
  return tickers;
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
  };
}
