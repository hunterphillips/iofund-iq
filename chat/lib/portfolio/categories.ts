/**
 * Single source of truth for category → swatch color, shared by the positions
 * table, the portfolio pie/theme charts, and the Fund KPI dots. Values point at
 * the globals.css --color-cat-* tokens, so swatches re-theme with light/dark.
 */

export const CATEGORY_COLOR_VAR: Record<string, string> = {
  "AI Accelerators": "var(--color-cat-accelerators)",
  "AI Networking": "var(--color-cat-networking)",
  "AI Memory": "var(--color-cat-memory)",
  "AI Energy": "var(--color-cat-energy)",
  "AI Software": "var(--color-cat-software)",
  "AI Semis": "var(--color-cat-semis)",
  Cryptocurrency: "var(--color-cat-crypto)",
};

export const OTHER_CATEGORY_COLOR_VAR = "var(--color-cat-other)";

export function categoryColorVar(category: string | null | undefined): string {
  if (!category) return OTHER_CATEGORY_COLOR_VAR;
  return CATEGORY_COLOR_VAR[category] ?? OTHER_CATEGORY_COLOR_VAR;
}

/**
 * User-facing label for a category. Strips the redundant "AI " prefix — the
 * whole tracked book is AI, so "AI Networking" reads better as "Networking".
 * The canonical "AI …" name stays in the DB + taxonomy (and as the color-map
 * key), so always pass the raw category to categoryColorVar for the swatch.
 */
export function categoryLabel(category: string): string {
  return category.replace(/^AI /, "");
}
