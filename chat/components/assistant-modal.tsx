"use client";

/**
 * AssistantModal — centered modal chat surface (replaces the old right-side
 * drawer). Two-pane "familiar" layout: a persistent left sidebar listing past
 * conversations (+ New), and the chat surface on the right.
 *
 * Responsive: on desktop it's a centered card with the sidebar always visible;
 * on mobile it goes full-screen and the sidebar collapses behind a hamburger
 * (rendered as an in-card overlay).
 *
 * Lifecycle (the component is only mounted while the modal is OPEN — see
 * app-chrome.tsx — so the thread list reloads on each open via useChatThreads):
 *   1. Load the user's threads (useChatThreads, loads on mount).
 *   2. Pick the thread to resume: the shared activeThreadId if it still exists
 *      (resume whatever was last selected), else the most-recent thread, else a
 *      fresh UNSTARTED conversation.
 *   3. For an existing thread, fetch its messages and render <ChatThread> keyed
 *      by id. For a fresh one, render an unstarted <ChatThread> (threadId null) —
 *      NO thread row is created until the first message is sent.
 *
 * "New" just drops into an unstarted ChatThread; the orphan-free thread row is
 * created lazily on first send (ChatThread.createThread), which also syncs the
 * shared activeThreadId + the list.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { UIMessage } from "ai";
import { ChatThread } from "./chat-thread";
import { SparkleGlyph } from "./sparkle-glyph";
import { useActiveThread } from "@/lib/chat/active-thread";
import {
  useChatThreads,
  type ChatThreadSummary,
} from "@/lib/chat/use-chat-threads";

// What the chat pane is currently showing.
type Selection =
  | { kind: "existing"; id: string }
  | { kind: "new" }
  | null; // not yet resolved

// Search-result row from GET /api/chat/threads?q= — a thread summary plus a
// clipped snippet of the matching message text (null when only the title hit).
interface SearchHit extends ChatThreadSummary {
  snippet: string | null;
}

export function AssistantModal({ onClose }: { onClose: () => void }) {
  const { activeThreadId, setActiveThreadId } = useActiveThread();
  const {
    threads,
    loading,
    error,
    reload,
    createThread,
    renameThread,
    deleteThread,
  } = useChatThreads();

  const [selection, setSelection] = useState<Selection>(null);
  const [messages, setMessages] = useState<UIMessage[] | null>(null);
  const [msgError, setMsgError] = useState<string | null>(null);
  // Mobile-only: whether the sidebar overlay is showing.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Sidebar row affordances, lifted so only one row can be open at a time:
  // which row's overflow menu is showing, and which row is being retitled.
  const [menuThreadId, setMenuThreadId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  // Conversation search. A non-empty query switches the sidebar list to search
  // results (title + message-text matches, with a snippet). Debounced fetch;
  // out-of-order responses are dropped via the sequence counter.
  const [search, setSearch] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[] | null>(null);
  const searchSeq = useRef(0);
  const searchQuery = search.trim();

  useEffect(() => {
    if (!searchQuery) {
      setSearchHits(null);
      return;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/chat/threads?q=${encodeURIComponent(searchQuery)}`,
        );
        if (!res.ok) throw new Error();
        const { threads: hits } = (await res.json()) as { threads: SearchHit[] };
        if (searchSeq.current === seq) setSearchHits(hits);
      } catch {
        if (searchSeq.current === seq) setSearchHits([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Resolve the initial selection once the list finishes loading. Prefer the
  // shared active thread, else most-recent, else an unstarted conversation.
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
    setSidebarOpen(false);
    setSelection({ kind: "new" });
  }, [setActiveThreadId]);

  const handleSelectThread = useCallback(
    (id: string) => {
      setActiveThreadId(id);
      setMsgError(null);
      setSidebarOpen(false);
      setSelection({ kind: "existing", id });
    },
    [setActiveThreadId],
  );

  const handleStartRename = useCallback((id: string) => {
    setMenuThreadId(null);
    setRenamingId(id);
  }, []);

  // Commit an inline retitle. A blank or unchanged title just leaves edit mode,
  // which also covers the Escape path (it restores the original value, then blurs).
  const handleRenameThread = useCallback(
    async (id: string, title: string) => {
      setRenamingId(null);
      const trimmed = title.trim();
      const current = threads.find((t) => t.id === id)?.title?.trim() ?? "";
      if (!trimmed || trimmed === current) return;
      try {
        await renameThread(id, trimmed);
      } catch {
        // The hook already rolled the optimistic title back.
      }
    },
    [threads, renameThread],
  );

  const handleDeleteThread = useCallback(
    async (id: string) => {
      setMenuThreadId(null);
      // Snapshot the next-best selection BEFORE the row leaves the list.
      const remaining = threads.filter((t) => t.id !== id);
      try {
        await deleteThread(id);
      } catch {
        return; // hook surfaces nothing; leave the UI untouched on failure
      }
      // Only re-point the pane if the deleted thread was the one on screen.
      if (selection?.kind === "existing" && selection.id === id) {
        if (remaining.length > 0) {
          handleSelectThread(remaining[0].id);
        } else {
          handleNewConversation();
        }
      }
    },
    [threads, deleteThread, selection, handleSelectThread, handleNewConversation],
  );

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

  const currentThreadId =
    selection?.kind === "existing" ? selection.id : null;
  const currentTitle =
    threads.find((t) => t.id === currentThreadId)?.title?.trim() ||
    "New conversation";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-stretch md:place-items-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Assistant"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 -z-10 bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div className="relative flex w-full h-full md:w-[min(1040px,94vw)] md:h-[min(720px,86vh)] overflow-hidden bg-surface md:rounded-2xl border border-border shadow-2xl">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="absolute inset-0 z-20 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar — static on desktop, overlay on mobile */}
        <aside
          className={`absolute md:static inset-y-0 left-0 z-30 w-72 md:w-64 shrink-0 flex-col bg-surface border-r border-border ${
            sidebarOpen ? "flex" : "hidden"
          } md:flex`}
        >
          <div className="flex items-center gap-2 px-5 h-[60px] border-b border-border">
            <span className="text-orange">
              <SparkleGlyph className="w-4 h-4" />
            </span>
            <span className="font-serif text-lg font-semibold tracking-tight">
              Assistant
            </span>
          </div>

          <div className="px-3 py-3">
            <button
              type="button"
              onClick={handleNewConversation}
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg border border-border text-sm font-semibold text-cream hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              + New conversation
            </button>
          </div>

          <div className="px-3 pb-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
              className="w-full h-8 rounded-lg border border-border bg-transparent px-2.5 text-sm text-cream placeholder:text-muted-deep focus:outline-none focus:border-muted-deep"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3">
            {loading ? (
              <p className="px-3 py-2 text-sm text-muted">Loading…</p>
            ) : searchQuery ? (
              searchHits === null ? (
                <p className="px-3 py-2 text-sm text-muted">Searching…</p>
              ) : searchHits.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted">No matches.</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {searchHits.map((t) => (
                    <ThreadRow
                      key={t.id}
                      thread={t}
                      snippet={t.snippet}
                      active={t.id === currentThreadId}
                      menuOpen={menuThreadId === t.id}
                      renaming={renamingId === t.id}
                      onSelect={() => handleSelectThread(t.id)}
                      onToggleMenu={() =>
                        setMenuThreadId((cur) => (cur === t.id ? null : t.id))
                      }
                      onCloseMenu={() => setMenuThreadId(null)}
                      onStartRename={() => handleStartRename(t.id)}
                      onRename={(title) => handleRenameThread(t.id, title)}
                      onDelete={() => handleDeleteThread(t.id)}
                    />
                  ))}
                </ul>
              )
            ) : threads.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted">
                No conversations yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {threads.map((t) => (
                  <ThreadRow
                    key={t.id}
                    thread={t}
                    active={t.id === currentThreadId}
                    menuOpen={menuThreadId === t.id}
                    renaming={renamingId === t.id}
                    onSelect={() => handleSelectThread(t.id)}
                    onToggleMenu={() =>
                      setMenuThreadId((cur) => (cur === t.id ? null : t.id))
                    }
                    onCloseMenu={() => setMenuThreadId(null)}
                    onStartRename={() => handleStartRename(t.id)}
                    onRename={(title) => handleRenameThread(t.id, title)}
                    onDelete={() => handleDeleteThread(t.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Chat pane */}
        <div className="relative flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2 px-4 md:px-5 h-[60px] border-b border-border">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Show conversations"
              className="md:hidden text-muted hover:text-cream transition-colors"
            >
              <MenuGlyph />
            </button>
            <span className="flex-1 min-w-0 truncate font-serif text-base font-semibold tracking-tight text-cream">
              {currentTitle}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close assistant"
              className="text-muted hover:text-cream transition-colors text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {loading ? (
            <Notice>Loading…</Notice>
          ) : error ? (
            <Notice reload={reload}>{error}</Notice>
          ) : msgError ? (
            <Notice>{msgError}</Notice>
          ) : selection?.kind === "new" ? (
            // Stable "new" key so the in-flight first message survives lazy creation.
            <ChatThread
              key="new"
              threadId={null}
              initialMessages={[]}
              createThread={handleCreateThread}
            />
          ) : selection?.kind === "existing" && messages !== null ? (
            <ChatThread
              key={selection.id}
              threadId={selection.id}
              initialMessages={messages}
            />
          ) : (
            <Notice>Loading…</Notice>
          )}
        </div>
      </div>
    </div>
  );
}

