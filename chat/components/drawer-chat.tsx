"use client";

/**
 * DrawerChat — orchestrates thread loading for the assistant drawer (slice #9).
 *
 * Lifecycle (lazy — runs only once the drawer is first opened, not on app load):
 *   1. GET /api/chat/threads. If any exist, pick threads[0] (most recent
 *      activity) and GET its messages → render <ChatThread initialMessages>.
 *   2. If none exist, POST /api/chat/threads to create one → render it empty.
 *
 * "New conversation" POSTs a fresh thread and switches to it WITHOUT reload.
 * <ChatThread> is keyed by threadId so useChat re-initializes cleanly on switch.
 *
 * This component owns active-thread + load state; ChatThread stays the reusable
 * chat surface (slice #10's /chat view reuses it with its own thread switcher).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { ChatThread } from "./chat-thread";

interface Thread {
  id: string;
  title: string | null;
}

type Phase =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; threadId: string; initialMessages: UIMessage[] };

export function DrawerChat({ open }: { open: boolean }) {
  const [phase, setPhase] = useState<Phase>({ status: "loading" });
  const [creating, setCreating] = useState(false);
  // Guard so the lazy initial load runs exactly once across open/close toggles.
  const loadedRef = useRef(false);

  const loadInitial = useCallback(async () => {
    setPhase({ status: "loading" });
    try {
      const listRes = await fetch("/api/chat/threads");
      if (!listRes.ok) {
        throw new Error(
          listRes.status === 403
            ? "Connect your I/O Fund account to start chatting."
            : "Couldn't load your conversations.",
        );
      }
      const { threads } = (await listRes.json()) as { threads: Thread[] };

      if (threads.length > 0) {
        const threadId = threads[0].id;
        const msgRes = await fetch(`/api/chat/threads/${threadId}/messages`);
        if (!msgRes.ok) throw new Error("Couldn't load conversation history.");
        const { messages } = (await msgRes.json()) as { messages: UIMessage[] };
        setPhase({ status: "ready", threadId, initialMessages: messages });
        return;
      }

      // No threads yet — create the first one.
      const created = await createThread();
      setPhase({ status: "ready", threadId: created.id, initialMessages: [] });
    } catch (err) {
      setPhase({
        status: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }, []);

  // Lazy first load: only when the drawer is actually opened, and only once.
  useEffect(() => {
    if (open && !loadedRef.current) {
      loadedRef.current = true;
      void loadInitial();
    }
  }, [open, loadInitial]);

  const handleNewConversation = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const created = await createThread();
      // Switch without reload — keying ChatThread by id re-inits useChat.
      setPhase({ status: "ready", threadId: created.id, initialMessages: [] });
    } catch {
      setPhase({
        status: "error",
        message: "Couldn't start a new conversation.",
      });
    } finally {
      setCreating(false);
    }
  }, [creating]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-end px-6 py-3 border-b border-border">
        <button
          type="button"
          onClick={handleNewConversation}
          disabled={creating || phase.status === "loading"}
          className="text-xs tracking-wide text-muted hover:text-cream transition-colors disabled:opacity-50"
        >
          {creating ? "Starting…" : "New conversation"}
        </button>
      </div>

      {phase.status === "loading" ? (
        <div className="flex-1 flex items-center justify-center px-6 text-center text-sm text-muted">
          Loading…
        </div>
      ) : phase.status === "error" ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted">
          <p>{phase.message}</p>
          <button
            type="button"
            onClick={loadInitial}
            className="text-xs tracking-wide text-orange hover:opacity-80 transition-opacity"
          >
            Retry
          </button>
        </div>
      ) : (
        <ChatThread
          key={phase.threadId}
          threadId={phase.threadId}
          initialMessages={phase.initialMessages}
        />
      )}
    </div>
  );
}

async function createThread(): Promise<Thread> {
  const res = await fetch("/api/chat/threads", { method: "POST" });
  if (!res.ok) throw new Error("Couldn't create a conversation.");
  const { thread } = (await res.json()) as { thread: Thread };
  return thread;
}
