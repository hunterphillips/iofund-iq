import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { UIMessage } from "ai";
import { db, tables } from "@/db";

export type ChatThread = typeof tables.chatThreads.$inferSelect;
export type ChatMessageRow = typeof tables.chatMessages.$inferSelect;

// AI SDK v6 folds tool calls into assistant parts; only "user" and "assistant"
// are ever written — "tool" is not a produced role.
export type ChatRole = "user" | "assistant";

/** Derive a thread title from a user message's text parts. */
export function deriveTitle(message: UIMessage): string | null {
  const text = message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
  if (!text) return null;
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

export async function createThread(
  userId: string,
  title?: string | null,
): Promise<ChatThread> {
  const [row] = await db
    .insert(tables.chatThreads)
    .values({
      id: crypto.randomUUID(),
      userId,
      title: title ?? null,
    })
    .returning();
  return row;
}

export async function listThreads(userId: string): Promise<ChatThread[]> {
  return db
    .select()
    .from(tables.chatThreads)
    .where(eq(tables.chatThreads.userId, userId))
    .orderBy(desc(tables.chatThreads.lastMessageAt));
}

export interface ThreadSearchHit {
  id: string;
  title: string | null;
  lastMessageAt: Date;
  createdAt: Date;
  /** Matching message text (clipped around the first match), or null when only the title matched. */
  snippet: string | null;
}

/**
 * Search the user's threads by title and message text. Message bodies are the
 * stored UIMessage JSON, so text lives in content->'parts' elements with
 * type "text" — plain ILIKE over those; at personal-app scale no index needed.
 */
export async function searchThreads(
  userId: string,
  query: string,
): Promise<ThreadSearchHit[]> {
  const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const matchingText = sql`
    SELECT part->>'text'
    FROM ${tables.chatMessages} m,
      jsonb_array_elements(m.content->'parts') AS part
    WHERE m.thread_id = ${tables.chatThreads.id}
      AND part->>'type' = 'text'
      AND part->>'text' ILIKE ${pattern}
    ORDER BY m.created_at DESC
    LIMIT 1
  `;

  const rows = await db
    .select({
      id: tables.chatThreads.id,
      title: tables.chatThreads.title,
      lastMessageAt: tables.chatThreads.lastMessageAt,
      createdAt: tables.chatThreads.createdAt,
      snippet: sql<string | null>`(${matchingText})`,
    })
    .from(tables.chatThreads)
    .where(
      and(
        eq(tables.chatThreads.userId, userId),
        sql`(${tables.chatThreads.title} ILIKE ${pattern} OR EXISTS (${matchingText}))`,
      ),
    )
    .orderBy(desc(tables.chatThreads.lastMessageAt))
    .limit(30);

  return rows.map((r) => ({
    ...r,
    snippet: r.snippet ? clipAroundMatch(r.snippet, query) : null,
  }));
}

/** Clip a matched message to a readable window centered on the first hit. */
function clipAroundMatch(text: string, query: string): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text.length > 120 ? `${text.slice(0, 120)}…` : text;
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 80);
  return (
    (start > 0 ? "…" : "") +
    text.slice(start, end).trim() +
    (end < text.length ? "…" : "")
  );
}

export async function getThread(id: string): Promise<ChatThread | null> {
  const [row] = await db
    .select()
    .from(tables.chatThreads)
    .where(eq(tables.chatThreads.id, id))
    .limit(1);
  return row ?? null;
}

/** Fetch a thread only if it belongs to `userId` (ownership enforcement). */
export async function getThreadOwned(
  id: string,
  userId: string,
): Promise<ChatThread | null> {
  const [row] = await db
    .select()
    .from(tables.chatThreads)
    .where(
      and(eq(tables.chatThreads.id, id), eq(tables.chatThreads.userId, userId)),
    )
    .limit(1);
  return row ?? null;
}

export async function updateThreadTitle(
  id: string,
  title: string,
): Promise<ChatThread | null> {
  const [row] = await db
    .update(tables.chatThreads)
    .set({ title, updatedAt: new Date() })
    .where(eq(tables.chatThreads.id, id))
    .returning();
  return row ?? null;
}