/** One conversation row in the sidebar. Hover (or tap, on touch) reveals an
 *  overflow menu — Rename / Delete — rather than a bare delete icon, so more
 *  actions can be added without crowding the row.
 *  With `snippet` (search results), the matching text replaces the timestamp.
 *  While `renaming`, the row becomes an inline title input. */
function ThreadRow({
  thread,
  snippet,
  active,
  menuOpen,
  renaming,
  onSelect,
  onToggleMenu,
  onCloseMenu,
  onStartRename,
  onRename,
  onDelete,
}: {
  thread: ChatThreadSummary;
  snippet?: string | null;
  active: boolean;
  menuOpen: boolean;
  renaming: boolean;
  onSelect: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onStartRename: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const title = thread.title?.trim() || "Untitled conversation";

  if (renaming) {
    return (
      <li>
        <form
          className="py-0.5"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("title");
            onRename(typeof value === "string" ? value : "");
          }}
        >
          <input
            name="title"
            defaultValue={title}
            autoFocus
            maxLength={200}
            aria-label="Conversation title"
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              // Escape restores the original value and blurs; the blur handler
              // then commits a no-op, so there's one exit path, not two.
              if (e.key === "Escape") {
                e.stopPropagation(); // don't also close the modal
                e.currentTarget.value = title;
                e.currentTarget.blur();
              }
            }}
            onBlur={(e) => onRename(e.currentTarget.value)}
            className="w-full h-[46px] rounded-lg border border-muted-deep bg-surface-2 px-3 text-sm text-cream focus:outline-none"
          />
        </form>
      </li>
    );
  }

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onSelect}
        className={`w-full flex flex-col items-start gap-0.5 rounded-lg pl-3 pr-9 py-2 text-left transition-colors hover:bg-surface-2 ${
          active ? "bg-surface-2" : ""
        }`}
      >
        <span
          className={`w-full truncate text-sm ${active ? "text-cream" : "text-muted"}`}
        >
          {title}
        </span>
        {snippet ? (
          <span className="w-full truncate text-xs text-muted-deep">
            {snippet}
          </span>
        ) : (
          <span className="text-xs text-muted-deep tabular-nums">
            {relTime(thread.lastMessageAt)}
          </span>
        )}
      </button>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleMenu();
        }}
        aria-label={`Conversation options — ${title}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        // Always visible on touch, where there's no hover to reveal it.
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-md text-muted-deep hover:text-cream hover:bg-surface transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 ${
          menuOpen ? "md:opacity-100 text-cream" : ""
        }`}
      >
        <KebabGlyph />
      </button>
      {menuOpen && triggerRef.current ? (
        <RowMenu
          anchor={triggerRef.current}
          onClose={onCloseMenu}
          onRename={onStartRename}
          onDelete={onDelete}
        />
      ) : null}
    </li>
  );
}

