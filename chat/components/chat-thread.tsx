"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

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
          messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message chat-message-${message.role}`}
            >
              <div className="chat-message-role">
                {message.role === "user" ? "You" : "Companion"}
              </div>
              <div className="chat-message-body">
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return <span key={index}>{part.text}</span>;
                  }
                  if (part.type.startsWith("tool-")) {
                    const toolName = part.type.slice(5);
                    return (
                      <div key={index} className="chat-tool-call">
                        <code>tool · {toolName}</code>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))
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