export async function deleteThread(id: string): Promise<void> {
  // chat_messages cascade-delete via FK.
  await db.delete(tables.chatThreads).where(eq(tables.chatThreads.id, id));
}

export async function getMessages(threadId: string): Promise<ChatMessageRow[]> {
  return db
    .select()
    .from(tables.chatMessages)
    .where(eq(tables.chatMessages.threadId, threadId))
    .orderBy(asc(tables.chatMessages.createdAt));
}

/**
 * Strip `body` from any persisted `tool-read_article` parts.
 *
 * The render-layer Sources block (chat-thread.tsx extractSources) only reads
 * `output.title` and `output.pub_date` — not `output.body`. The body already
 * lives in `articles.body`, so persisting it in jsonb doubles storage by tens of
 * KB per message. This runs only on the copy being written to the DB; the live
 * stream is unaffected.
 *
 * Note: attached portfolio images (image `file` parts) ARE persisted, so the
 * thumbnail survives a reload in chat history — they're the user's own data in
 * their own row. (The vision-extraction pipeline in lib/portfolio still discards
 * its screenshots; that convention is about that flow, not chat history.)
 */
function sanitizeForPersistence(message: UIMessage): UIMessage {
  if (!Array.isArray(message.parts)) return message;

  const parts = message.parts.map((part) => {
    if (
      part.type !== "tool-read_article" ||
      (part as Record<string, unknown>).state !== "output-available"
    ) {
      return part;
    }

    const output = (part as Record<string, unknown>).output;
    if (
      output === null ||
      typeof output !== "object" ||
      !("body" in (output as object))
    ) {
      return part;
    }

    // Clone part, clone output, remove body.
    const { body: _body, ...outputWithoutBody } = output as Record<
      string,
      unknown
    >;
    return { ...(part as object), output: outputWithoutBody };
  });

  return { ...message, parts } as UIMessage;
}

/**
 * Append a message row. `content` is the full AI SDK UIMessage shape
 * ({ id, role, parts }) so reloads round-trip directly into useChat's
 * initial messages (preserving tool-call parts → render-layer Sources).
 *
 * Assistant messages are sanitized before storage: `body` is stripped from
 * `tool-read_article` parts (the body lives in _data/ + articles.body; the
 * render-layer Sources only needs title + pub_date). User messages (incl.
 * attached portfolio images) persist as-is.
 */
export async function appendMessage(
  threadId: string,
  role: ChatRole,
  content: UIMessage,
): Promise<ChatMessageRow> {
  const toStore = role === "assistant" ? sanitizeForPersistence(content) : content;
  const [row] = await db
    .insert(tables.chatMessages)
    .values({
      id: crypto.randomUUID(),
      threadId,
      role,
      content: toStore,
    })
    .returning();
  return row;
}

/**
 * Bump last_message_at + updated_at to now. Uses the DB clock (now()), not the
 * app clock, so these stay monotonic with the row's insert defaults (also DB
 * clock) — a JS `new Date()` here can land *before* the created timestamp when
 * the app machine's clock lags the Postgres server's.
 */
export async function touchThread(id: string): Promise<void> {
  await db
    .update(tables.chatThreads)
    .set({ lastMessageAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(tables.chatThreads.id, id));
}

/** Map stored rows back into AI SDK UIMessages for useChat initial state. */
export function rowsToUIMessages(rows: ChatMessageRow[]): UIMessage[] {
  return rows.flatMap((r) => {
    const msg = r.content;
    // Drop rows whose content isn't a valid UIMessage shape. One malformed or
    // legacy row must not hand useChat a partless message and crash the reload
    // render (#9/#10).
    if (
      msg === null ||
      typeof msg !== "object" ||
      !Array.isArray((msg as Record<string, unknown>).parts)
    ) {
      console.warn("[chat] dropping malformed message row", { id: r.id });
      return [];
    }
    return [msg as UIMessage];
  });
}