/** Overflow menu for a conversation row. Positioned `fixed` off the trigger's
 *  rect because the sidebar list scrolls — an absolutely-positioned child would
 *  be clipped by its `overflow-y-auto`. Delete asks once; a thread can't be
 *  recovered. */
function RowMenu({
  anchor,
  onClose,
  onRename,
  onDelete,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const width = 176;
    const height = ref.current?.offsetHeight ?? (confirming ? 116 : 80);
    const rect = anchor.getBoundingClientRect();
    const fitsBelow = window.innerHeight - rect.bottom > height + 12;
    setPos({
      top: fitsBelow ? rect.bottom + 6 : Math.max(8, rect.top - height - 6),
      left: Math.max(
        8,
        Math.min(rect.right - width, window.innerWidth - width - 8),
      ),
    });
  }, [anchor, confirming]);

  // Close on outside click, Escape, or any scroll/resize that would strand the
  // menu away from its row. The trigger counts as "inside" so its own click
  // toggles rather than close-then-reopen.
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchor.contains(target)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation(); // don't also close the modal
        onClose();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        visibility: pos ? "visible" : "hidden",
      }}
      className="fixed z-50 w-44 rounded-lg border border-border bg-surface py-1 shadow-lg"
    >
      {confirming ? (
        <>
          <p className="px-3 py-1.5 text-xs text-muted">
            Delete this conversation?
          </p>
          <MenuItem onSelect={onDelete} tone="danger">
            <TrashGlyph />
            Delete
          </MenuItem>
          <MenuItem onSelect={onClose}>Cancel</MenuItem>
        </>
      ) : (
        <>
          <MenuItem onSelect={onRename}>
            <PencilGlyph />
            Rename
          </MenuItem>
          <MenuItem onSelect={() => setConfirming(true)} tone="danger">
            <TrashGlyph />
            Delete
          </MenuItem>
        </>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onSelect,
  tone,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 ${
        tone === "danger" ? "text-cat-memory" : "text-cream"
      }`}
    >
      {children}
    </button>
  );
}

function Notice({
  children,
  reload,
}: {
  children: React.ReactNode;
  reload?: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted">
      <span>{children}</span>
      {reload ? (
        <button
          type="button"
          onClick={reload}
          className="text-xs tracking-wide text-muted hover:text-cream transition-colors"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

/** Compact relative timestamp for the conversation list. */
function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function MenuGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function KebabGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}

function PencilGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
    </svg>
  );
}
