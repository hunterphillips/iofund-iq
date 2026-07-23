"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { usePageContext, type PageContext } from "@/lib/page-context/context";
import {
  CHAT_MODELS,
  DEFAULT_CHAT_MODEL,
  resolveChatModel,
  type ChatModelId,
} from "@/lib/chat/models";
import { MarkdownBody } from "./markdown-body";
import { Engraving } from "./engraving";

// Starter questions offered in the empty state when the assistant is opened from
// an article (sent on click). Kept generic enough to fit any article.
const ARTICLE_SUGGESTIONS = [
  "Summarize the key points",
  "What's the main takeaway?",
  "How does this affect the portfolio?",
];

// Reusable workflow templates shown on the empty chat state (no article context).
// Each maps to a real chat capability. Templates that need the user to supply
// something — a ticker, or an attached holdings screenshot — `prefill` the input
// and focus it instead of sending immediately; the rest send on click.
const MODEL_STORAGE_KEY = "iofund.chat-model";

const COMMAND_TEMPLATES: {
  label: string;
  hint: string;
  prompt: string;
  prefill?: boolean;
}[] = [
  {
    label: "Ticker brief",
    hint: "Recent trades, thesis & risks for one name",
    prompt: "Give me a brief on ",
    prefill: true,
  },
  {
    label: "Latest trades",
    hint: "What just moved, and what it signals",
    prompt: "What are the most recent trades, and what do they signal?",
  },
  {
    label: "What changed in the thesis",
    hint: "Recent shifts in the investment thesis",
    prompt: "Summarize the most recent changes in the investment thesis.",
  },
  {
    label: "Compare my portfolio",
    hint: "Gap vs. the fund — attach a screenshot",
    prompt:
      "Compare my portfolio against the fund. (Attach a screenshot of your holdings.)",
    prefill: true,
  },
  {
    label: "Risks to my holdings",
    hint: "Biggest risks across the current book",
    prompt:
      "What are the biggest risks to the fund's current positions right now?",
  },
];

/**
 * ChatThread — the pure chat surface, rendered inside the assistant modal.
 *
 * Lazy thread creation: a conversation may start with NO thread row
 * (`initialThreadId === null`). The thread is created on the FIRST send, not on
 * mount — `createThread()` runs inside the transport's async
 * `prepareSendMessagesRequest`, which injects the resulting id into the request
 * body so /api/chat (which 400s without a threadId) always gets one. The id is
 * cached in a ref so subsequent sends reuse it. `onThreadCreated(id)` lets the
 * wrapper sync shared active-thread state + the sidebar list.
 *
 * IMPORTANT: callers must keep ChatThread MOUNTED across the first send when
 * starting from a null thread (key it by a stable sentinel like "new", not by
 * threadId) — otherwise the just-typed message is lost when the id arrives.
 */
