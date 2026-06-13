"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  usePageContext,
  type PageContext,
} from "@/lib/page-context/context";

export function ChatThread({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: UIMessage[];
}) {
  const [input, setInput] = useState("");

  // Per-turn page context: build the `x-page-context` header from the current
  // route + whatever the page published via useSetPageContext(). The transport
  // is constructed once (per threadId), but useChat resolves `headers` per
  // request — so we read the LATEST context through a ref the closure captures.
  // The drawer/page only PRODUCE the header here; the system-prompt injection
  // lives entirely in /api/chat (see lib/chat/page-context-prompt.ts).
  const pathname = usePathname();
  const published = usePageContext();
  const headerValue = useMemo(
    () => buildPageContextHeader(pathname, published),
    [pathname, published],
  );
  const headerRef = useRef(headerValue);
  headerRef.current = headerValue;

  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // threadId travels with every request so /api/chat persists the
      // user + assistant messages into this thread.
      body: { threadId },
      // `headers` is a Resolvable in AI SDK v6 — evaluated per request. Reading
      // the ref means navigation updates the context without rebuilding the
      // transport (which would reset useChat state).
      headers: (): Record<string, string> => {
        const value = headerRef.current;
        return value ? { "x-page-context": value } : {};
      },
    }),
  });

  const busy = status === "streaming" || status === "submitted";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className="chat">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <p className="chat-empty">
            Ask about a ticker, IOF&rsquo;s thesis, or recent activity.
          </p>
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
      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          className="chat-input"
          type="text"
          placeholder="Ask about IOF..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          autoFocus
        />
        <button className="cta" type="submit" disabled={busy || !input.trim()}>
          {busy ? "…" : "Send"}
        </button>
      </form>
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

  return (
    <div className={`chat-message chat-message-${message.role}`}>
      <div className="chat-message-role">
        {message.role === "user" ? "You" : "Companion"}
      </div>
      <div className="chat-message-body">
        {showThinking
          ? message.parts.map((part, index) => {
              if (part.type === "text") {
                if (!part.text) return null;
                return (
                  <Markdown key={index}>{part.text}</Markdown>
                );
              }
              if (part.type.startsWith("tool-")) {
                return <ThinkingLine key={index} part={part} />;
              }
              return null;
            })
          : combinedText
            ? <Markdown>{combinedText}</Markdown>
            : null}
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

function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
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
      return query ? `Searching articles for "${query}"…` : "Searching articles…";
    }
    case "read_article": {
      return "Reading article…";
    }
    default:
      return `Running ${toolName}…`;
  }
}
