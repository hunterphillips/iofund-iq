import { and, asc, desc, eq } from "drizzle-orm";
import type { UIMessage } from "ai";
import { db, tables } from "@/db";

export type ChatThread = typeof tables.chatThreads.$inferSelect;
export type ChatMessageRow = typeof tables.chatMessages.$inferSelect;

export type ChatRole = "user" | "assistant" | "tool";

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
 * Append a message row. `content` is the full AI SDK UIMessage shape
 * ({ id, role, parts }) so reloads round-trip directly into useChat's
 * initial messages (preserving tool-call parts → render-layer Sources).
 */
export async function appendMessage(
  threadId: string,
  role: ChatRole,
  content: UIMessage,
): Promise<ChatMessageRow> {
  const [row] = await db
    .insert(tables.chatMessages)
    .values({
      id: crypto.randomUUID(),
      threadId,
      role,
      content,
    })
    .returning();
  return row;
}

/** Bump last_message_at + updated_at to now. */
export async function touchThread(id: string): Promise<void> {
  const now = new Date();
  await db
    .update(tables.chatThreads)
    .set({ lastMessageAt: now, updatedAt: now })
    .where(eq(tables.chatThreads.id, id));
}

/** Map stored rows back into AI SDK UIMessages for useChat initial state. */
export function rowsToUIMessages(rows: ChatMessageRow[]): UIMessage[] {
  return rows.map((r) => r.content as UIMessage);
}