export function ChatThread({
  threadId: initialThreadId,
  initialMessages,
  createThread,
  onThreadCreated,
}: {
  threadId: string | null;
  initialMessages: UIMessage[];
  /** Resolver run once on first send when there's no thread yet. */
  createThread?: () => Promise<string>;
  /** Notified with the new id after lazy creation (wrapper syncs state). */
  onThreadCreated?: (id: string) => void;
}) {
  const [input, setInput] = useState("");
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  // Model choice, persisted per browser. Initialized to the default and synced
  // from localStorage after mount (not in the initializer) so the server and
  // first client render agree — reading storage during render would trip
  // React's hydration mismatch warning on the <select> value.
  const [model, setModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(MODEL_STORAGE_KEY);
      if (stored) setModel(resolveChatModel(stored));
    } catch {
      // Storage unavailable (private mode) — keep the default.
    }
  }, []);
  const modelRef = useRef(model);
  modelRef.current = model;

  function changeModel(value: string) {
    const resolved = resolveChatModel(value);
    setModel(resolved);
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, resolved);
    } catch {
      // Best-effort persistence only.
    }
  }

  // Auto-grow the composer textarea to fit its content (and shrink back when the
  // input is cleared after a send). CSS caps the height + scrolls past the cap.
  useEffect(() => {
    const el = textInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // Per-turn page context: build the `x-page-context` header from the current
  // route + whatever the page published via useSetPageContext(). The transport
  // is constructed once, but useChat resolves `headers` per request — so we read
  // the LATEST context through a ref the closure captures. The drawer/page only
  // PRODUCE the header here; the system-prompt injection lives entirely in
  // /api/chat (see lib/chat/page-context-prompt.ts).
  const pathname = usePathname();
  const published = usePageContext();
  const headerValue = useMemo(
    () => buildPageContextHeader(pathname, published),
    [pathname, published],
  );
  const headerRef = useRef(headerValue);
  headerRef.current = headerValue;

  // Resolve the threadId lazily, once. Seeded from the prop; if null, the first
  // send creates a thread and caches its id here.
  const threadIdRef = useRef<string | null>(initialThreadId);
  const createThreadRef = useRef(createThread);
  createThreadRef.current = createThread;
  const onCreatedRef = useRef(onThreadCreated);
  onCreatedRef.current = onThreadCreated;
  // In-flight creation promise: concurrent first-sends await the SAME promise so
  // only one thread row is ever created (the second caller waits for the first).
  const creatingRef = useRef<Promise<string> | null>(null);

  async function ensureThreadId(): Promise<string> {
    if (threadIdRef.current) return threadIdRef.current;
    if (!creatingRef.current) {
      const create = createThreadRef.current;
      if (!create) {
        throw new Error("No thread and no way to create one.");
      }
      creatingRef.current = create()
        .then((id) => {
          threadIdRef.current = id;
          onCreatedRef.current?.(id);
          return id;
        })
        .catch((err: unknown) => {
          // Reset so a later retry can attempt creation again.
          creatingRef.current = null;
          throw err;
        });
    }
    return creatingRef.current;
  }

  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // `headers` is a Resolvable in AI SDK v6 — evaluated per request. Reading
      // the ref means navigation updates the context without rebuilding the
      // transport (which would reset useChat state).
      headers: (): Record<string, string> => {
        const value = headerRef.current;
        return value ? { "x-page-context": value } : {};
      },
      // Inject the threadId into every request body. This is async so it can
      // lazily create the thread on the first send (returning its id) — /api/chat
      // 400s without a threadId, so we guarantee one exists before sending.
      // Returning `body` fully replaces the default, so we re-include the
      // standard fields (id/messages/trigger/messageId) the SDK would have sent.
      prepareSendMessagesRequest: async ({
        body,
        id,
        messages: msgs,
        trigger,
        messageId,
      }) => {
        const threadId = await ensureThreadId();
        return {
          body: {
            ...body,
            id,
            messages: msgs,
            trigger,
            messageId,
            threadId,
            model: modelRef.current,
          },
        };
      },
    }),
  });

  const busy = status === "streaming" || status === "submitted";

  // Stick-to-bottom: follow the stream unless the user scrolls up to read.
  // `pinned` flips off when they scroll away from the bottom and back on when
  // they return within the threshold — our own programmatic scrolls land at
  // distance 0, so following never un-pins itself.
  const messagesRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  function handleMessagesScroll() {
    const el = messagesRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedRef.current = distanceFromBottom < 48;
  }

  // Runs on every streamed chunk (useChat replaces `messages` per update) and
  // on mount, so an existing thread opens scrolled to its latest message.
  useEffect(() => {
    const el = messagesRef.current;
    if (!el || !pinnedRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // When the assistant was opened from an article, surface that scope to the
  // user (a chip + starter questions) so the "Ask about this article" action
  // visibly carries context. Falls back to the slug if a title isn't present.
  const articleCtx = published?.route === "/articles/[slug]" ? published : null;
  const articleTitle =
    articleCtx?.articleTitle ?? articleCtx?.articleSlug ?? null;

  function sendSuggestion(text: string) {
    if (busy) return;
    sendMessage({ text });
  }

  // Run a command template: either send it straight away, or prefill the input
  // and focus it (cursor at end) so the user can finish the prompt — used for
  // templates that need a ticker or an attached screenshot.
  function runTemplate(t: (typeof COMMAND_TEMPLATES)[number]) {
    if (busy) return;
    if (t.prefill) {
      setInput(t.prompt);
      // Focus after the value lands so the caret sits at the end.
      requestAnimationFrame(() => {
        const el = textInputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      });
      return;
    }
    sendMessage({ text: t.prompt });
  }

  // Staged image attachment (portfolio screenshot → gap analysis). Sent with the
  // next message, then cleared. Bytes are never persisted (stripped server-side).
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  // Object URL for the staged thumbnail. Memoized + revoked so we don't leak a
  // new URL on every keystroke re-render while an image is attached.
  const filePreviewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  // Shared staging path for both file-picker selection and clipboard paste.
  function stageFile(picked: File | null) {
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      setFileError("Please attach an image.");
      return;
    }
    if (picked.size > MAX_IMAGE_BYTES) {
      setFileError("Image is too large (max 5 MB).");
      return;
    }
    setFileError(null);
    setFile(picked);
  }

  function handleFilePick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    // Reset the input so re-picking the same file fires onChange again.
    event.target.value = "";
    stageFile(picked);
  }

  // Paste an image straight from the clipboard (e.g. a screenshot). Falls
  // through to normal text paste when the clipboard holds no image.
  // Enter sends; Shift+Enter inserts a newline. Ignore Enter mid-IME-composition
  // so composing in CJK/etc. doesn't submit a half-typed word.
  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imageItem = Array.from(event.clipboardData.items).find((i) =>
      i.type.startsWith("image/"),
    );
    if (!imageItem) return;
    const blob = imageItem.getAsFile();
    if (!blob) return;
    event.preventDefault();
    stageFile(blob);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if ((!text && !file) || busy) return;
    const files = file
      ? [
          {
            type: "file" as const,
            mediaType: file.type,
            url: await fileToDataUrl(file),
            filename: file.name,
          },
        ]
      : undefined;
    sendMessage({ text, files });
    setInput("");
    setFile(null);
    setFileError(null);
  }

  return (
    <div className="chat">
      <div
        className="chat-messages"
        ref={messagesRef}
        onScroll={handleMessagesScroll}
      >
        {messages.length === 0 ? (
          <div className="my-auto flex flex-col items-center text-center gap-4 px-6">
            <Engraving name="owl" className="w-24 sm:w-28 h-auto opacity-90" />
            {articleTitle ? (
              <>
                <p className="chat-empty !my-0 max-w-[24rem]">
                  Ask about{" "}
                  <span className="text-cream font-medium">{articleTitle}</span>{" "}
                  — or anything across I/O Fund.
                </p>
                <div className="flex flex-wrap justify-center gap-2 max-w-[26rem]">
                  {ARTICLE_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendSuggestion(s)}
                      disabled={busy}
                      className="text-[12.5px] text-muted border border-border rounded-full px-3 py-1.5 hover:text-cream hover:border-muted-deep transition-colors disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="chat-empty !my-0 max-w-[22rem]">
                  Ask about a ticker, I/O Fund&rsquo;s thesis, or recent
                  activity.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-[30rem] text-left">
                  {COMMAND_TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => runTemplate(t)}
                      disabled={busy}
                      className="group rounded-xl border border-border bg-surface-2/40 px-3.5 py-2.5 hover:border-muted-deep hover:bg-surface-2/70 transition-colors disabled:opacity-50"
                    >
                      <div className="text-[13.5px] font-semibold text-cream">
                        {t.label}
                      </div>
                      <div className="text-[11.5px] text-muted-deep mt-0.5 leading-snug">
                        {t.hint}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          messages.map((message, index) => {
            const isLast = index === messages.length - 1;
            const isStreaming = busy && isLast && message.role === "assistant";
            return (
              <Message
                key={message.id}
                message={message}
                showThinking={isStreaming}
              />
            );
          })
        )}
        {error ? (
          <div className="chat-error">Error: {error.message}</div>
        ) : null}
      </div>
      {file && filePreviewUrl ? (
        <div className="chat-attachment">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={filePreviewUrl}
            alt="Attached portfolio screenshot"
            className="chat-attachment-thumb"
          />
          <span className="chat-attachment-name">
            {file.name || "Pasted image"}
          </span>
          <button
            type="button"
            onClick={() => setFile(null)}
            aria-label="Remove attachment"
            className="chat-attachment-remove"
          >
            ×
          </button>
        </div>
      ) : null}
      {fileError ? <div className="chat-error">{fileError}</div> : null}
      {articleTitle && (
        <div
          className="flex items-center gap-1.5 self-start max-w-full text-[12px] text-muted bg-surface-2/60 border border-border rounded-full pl-2 pr-3 py-1 mb-0.5"
          title={`Asking about ${articleTitle}`}
        >
          <span className="text-orange shrink-0" aria-hidden="true">
            ✦
          </span>
          <span className="truncate">
            Asking about <span className="text-cream">{articleTitle}</span>
          </span>
        </div>
      )}
      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFilePick}
        />
        <button
          type="button"
          className="chat-attach-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          aria-label="Attach a portfolio screenshot"
          title="Attach a portfolio screenshot"
        >
          <PaperclipGlyph />
        </button>
        <textarea
          ref={textInputRef}
          className="chat-input"
          rows={1}
          placeholder="Ask about I/O Fund..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={busy}
          autoFocus
        />
        <button
          className="cta"
          type="submit"
          disabled={busy || (!input.trim() && !file)}
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
      <label className="chat-model-picker" title="Model for the next message">
        <select
          className="chat-model-select"
          value={model}
          onChange={(e) => changeModel(e.target.value)}
          aria-label="Model"
        >
          {CHAT_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="chat-model-caret">
          ▾
        </span>
      </label>
    </div>
  );
}

/**
 * Construct the compact `x-page-context` JSON the chat client sends per request.
 *
 * `route` comes from the current pathname; article slug / tickers / docName come
 * from whatever the page published via useSetPageContext(). When no producer
 * published a docName for a fund doc page, we derive it from the pathname so the
 * fund pages can stay pure server components.
 *
 * Returns null (→ no header) for unknown pages with no published context.
 */
function buildPageContextHeader(
  pathname: string | null,
  published: PageContext | null,
): string | null {
  // A producer published context (article / portfolio) — trust it, but ensure
  // a docName is present for fund docs if it derived from the path.
  if (published) {
    return JSON.stringify(published);
  }

  if (!pathname) return null;

  if (pathname === "/fund/strategy") {
    return JSON.stringify({ route: "/fund/strategy", docName: "strategy" });
  }
  if (pathname === "/fund/thesis") {
    return JSON.stringify({ route: "/fund/thesis", docName: "thesis" });
  }

  return JSON.stringify({ route: pathname });
}

function Message({
  message,
  showThinking,
}: {
  message: UIMessage;
  showThinking: boolean;
}) {
  const textParts = message.parts.filter((part) => part.type === "text");
  const combinedText = textParts.map((part) => part.text).join("");
  const sources = extractSources(message.parts);
  const images = message.parts.filter(
    (part): part is Extract<UIMessage["parts"][number], { type: "file" }> =>
      part.type === "file" && part.mediaType?.startsWith("image/"),
  );

  return (
    <div className={`chat-message chat-message-${message.role}`}>
      <div className="chat-message-role">
        {message.role === "user" ? "You" : "Assistant"}
      </div>
      <div className="chat-message-body">
        {images.map((part, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`img-${index}`}
            src={part.url}
            alt="Attached portfolio screenshot"
            className="chat-message-image"
          />
        ))}
        {showThinking ? (
          message.parts.map((part, index) => {
            if (part.type === "text") {
              if (!part.text) return null;
              return (
                <MarkdownBody key={index} headingAnchors={false}>
                  {part.text}
                </MarkdownBody>
              );
            }
            if (part.type.startsWith("tool-")) {
              return <ThinkingLine key={index} part={part} />;
            }
            return null;
          })
        ) : combinedText ? (
          <MarkdownBody headingAnchors={false}>{combinedText}</MarkdownBody>
        ) : null}
        {!showThinking && sources.length > 0 ? (
          <Sources sources={sources} />
        ) : null}
      </div>
    </div>
  );
}

