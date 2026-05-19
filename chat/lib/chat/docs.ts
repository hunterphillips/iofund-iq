import { readFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "_data");

export type DocName = "strategy" | "thesis";

const DOC_FILES: Record<DocName, string> = {
  strategy: "io-fund-strategy.md",
  thesis: "io-fund-thesis.md",
};

let cache: Partial<Record<DocName, string>> = {};

export function readDoc(name: DocName): string {
  if (cache[name]) return cache[name];
  const path = join(DATA_DIR, DOC_FILES[name]);
  const content = readFileSync(path, "utf8");
  cache[name] = content;
  return content;
}
