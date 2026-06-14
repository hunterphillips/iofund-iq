/**
 * Shared markdown utilities used across lib/fund and the reading components.
 */

/** Strip YAML frontmatter (--- ... ---) from markdown. */
export function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return content;
  return content.slice(end + 4).trimStart();
}

/**
 * Slugify a heading string into a URL-safe anchor ID.
 * Algorithm: lowercase → strip non-alphanumeric-non-space chars → spaces to hyphens → collapse runs.
 * Must be used in both the TOC builder (reading-layout.tsx) and the markdown
 * heading renderer (markdown-body.tsx) so that href="#slug" matches id="slug".
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
