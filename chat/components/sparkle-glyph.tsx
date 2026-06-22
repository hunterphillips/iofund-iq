/**
 * Two-point "sparkle" — the AI / assistant mark (a large four-point star with a
 * smaller companion). Fills with currentColor; size via className. Shared by the
 * nav assistant button, the assistant modal header, and the sign-in hero.
 */
export function SparkleGlyph({
  className = "w-[18px] h-[18px]",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10 4.5C10.7 9 13 11.3 17.5 12 13 12.7 10.7 15 10 19.5 9.3 15 7 12.7 2.5 12 7 11.3 9.3 9 10 4.5Z" />
      <path d="M18 2.5C18.3 4.2 19.3 5.2 21 5.5 19.3 5.8 18.3 6.8 18 8.5 17.7 6.8 16.7 5.8 15 5.5 16.7 5.2 17.7 4.2 18 2.5Z" />
    </svg>
  );
}
