"use client";

/**
 * ChatView — the full-screen /chat conversation manager (slice #10).
 *
 * Left sidebar (~280px): the user's threads, sorted by last activity, each row
 * showing the title (or a "New conversation" placeholder when untitled) + a
 * relative timestamp, with inline rename + confirm-delete actions. Main pane:
 * the selected conversation rendered through the shared <ChatThread> surface,
 * with more breathing room than the drawer.
 *
 * Shared active thread: selecting a row writes the shared activeThreadId
 * (lib/chat/active-thread.tsx), so the drawer resumes the same conversation on
 * its next open — and vice-versa. Lazy creation: "New conversation" just shows
 * an unstarted ChatThread; the row is created on first send (no empty orphans).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { ChatThread } from "@/components/chat-thread";
import { useActiveThread } from "@/lib/chat/active-thread";
import {
  useChatThreads,
  type ChatThreadSummary,
} from "@/lib/chat/use-chat-threads";

type Selection = { kind: "existing"; id: string } | { kind: "new" };

export function ChatView() {
  const { activeThreadId, setActiveThreadId } = useActiveThread();
  const { threads, loading, error, createThread, renameThread, deleteThread } =
    useChatThreads();

  const [selection, setSelection] = useState<Selection | null>(null);

  // Resolve the initial selection once the list loads. Prefer the shared active
  // thread (resume what the drawer last had), else the most-recent, else an
  // unstarted conversation when the user has none.
  useEffect(() => {
    if (loading || selection !== null) return;
    if (activeThreadId && threads.some((t) => t.id === activeThreadId)) {
      setSelection({ kind: "existing", id: activeThreadId });
    } else if (threads.length > 0) {
      setSelection({ kind: "existing", id: threads[0].id });
      setActiveThreadId(threads[0].id);
    } else {
      setSelection({ kind: "new" });
    }
  }, [loading, selection, activeThreadId, threads, setActiveThreadId]);

  const selectThread = useCallback(
    (id: string) => {
      setActiveThreadId(id);
      setSelection({ kind: "existing", id });
    },
    [setActiveThreadId],
  );

  const startNew = useCallback(() => {
    setActiveThreadId(null);
    setSelection({ kind: "new" });
  }, [setActiveThreadId]);

  // Lazy-create on first send of an unstarted conversation. We do NOT flip
  // `selection` to "existing" here: that would remount ChatThread (it's keyed
  // "new") and drop the in-flight message. ChatThread caches the new id and
  // keeps streaming into it; createThread already splices the row into the
  // sidebar, and we sync the shared active thread.
  const handleCreateThread = useCallback(async (): Promise<string> => {
    const thread = await createThread();
    setActiveThreadId(thread.id);
    return thread.id;
  }, [createThread, setActiveThreadId]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteThread(id);
      // If we deleted the open conversation, fall back to an unstarted one and
      // clear the shared active thread so the drawer doesn't resume a dead id.
      setSelection((cur) =>
        cur?.kind === "existing" && cur.id === id ? { kind: "new" } : cur,
      );
      if (activeThreadId === id) setActiveThreadId(null);
    },
    [deleteThread, setActiveThreadId, activeThreadId],
  );

  // Which row reads as active. When showing an existing thread it's that id;
  // when in an unstarted "new" conversation that just lazily created its row,
  // activeThreadId points at it — highlight it so the sidebar stays in sync.
  const selectedId =
    selection?.kind === "existing" ? selection.id : activeThreadId;

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8">
      <div className="flex h-[calc(100vh-5rem)] min-h-0">
        {/* Sidebar */}
        <aside className="w-[280px] shrink-0 border-r border-border flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 h-14 border-b border-border">
            <span className="text-xs uppercase tracking-[0.18em] text-orange">
              Conversations
            </span>
            <button
              type="button"
              onClick={startNew}
              className="text-xs tracking-wide text-muted hover:text-cream transition-colors"
            >
              + New
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {loading ? (
              <p className="px-4 py-3 text-sm text-muted">Loading…</p>
            ) : error ? (
              <p className="px-4 py-3 text-sm text-muted">{error}</p>
            ) : threads.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">
                Start a conversation.
              </p>
            ) : (
              <ul>
                {threads.map((t) => (
                  <ThreadRow
                    key={t.id}
                    thread={t}
                    active={t.id === selectedId}
                    onSelect={() => selectThread(t.id)}
                    onRename={(title) => renameThread(t.id, title)}
                    onDelete={() => handleDelete(t.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Reader */}
        <section className="flex-1 min-w-0 flex flex-col min-h-0">
          {selection?.kind === "new" ? (
            <ChatThread
              key="new"
              threadId={null}
              initialMessages={[]}
              createThread={handleCreateThread}
            />
          ) : selectedId ? (
            <ThreadReader key={selectedId} threadId={selectedId} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted">
              Loading…
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** Fetches a thread's messages then renders the shared ChatThread surface. */
function ThreadReader({ threadId }: { threadId: string }) {
  const [messages, setMessages] = useState<UIMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMessages(null);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/chat/threads/${threadId}/messages`);
        if (!res.ok) throw new Error("Couldn't load conversation history.");
        const { messages: list } = (await res.json()) as {
          messages: UIMessage[];
        };
        if (!cancelled) setMessages(list);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted">
        {error}
      </div>
    );
  }
  if (messages === null) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted">
        Loading…
      </div>
    );
  }
  return <ChatThread threadId={threadId} initialMessages={messages} />;
}

function ThreadRow({
  thread,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  thread: ChatThreadSummary;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(thread.title ?? "");
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const label = thread.title ?? "New conversation";

  function startEdit() {
    setDraft(thread.title ?? "");
    setEditing(true);
  }

  async function commit() {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== thread.title) {
      await onRename(next);
    }
  }

  return (
    <li
      className={
        "group relative px-4 py-2.5 cursor-pointer border-l-2 transition-colors " +
        (active
          ? "border-orange bg-surface"
          : "border-transparent hover:bg-surface/60")
      }
      onClick={() => {
        if (!editing) onSelect();
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-full bg-bg border border-border rounded px-2 py-1 text-sm text-cream focus:outline-none focus:border-muted"
        />
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm text-cream truncate">{label}</span>
            <span className="text-[10px] text-muted-deep shrink-0 pt-0.5">
              {relativeTime(thread.lastMessageAt)}
            </span>
          </div>

          {confirming ? (
            <div className="mt-1 flex items-center gap-3 text-[11px]">
              <span className="text-muted">Delete?</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirming(false);
                  void onDelete();
                }}
                className="text-orange hover:opacity-80"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirming(false);
                }}
                className="text-muted hover:text-cream"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-3 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit();
                }}
                className="text-muted hover:text-cream"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirming(true);
                }}
                className="text-muted hover:text-orange"
              >
                Delete
              </button>
            </div>
          )}
        </>
      )}
    </li>
  );
}

/** Compact relative timestamp: "now", "5m ago", "2h ago", "3d ago", "Jan 4". */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "now";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(then).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
