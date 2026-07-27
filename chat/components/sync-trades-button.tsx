"use client";

import { useState } from "react";

type SyncState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "started" }
  | { kind: "error"; message: string };

/**
 * Admin-only action on /profile: manually dispatch the poll-trades workflow.
 * The dispatch is fire-and-forget (the run takes ~1 min on GitHub's side), so
 * "started" is the terminal success state, not "done".
 */
export function SyncTradesButton() {
  const [state, setState] = useState<SyncState>({ kind: "idle" });

  async function trigger() {
    if (state.kind === "pending") return;
    setState({ kind: "pending" });
    try {
      const res = await fetch("/api/admin/sync-trades", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Couldn't start the sync.");
      }
      setState({ kind: "started" });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't start the sync.",
      });
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={trigger}
        disabled={state.kind === "pending"}
        className="w-full text-left px-4 py-2 rounded border border-border text-sm text-cream hover:bg-surface transition-colors disabled:opacity-50"
      >
        {state.kind === "pending" ? "Starting trade sync…" : "Sync trades now"}
      </button>
      {state.kind === "started" ? (
        <p className="mt-1.5 px-1 text-xs text-muted">
          Sync started. New trades land in about a minute.
        </p>
      ) : state.kind === "error" ? (
        <p className="mt-1.5 px-1 text-xs text-orange">{state.message}</p>
      ) : null}
    </div>
  );
}
