"use client";

/**
 * useChatThreads — thread-list lifecycle hook for the assistant modal
 * (components/assistant-modal.tsx).
 *
 * Owns the list of the user's threads and the mutations against the threads API
 * (slice #8): load/reload, create, rename, delete. It does NOT own which thread
 * is "active" — that's the shared ActiveThreadProvider (lib/chat/active-thread.tsx)
 * — nor the chat surface itself (components/chat-thread.tsx stays a pure
 * useChat surface).
 *
 * Thread creation is intentionally NOT done on mount/open. `createThread` is
 * exposed so callers can create lazily on the FIRST message send (see ChatThread's
 * `createThread` prop), avoiding empty orphan threads from merely opening the
 * drawer or visiting /chat.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface ChatThreadSummary {
  id: string;
  title: string | null;
  lastMessageAt: string;
  createdAt: string;
}

interface UseChatThreads {
  threads: ChatThreadSummary[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  createThread: () => Promise<ChatThreadSummary>;
  renameThread: (id: string, title: string) => Promise<void>;
  deleteThread: (id: string) => Promise<void>;
}

function sortByActivity(threads: ChatThreadSummary[]): ChatThreadSummary[] {
  return [...threads].sort(
    (a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
}

export function useChatThreads(): UseChatThreads {
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  // Mirror of threads state in a ref so mutations can read the current list
  // synchronously (before React flushes the next render) without relying on
  // values captured inside setState updaters, which run lazily.
  const threadsRef = useRef<ChatThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Wrapper so every setThreads call also updates the ref mirror, giving
  // mutations synchronous read access to the latest list (used by renameThread
  // to capture the pre-edit title before React flushes the optimistic update).
  const setThreadsAndRef = useCallback(
    (updater: ChatThreadSummary[] | ((prev: ChatThreadSummary[]) => ChatThreadSummary[])) => {
      setThreads((prev) => {
        const next =
          typeof updater === "function" ? updater(prev) : updater;
        threadsRef.current = next;
        return next;
      });
    },
    [],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/threads");
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? "Connect your I/O Fund account to start chatting."
            : "Couldn't load your conversations.",
        );
      }
      const { threads: list } = (await res.json()) as {
        threads: ChatThreadSummary[];
      };
      setThreadsAndRef(sortByActivity(list));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [setThreadsAndRef]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createThread = useCallback(async (): Promise<ChatThreadSummary> => {
    const res = await fetch("/api/chat/threads", { method: "POST" });
    if (!res.ok) throw new Error("Couldn't create a conversation.");
    const { thread } = (await res.json()) as { thread: ChatThreadSummary };
    setThreadsAndRef((prev) => sortByActivity([thread, ...prev]));
    return thread;
  }, [setThreadsAndRef]);

  const renameThread = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    // Capture the previous title BEFORE the optimistic setState so the value is
    // available synchronously — reading from threadsRef avoids relying on a `let`
    // set inside a setState updater, which React runs lazily (after the await).
    const previous = threadsRef.current.find((t) => t.id === id)?.title ?? null;
    setThreadsAndRef((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: trimmed } : t)),
    );
    const res = await fetch(`/api/chat/threads/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    if (!res.ok) {
      setThreadsAndRef((prev) =>
        prev.map((t) => (t.id === id ? { ...t, title: previous } : t)),
      );
      throw new Error("Couldn't rename the conversation.");
    }
  }, [setThreadsAndRef]);

  const deleteThread = useCallback(async (id: string) => {
    const res = await fetch(`/api/chat/threads/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Couldn't delete the conversation.");
    setThreadsAndRef((prev) => prev.filter((t) => t.id !== id));
  }, [setThreadsAndRef]);

  return {
    threads,
    loading,
    error,
    reload,
    createThread,
    renameThread,
    deleteThread,
  };
}
