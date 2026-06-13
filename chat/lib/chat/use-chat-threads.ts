"use client";

/**
 * useChatThreads — shared thread-list lifecycle hook for both chat surfaces
 * (components/drawer-chat.tsx + app/(app)/chat/ChatView.tsx).
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

import { useCallback, useEffect, useState } from "react";

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
  /** Locally splice a freshly-created thread into the list (no refetch). */
  addThread: (thread: ChatThreadSummary) => void;
}

function sortByActivity(threads: ChatThreadSummary[]): ChatThreadSummary[] {
  return [...threads].sort(
    (a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
}

export function useChatThreads(): UseChatThreads {
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setThreads(sortByActivity(list));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addThread = useCallback((thread: ChatThreadSummary) => {
    setThreads((prev) => sortByActivity([thread, ...prev]));
  }, []);

  const createThread = useCallback(async (): Promise<ChatThreadSummary> => {
    const res = await fetch("/api/chat/threads", { method: "POST" });
    if (!res.ok) throw new Error("Couldn't create a conversation.");
    const { thread } = (await res.json()) as { thread: ChatThreadSummary };
    setThreads((prev) => sortByActivity([thread, ...prev]));
    return thread;
  }, []);

  const renameThread = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    // Optimistic: update locally, then PATCH. Roll back on failure.
    let previous: string | null = null;
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        previous = t.title;
        return { ...t, title: trimmed };
      }),
    );
    const res = await fetch(`/api/chat/threads/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    if (!res.ok) {
      setThreads((prev) =>
        prev.map((t) => (t.id === id ? { ...t, title: previous } : t)),
      );
      throw new Error("Couldn't rename the conversation.");
    }
  }, []);

  const deleteThread = useCallback(async (id: string) => {
    const res = await fetch(`/api/chat/threads/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Couldn't delete the conversation.");
    setThreads((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    threads,
    loading,
    error,
    reload,
    createThread,
    renameThread,
    deleteThread,
    addThread,
  };
}
