"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import type { Holding } from "@/lib/portfolio/extract";

type Mode = "settings" | "onboarding";

interface Props {
  mode: Mode;
  initial: {
    holdings: Holding[];
    uploadedAt: string; // ISO
    source: string;
  } | null;
}

type EditableRow = {
  id: string;
  ticker: string;
  shares: string;
};

type State =
  | { stage: "idle"; error?: string }
  | { stage: "extracting" }
  | {
      stage: "review";
      rows: EditableRow[];
      prices: Record<string, number>;
      missingPrices: string[];
      notes?: string;
      /** Tracks how this review state was entered (used as the source string on save). */
      source: string;
      saving?: boolean;
      error?: string;
    }
  | {
      stage: "saved";
      holdings: Holding[];
      uploadedAt: string;
      source: string;
    };

let nextRowId = 0;
function newRowId(): string {
  return `r${++nextRowId}`;
}

const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 8 * 1024 * 1024;

export function PortfolioForm({ mode, initial }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFetchRef = useRef<Map<string, AbortController>>(new Map());

  /**
   * Source of truth for "does the DB have a saved portfolio for this user?"
   * — independent of which UI stage is showing. Lets Discard / cancel
   * paths restore the saved state without re-fetching from the server.
   */
  const [savedSnapshot, setSavedSnapshot] = useState<{
    holdings: Holding[];
    uploadedAt: string;
    source: string;
  } | null>(initial ?? null);

  const [state, setState] = useState<State>(() =>
    initial
      ? {
          stage: "saved",
          holdings: initial.holdings,
          uploadedAt: initial.uploadedAt,
          source: initial.source,
        }
      : { stage: "idle" },
  );
  const [dragOver, setDragOver] = useState(false);

  /** Return to saved view if data exists; otherwise drop back to idle. */
  function backToSavedOrIdle() {
    if (savedSnapshot) {
      setState({ stage: "saved", ...savedSnapshot });
    } else {
      setState({ stage: "idle" });
    }
  }

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      setState({ stage: "idle", error: "Image is too large (max 8 MB)." });
      return;
    }
    if (!ACCEPT.split(",").includes(file.type)) {
      setState({
        stage: "idle",
        error: "Unsupported image type. Use PNG, JPEG, or WebP.",
      });
      return;
    }
    setState({ stage: "extracting" });

    const form = new FormData();
    form.append("file", file);
    const r = await fetch("/api/portfolio/extract", {
      method: "POST",
      body: form,
    });
    const body = (await r.json()) as
      | {
          holdings: Holding[];
          notes?: string;
          prices: Record<string, number>;
          missing_prices: string[];
        }
      | { error: string };
    if (!r.ok || "error" in body) {
      setState({
        stage: "idle",
        error: "error" in body ? body.error : "Extraction failed.",
      });
      return;
    }
    setState({
      stage: "review",
      rows: body.holdings.map((h) => ({
        id: newRowId(),
        ticker: h.ticker,
        shares: String(h.shares),
      })),
      prices: body.prices,
      missingPrices: body.missing_prices,
      notes: body.notes,
      source: `screenshot:${new Date().toISOString()}`,
    });
  }

  async function editSaved() {
    if (state.stage !== "saved") return;
    const tickers = state.holdings.map((h) => h.ticker);
    // Fetch fresh prices so the editable table shows current values immediately.
    let prices: Record<string, number> = {};
    let missing: string[] = [];
    if (tickers.length > 0) {
      try {
        const r = await fetch(
          `/api/portfolio/quotes?tickers=${encodeURIComponent(tickers.join(","))}`,
        );
        if (r.ok) {
          const body = (await r.json()) as {
            prices: Record<string, number>;
            missing: string[];
          };
          prices = body.prices;
          missing = body.missing;
        }
      } catch {
        /* Show edit table even if quote fetch fails; prices column will be — */
      }
    }
    setState({
      stage: "review",
      rows: state.holdings.map((h) => ({
        id: newRowId(),
        ticker: h.ticker,
        shares: String(h.shares),
      })),
      prices,
      missingPrices: missing,
      source: `manual_edit:${new Date().toISOString()}`,
    });
  }

  function onFilePick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  }

  async function fetchPriceFor(ticker: string) {
    if (state.stage !== "review") return;
    const upper = ticker.toUpperCase();
    if (state.prices[upper] != null) return;

    // Cancel any in-flight fetch for the same ticker.
    pendingFetchRef.current.get(upper)?.abort();
    const ac = new AbortController();
    pendingFetchRef.current.set(upper, ac);

    try {
      const r = await fetch(
        `/api/portfolio/quotes?tickers=${encodeURIComponent(upper)}`,
        { signal: ac.signal },
      );
      if (!r.ok) return;
      const body = (await r.json()) as {
        prices: Record<string, number>;
        missing: string[];
      };
      setState((s) => {
        if (s.stage !== "review") return s;
        const nextPrices = { ...s.prices, ...body.prices };
        const nextMissing = body.missing.includes(upper)
          ? Array.from(new Set([...s.missingPrices, upper]))
          : s.missingPrices.filter((t) => t !== upper);
        return { ...s, prices: nextPrices, missingPrices: nextMissing };
      });
    } catch {
      /* aborted or transport error — ignore */
    } finally {
      pendingFetchRef.current.delete(upper);
    }
  }

  function updateRow(id: string, field: "ticker" | "shares", value: string) {
    setState((s) => {
      if (s.stage !== "review") return s;
      const rows = s.rows.map((r) =>
        r.id === id ? { ...r, [field]: value } : r,
      );
      return { ...s, rows };
    });
    if (field === "ticker") {
      const upper = value.trim().toUpperCase();
      if (upper.length >= 1 && upper.length <= 10) {
        void fetchPriceFor(upper);
      }
    }
  }

  function addRow() {
    setState((s) => {
      if (s.stage !== "review") return s;
      return {
        ...s,
        rows: [...s.rows, { id: newRowId(), ticker: "", shares: "" }],
      };
    });
  }

  function removeRow(id: string) {
    setState((s) => {
      if (s.stage !== "review") return s;
      return { ...s, rows: s.rows.filter((r) => r.id !== id) };
    });
  }

  function discardReview() {
    backToSavedOrIdle();
  }

  async function saveReview() {
    if (state.stage !== "review") return;
    const cleaned: Holding[] = [];
    for (const r of state.rows) {
      const ticker = r.ticker.trim().toUpperCase();
      const shares = Number(r.shares);
      if (!ticker || !Number.isFinite(shares) || shares <= 0) {
        setState({
          ...state,
          error: "Each row needs a ticker and a positive share count.",
        });
        return;
      }
      cleaned.push({ ticker, shares });
    }
    if (cleaned.length === 0) {
      setState({ ...state, error: "Add at least one holding before saving." });
      return;
    }
    setState({ ...state, saving: true, error: undefined });

    const source = state.source;
    const r = await fetch("/api/portfolio/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdings: cleaned, source }),
    });
    if (!r.ok) {
      const body = (await r.json().catch(() => null)) as
        | { error?: string }
        | null;
      setState({
        ...state,
        saving: false,
        error: body?.error ?? "Save failed.",
      });
      return;
    }
    const body = (await r.json()) as { uploadedAt: string };

    const snapshot = {
      holdings: cleaned,
      uploadedAt: body.uploadedAt,
      source,
    };
    setSavedSnapshot(snapshot);

    if (mode === "onboarding") {
      router.replace("/");
      router.refresh();
      return;
    }
    setState({ stage: "saved", ...snapshot });
  }

  async function clearSaved() {
    const ok = confirm("Remove your saved portfolio?");
    if (!ok) return;
    const r = await fetch("/api/portfolio", { method: "DELETE" });
    if (r.ok) {
      setSavedSnapshot(null);
      setState({ stage: "idle" });
    }
  }

  function replaceSaved() {
    setState({ stage: "idle" });
  }

  function skipOnboarding() {
    router.replace("/");
  }

  // -------- render --------

  if (state.stage === "idle" || state.stage === "extracting") {
    const isExtracting = state.stage === "extracting";
    return (
      <div className="portfolio">
        <div
          className={`dropzone${dragOver ? " dropzone-over" : ""}${isExtracting ? " dropzone-busy" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !isExtracting && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          {isExtracting ? (
            <span className="dropzone-label">Reading your screenshot…</span>
          ) : (
            <>
              <span className="dropzone-label">
                Drop a screenshot of your holdings here
              </span>
              <span className="dropzone-sub">
                or click to choose a file · PNG, JPEG, or WebP up to 8 MB
              </span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={onFilePick}
            style={{ display: "none" }}
            disabled={isExtracting}
          />
        </div>
        {state.stage === "idle" && state.error ? (
          <p className="field-error">{state.error}</p>
        ) : null}
        {state.stage === "idle" && savedSnapshot ? (
          <button
            className="link"
            type="button"
            onClick={backToSavedOrIdle}
          >
            Cancel — keep current portfolio ({savedSnapshot.holdings.length} holdings)
          </button>
        ) : null}
        {mode === "onboarding" ? (
          <button
            className="link"
            type="button"
            onClick={skipOnboarding}
            disabled={isExtracting}
          >
            Skip for now
          </button>
        ) : null}
      </div>
    );
  }

  if (state.stage === "review") {
    const valuesByRow = state.rows.map((r) => {
      const ticker = r.ticker.trim().toUpperCase();
      const shares = Number(r.shares);
      const price = state.prices[ticker];
      const value =
        price != null && Number.isFinite(shares) && shares > 0
          ? shares * price
          : null;
      return { ticker, value, price };
    });
    const total = valuesByRow.reduce((s, r) => s + (r.value ?? 0), 0);

    return (
      <div className="portfolio">
        {state.notes ? (
          <p className="status" style={{ marginTop: 0 }}>
            <strong>Model note:</strong> {state.notes}
          </p>
        ) : null}
        {state.missingPrices.length > 0 ? (
          <p className="field-error" style={{ marginTop: 0 }}>
            Couldn&apos;t price these tickers — check spelling:{" "}
            {state.missingPrices.join(", ")}
          </p>
        ) : null}

        <table className="holdings-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Shares</th>
              <th>Price</th>
              <th>Value</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {state.rows.map((r, idx) => {
              const v = valuesByRow[idx];
              return (
                <tr key={r.id}>
                  <td>
                    <input
                      className="field-input field-input-sm"
                      type="text"
                      value={r.ticker}
                      onChange={(e) =>
                        updateRow(r.id, "ticker", e.target.value)
                      }
                      onBlur={(e) =>
                        e.target.value.trim() &&
                        fetchPriceFor(e.target.value.trim())
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="field-input field-input-sm"
                      type="number"
                      step="any"
                      min="0"
                      value={r.shares}
                      onChange={(e) =>
                        updateRow(r.id, "shares", e.target.value)
                      }
                    />
                  </td>
                  <td className="num">
                    {v.price != null ? `$${v.price.toFixed(2)}` : "—"}
                  </td>
                  <td className="num">
                    {v.value != null ? `$${v.value.toFixed(2)}` : "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="row-action"
                      onClick={() => removeRow(r.id)}
                      aria-label="Remove row"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>
                <button type="button" className="link" onClick={addRow}>
                  + Add row
                </button>
              </td>
              <td className="num">
                <strong>${total.toFixed(2)}</strong>
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        {state.error ? <p className="field-error">{state.error}</p> : null}

        <div className="row-actions">
          <button
            type="button"
            className="cta"
            onClick={saveReview}
            disabled={state.saving || state.rows.length === 0}
          >
            {state.saving ? "Saving…" : "Save portfolio"}
          </button>
          <button
            type="button"
            className="link"
            onClick={discardReview}
            disabled={state.saving}
          >
            Discard
          </button>
        </div>
      </div>
    );
  }

  // saved state
  const uploaded = new Date(state.uploadedAt);
  const ago = relativeTime(uploaded);
  return (
    <div className="portfolio">
      <p className="status" style={{ marginTop: 0 }}>
        <strong>{state.holdings.length} holdings</strong> · uploaded {ago}
      </p>
      <table className="holdings-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Shares</th>
          </tr>
        </thead>
        <tbody>
          {state.holdings.map((h) => (
            <tr key={h.ticker}>
              <td>{h.ticker}</td>
              <td className="num">{h.shares}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row-actions">
        <button type="button" className="cta" onClick={editSaved}>
          Edit
        </button>
        <button type="button" className="link" onClick={replaceSaved}>
          Upload new screenshot
        </button>
        <button type="button" className="link" onClick={clearSaved}>
          Clear
        </button>
      </div>
    </div>
  );
}

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}