type Source = { url: string; title: string; pubDate: string | null };

function extractSources(parts: UIMessage["parts"]): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const part of parts) {
    if (part.type !== "tool-read_article") continue;
    if (part.state !== "output-available") continue;
    const output = part.output as
      | { found: true; title: string; pub_date: string | null; body: string }
      | { found: false; message: string }
      | undefined;
    if (!output || !output.found) continue;
    const input = part.input as { url?: string } | undefined;
    const url = input?.url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sources.push({ url, title: output.title, pubDate: output.pub_date });
  }
  return sources;
}

function Sources({ sources }: { sources: Source[] }) {
  return (
    <div className="chat-sources">
      <div className="chat-sources-label">Sources</div>
      <ul className="chat-sources-list">
        {sources.map((s) => (
          <li key={s.url}>
            <a
              className="chat-sources-link"
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {s.title}
            </a>
            {s.pubDate ? (
              <span className="chat-sources-date">{s.pubDate}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ThinkingLine({ part }: { part: UIMessage["parts"][number] }) {
  if (!part.type.startsWith("tool-")) return null;
  const toolName = part.type.slice(5);
  // @ts-expect-error UIMessage part types don't expose input directly; runtime shape is fine.
  const input = part.input as Record<string, unknown> | undefined;
  const label = describeToolCall(toolName, input);
  return (
    <div className="chat-thinking">
      <span className="chat-thinking-dot" />
      <span className="chat-thinking-label">{label}</span>
    </div>
  );
}

function describeToolCall(
  toolName: string,
  input: Record<string, unknown> | undefined,
): string {
  switch (toolName) {
    case "query_trades": {
      const ticker = typeof input?.ticker === "string" ? input.ticker : null;
      return ticker
        ? `Querying trades for ${ticker.toUpperCase()}…`
        : "Querying trades…";
    }
    case "read_doc": {
      const name = typeof input?.name === "string" ? input.name : null;
      return name ? `Reading ${name} doc…` : "Reading doc…";
    }
    case "search_articles": {
      const query = typeof input?.query === "string" ? input.query : null;
      return query
        ? `Searching articles for "${query}"…`
        : "Searching articles…";
    }
    case "read_article": {
      return "Reading article…";
    }
    case "analyze_portfolio_gap": {
      return "Comparing your portfolio to I/O Fund…";
    }
    default:
      return `Running ${toolName}…`;
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function PaperclipGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
