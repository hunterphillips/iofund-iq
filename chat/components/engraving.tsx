import type { CSSProperties } from "react";

/**
 * Engraving — classical black-ink etching illustration (Titan-inspired brand
 * device). The source PNGs in /public/engravings are transparent with dark ink,
 * so the `.engraving` class (app/globals.css) inverts them to a warm off-white
 * etching under the default warm-dark theme and keeps them as near-black ink
 * (faint sepia) under warm-light — both driven by the themed --engraving-filter.
 *
 * Purely decorative: rendered aria-hidden, non-interactive, non-draggable.
 * Opacity + sizing are caller-controlled via Tailwind utilities on `className`
 * (watermarks ~opacity-[0.08], centerpieces ~opacity-90). Always pass a width
 * utility together with `h-auto` so the 1:1 source keeps its aspect ratio.
 */

export type EngravingName =
  | "owl"
  | "book"
  | "hourglass"
  | "colosseum"
  | "peer-review";

export function Engraving({
  name,
  className = "",
  style,
  width = 500,
  height = 500,
}: {
  name: EngravingName;
  className?: string;
  style?: CSSProperties;
  width?: number;
  height?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- decorative static asset; next/image adds no value and isn't used elsewhere in the app
    <img
      src={`/engravings/${name}.png`}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className={`engraving ${className}`}
      style={style}
    />
  );
}

/**
 * RuleOrnament — a centered classical hairline divider with a small diamond
 * ornament, echoing engraving-era typography. Use sparingly to break a long
 * editorial scroll.
 */
export function RuleOrnament({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-4 text-muted-deep ${className}`}
      aria-hidden="true"
    >
      <span className="h-px flex-1 bg-border" />
      <span className="font-serif text-sm leading-none select-none">❖</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
