"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ChatThread() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
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

function Message({
  message,
  showThinking,
}: {
  message: UIMessage;
  showThinking: boolean;
}) {
  const textParts = message.parts.filter((part) => part.type === "text");
  const combinedText = textParts.map((part) => part.text).join("");

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
      </div>
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
