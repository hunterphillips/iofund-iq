import { formatMove, type MoveTone } from "@/lib/portfolio/format-move";

/**
 * Renders an I/O Fund trade move as discrete, normalized badges instead of the
 * raw flush "SELLclose" string: a colored action label, an optional size pill,
 * a kind verb (Add / Trim / Close / …), and any leftover detail. Pure
 * presentational — safe in both server and client trees. The parse lives in
 * lib/portfolio/format-move.ts (unit-tested).
 */

const TONE_CLASS: Record<MoveTone, string> = {
  buy: "text-cat-energy",
  sell: "text-cat-memory",
  hedge: "text-gold",
  cover: "text-cat-software",
  neutral: "text-muted",
};

export function MoveDescription({
  action,
  note,
}: {
  action: string | null | undefined;
  note: string | null | undefined;
}) {
  const m = formatMove(action, note);
  return (
    <span className="flex items-center gap-2 min-w-0 text-sm">
      <span
        className={`font-semibold uppercase text-[11px] tracking-wide ${TONE_CLASS[m.tone]}`}
      >
        {m.label}
      </span>
      {m.sizePct && (
        <span className="font-mono text-[12px] tabular-nums text-cream">
          {m.sizePct}
        </span>
      )}
      {m.kind && <span className="text-[13px] text-muted">{m.kind}</span>}
      {m.detail && (
        <span className="text-[13px] text-muted-deep truncate">{m.detail}</span>
      )}
    </span>
  );
}
