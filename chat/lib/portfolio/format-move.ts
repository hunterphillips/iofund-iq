/**
 * format-move — pure, unit-tested normalizer for an I/O Fund trade "move".
 *
 * The `trades` table stores `action` and `note` as separate free-text columns
 * (action ∈ BUY/SELL/HEDGE/COVER-HEDGE; note like "1% Add", "0.5% trim",
 * "Closed", "Momo", "Trim 3%", "Stop hit", or ""). Rendered flush, those read as
 * "SELLclose" / "BUY1% Add" with mixed casing. The note is actually semi-
 * structured — a size percent plus a kind verb — so we parse it into clean
 * fields the UI renders as discrete badges.
 *
 * No DB / React import — tested directly in evals/format-move.test.ts.
 */

export type MoveTone = "buy" | "sell" | "hedge" | "cover" | "neutral";

export interface FormattedMove {
  /** Normalized action label, e.g. "Buy" / "Sell" / "Hedge" / "Cover". */
  label: string;
  /** Color tone for the action badge. */
  tone: MoveTone;
  /** Size of the move if the note carried one, e.g. "4%" / "0.5%"; else null. */
  sizePct: string | null;
  /** Canonical kind verb, e.g. "Add" / "Trim" / "Close" / "Stop hit" / "Momo". */
  kind: string | null;
  /** Any leftover note text we didn't recognize, title-cased; else null. */
  detail: string | null;
}

const SIZE_RE = /(\d+(?:\.\d+)?)\s*%/;

/** Map a free-text note remainder to a canonical kind verb. */
function classifyKind(words: string): string | null {
  const w = words.toLowerCase();
  if (/stop\s*hit/.test(w)) return "Stop hit";
  if (/close|closed|closing/.test(w)) return "Close";
  if (/trim|half/.test(w)) return "Trim";
  if (/add|adding|allocation/.test(w)) return "Add";
  if (/momo/.test(w)) return "Momo";
  return null;
}

/** Title-case a short phrase ("closing position" → "Closing Position"). */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatMove(
  action: string | null | undefined,
  note: string | null | undefined,
): FormattedMove {
  const a = (action ?? "").trim().toUpperCase();
  let label: string;
  let tone: MoveTone;
  if (a.startsWith("BUY")) {
    label = "Buy";
    tone = "buy";
  } else if (a.startsWith("SELL")) {
    label = "Sell";
    tone = "sell";
  } else if (a.startsWith("HEDGE")) {
    label = "Hedge";
    tone = "hedge";
  } else if (a.startsWith("COVER")) {
    label = "Cover";
    tone = "cover";
  } else {
    label = action ? titleCase(action.trim()) : "—";
    tone = "neutral";
  }

  const raw = (note ?? "").trim();
  const sizeMatch = raw.match(SIZE_RE);
  const sizePct = sizeMatch ? `${sizeMatch[1]}%` : null;

  // Strip the size token + parens, collapse whitespace, then classify.
  const rest = raw
    .replace(SIZE_RE, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const kind = classifyKind(rest);

  let detail: string | null = null;
  if (!kind) {
    // Drop verbs that just restate the action ("1% buy" → size only).
    const cleaned = rest
      .replace(/\b(buy|sell|bought|sold)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    detail = cleaned ? titleCase(cleaned) : null;
  }

  return { label, tone, sizePct, kind, detail };
}
