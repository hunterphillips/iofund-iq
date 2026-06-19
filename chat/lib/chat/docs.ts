import { readFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "_data");

export type DocName = "strategy" | "thesis";

// Both point at the agent-only `.agent.md` docs, which carry the detailed
// decoder content (alert semantics, per-ticker conviction tables, heuristics)
// the chat agent relies on. The plain io-fund-strategy.md / io-fund-thesis.md
// are the human-facing /fund/strategy and /fund/thesis pages, not these.
const DOC_FILES: Record<DocName, string> = {
  strategy: "io-fund-strategy.agent.md",
  thesis: "io-fund-thesis.agent.md",
};

let cache: Partial<Record<DocName, string>> = {};

export function readDoc(name: DocName): string {
  if (cache[name]) return cache[name];
  const path = join(DATA_DIR, DOC_FILES[name]);
  const content = readFileSync(path, "utf8");
  cache[name] = content;
  return content;
}
