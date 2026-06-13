"use client";

/**
 * DrawerChat — orchestrates which thread the assistant drawer shows (slices #9/#10).
 *
 * Lifecycle (the component is only mounted while the drawer is OPEN — see
 * app-chrome.tsx — so the thread list reloads on each open via useChatThreads):
 *   1. Load the user's threads (useChatThreads, loads on mount).
 *   2. Pick the thread to resume: the shared activeThreadId if it's set and still
 *      exists (so the drawer resumes whatever /chat last selected), else the
 *      most-recent thread, else start a fresh UNSTARTED conversation.
 *   3. For an existing thread, fetch its messages and render <ChatThread> keyed
 *      by its id. For a fresh one, render an unstarted <ChatThread> (threadId
 *      null) — NO thread row is created until the first message is sent.
 *
 * "New conversation" just drops into an unstarted ChatThread; the orphan-free
 * thread row is created lazily on first send (ChatThread.createThread), which
 * also syncs the shared activeThreadId + the list.
 */

import { useCallback, useEffect, useState } from "react";
import type { UIMessage } from "ai";
import { ChatThread } from "./chat-thread";
import { useActiveThread } from "@/lib/chat/active-thread";
import { useChatThreads } from "@/lib/chat/use-chat-threads";

// What the drawer is currently showing.
type Selection =
  | { kind: "existing"; id: string }
  | { kind: "new" }
  | null; // not yet resolved

export function DrawerChat() {
  const { activeThreadId, setActiveThreadId } = useActiveThread();
  const { threads, loading, error, createThread } = useChatThreads();

  const [selection, setSelection] = useState<Selection>(null);
  const [messages, setMessages] = useState<UIMessage[] | null>(null);
  const [msgError, setMsgError] = useState<string | null>(null);

  // Resolve the initial selection once the list finishes loading. Prefer the
  // shared active thread (resume what /chat selected), else most-recent, else
  // an unstarted conversation. Runs once per mount (selection stays null until
  // then; "New conversation" / lazy-create transitions handle the rest).
  useEffect(() => {
    if (loading || selection !== null) return;
    if (activeThreadId && threads.some((t) => t.id === activeThreadId)) {
      setSelection({ kind: "existing", id: activeThreadId });
    } else if (threads.length > 0) {
      setSelection({ kind: "existing", id: threads[0].id });
    } else {
      setSelection({ kind: "new" });
    }
  }, [loading, selection, activeThreadId, threads]);

  // Fetch messages whenever we're showing an existing thread.
  useEffect(() => {
    if (selection?.kind !== "existing") {
      setMessages(selection?.kind === "new" ? [] : null);
      return;
    }
    let cancelled = false;
    setMessages(null);
    setMsgError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/chat/threads/${selection.id}/messages`);
        if (!res.ok) throw new Error("Couldn't load conversation history.");
        const { messages: list } = (await res.json()) as {
          messages: UIMessage[];
        };
        if (!cancelled) setMessages(list);
      } catch (err) {
        if (!cancelled) {
          setMsgError(
            err instanceof Error ? err.message : "Something went wrong.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selection]);

  const handleNewConversation = useCallback(() => {
    setActiveThreadId(null);
    setMsgError(null);
    setSelection({ kind: "new" });
  }, [setActiveThreadId]);

  // Lazy-create: ChatThread calls this on first send of an unstarted thread.
  // We deliberately DON'T flip `selection` to "existing" here — that would
  // remount ChatThread (different key) and drop the in-flight message. The
  // ChatThread caches the new id internally and keeps streaming into it; we only
  // sync the shared active thread + list (createThread already updates the list).
  const handleCreateThread = useCallback(async (): Promise<string> => {
    const thread = await createThread();
    setActiveThreadId(thread.id);
    return thread.id;
  }, [createThread, setActiveThreadId]);

  const handleThreadCreated = useCallback(
    (id: string) => {
      setActiveThreadId(id);
    },
    [setActiveThreadId],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-end px-6 py-3 border-b border-border">
        <button
          type="button"
          onClick={handleNewConversation}
          disabled={loading}
          className="text-xs tracking-wide text-muted hover:text-cream transition-colors disabled:opacity-50"
        >
          New conversation
        </button>
      </div>

      {loading ? (
        <DrawerNotice>Loading…</DrawerNotice>
      ) : error ? (
        <DrawerNotice>{error}</DrawerNotice>
      ) : msgError ? (
        <DrawerNotice>{msgError}</DrawerNotice>
      ) : selection?.kind === "new" ? (
        // Stable "new" key so the in-flight first message survives lazy creation.
        <ChatThread
          key="new"
          threadId={null}
          initialMessages={[]}
          createThread={handleCreateThread}
          onThreadCreated={handleThreadCreated}
        />
      ) : selection?.kind === "existing" && messages !== null ? (
        <ChatThread
          key={selection.id}
          threadId={selection.id}
          initialMessages={messages}
        />
      ) : (
        <DrawerNotice>Loading…</DrawerNotice>
      )}
    </div>
  );
}

function DrawerNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 text-center text-sm text-muted">
      {children}
    </div>
  );
}
