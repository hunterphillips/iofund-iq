import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripFrontmatter } from "./markdown";

const DATA_DIR = join(process.cwd(), "_data");

/** Strategy pull-quote: first non-empty paragraph after all headings at the top. */
export function getStrategyPullQuote(): string {
  const raw = readFileSync(join(DATA_DIR, "io-fund-strategy.md"), "utf8");
  const body = stripFrontmatter(raw);
  const lines = body.split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("#") || t === "---") continue;
    return t;
  }
  return "";
}

/** Extract the short heading label from a strategy ## heading like "## 1. Alert Semantics (load-bearing)" */
function strategyHeadingLabel(heading: string): string {
  // Remove "## N. " prefix and anything in parens at the end
  return heading
    .replace(/^#+\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/\s*\(.*?\)\s*$/, "")
    .trim();
}

/** Strategy card chips: top-level ## headings (short labels, first 6). */
export function getStrategyHeadingChips(): string[] {
  const raw = readFileSync(join(DATA_DIR, "io-fund-strategy.md"), "utf8");
  const chips: string[] = [];
  for (const line of raw.split("\n")) {
    if (/^## /.test(line)) {
      const label = strategyHeadingLabel(line);
      if (label) chips.push(label);
    }
  }
  return chips.slice(0, 6);
}

/** Thesis card: last-modified date from the frontmatter `last_distilled` field. */
export function getThesisLastModified(): string {
  const raw = readFileSync(join(DATA_DIR, "io-fund-thesis.md"), "utf8");
  const m = raw.match(/^last_distilled:\s*(\S+)/m);
  if (m) return m[1];
  // Fall back to file mtime
  try {
    const mtime = statSync(join(DATA_DIR, "io-fund-thesis.md")).mtime;
    return mtime.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

/** Thesis card chips: active themes from ## 1 section's numbered list. */
export function getThesisThemeChips(): string[] {
  const raw = readFileSync(join(DATA_DIR, "io-fund-thesis.md"), "utf8");
  const lines = raw.split("\n");
  const chips: string[] = [];
  let inThemesSection = false;

  for (const line of lines) {
    if (/^### Active themes/.test(line)) {
      inThemesSection = true;
      continue;
    }
    if (inThemesSection) {
      if (line.startsWith("#")) break;
      // Numbered list items: "1. **Label.** …" where the period is inside **
      // Pattern: **text.** or **text**
      const m = line.match(/^\d+\.\s+\*\*(.+?)\.*\*\*/);
      if (m) {
        // Strip trailing period if present
        chips.push(m[1].replace(/\.$/, "").trim());
      }
    }
  }
  return chips.slice(0, 6);
}
