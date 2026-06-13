/**
 * Integration test for chat thread + message persistence against the real Neon DB.
 *
 * Run:  pnpm test:threads
 * Or:   pnpm exec tsx --env-file=.env.local evals/threads.test.ts
 *
 * Exercises lib/chat/threads.ts helpers directly with a synthetic user_id.
 * Simulates two requests in the same thread (append user msg, then assistant
 * msg) and asserts both persist in created order with content intact. Cleans up
 * all test rows in a finally block so the live DB isn't polluted.
 */

import type { UIMessage } from "ai";
import {
  appendMessage,
  createThread,
  deleteThread,
  deriveTitle,
  getMessages,
  getThread,
  getThreadOwned,
  listThreads,
  touchThread,
  updateThreadTitle,
} from "@/lib/chat/threads";

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures++;
  }
}

function userMessage(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function assistantMessage(id: string, text: string): UIMessage {
  return { id, role: "assistant", parts: [{ type: "text", text }] };
}

async function main() {
  console.log("\nthreads persistence integration test");
  console.log("─".repeat(50));

  const userId = `eval-test-user-${crypto.randomUUID()}`;
  const otherUserId = `eval-test-user-${crypto.randomUUID()}`;
  let threadId: string | null = null;

  try {
    // ── Create thread ────────────────────────────────────────────────────────
    console.log("\n[a] createThread");
    const thread = await createThread(userId);
    threadId = thread.id;
    assert(typeof thread.id === "string", "thread has id");
    assert(thread.userId === userId, "thread keyed to user");
    assert(thread.title === null, "new thread title is null");
    const createdLastMessageAt = thread.lastMessageAt;

    // ── Request 1: append a user message ─────────────────────────────────────
    console.log("\n[b] request 1 — append user message");
    const userMsg = userMessage("u1", "What is IOF's view on NVDA?");
    await appendMessage(threadId, "user", userMsg);
    // Title backfill (as /api/chat does)
    const title = deriveTitle(userMsg);
    if (title) await updateThreadTitle(threadId, title);
    const afterUser = await getMessages(threadId);
    assert(afterUser.length === 1, "1 message after request 1");

    // ── Request 1 (cont): append assistant message + touch ───────────────────
    console.log("\n[c] request 1 — append assistant message + touch");
    const asstMsg = assistantMessage("a1", "IOF is constructive on NVDA.");
    await appendMessage(threadId, "assistant", asstMsg);
    await touchThread(threadId);

    // ── Request 2: read back history ─────────────────────────────────────────
    console.log("\n[d] request 2 — read back full history (the AC)");
    const history = await getMessages(threadId);
    assert(history.length === 2, "both messages persist across requests");
    assert(history[0].role === "user", "first message is user (created order)");
    assert(
      history[1].role === "assistant",
      "second message is assistant (created order)",
    );
    const storedUser = history[0].content as UIMessage;
    const storedAsst = history[1].content as UIMessage;
    assert(
      storedUser.parts[0]?.type === "text" &&
        (storedUser.parts[0] as { text: string }).text ===
          "What is IOF's view on NVDA?",
      "user message content intact",
    );
    assert(
      storedAsst.parts[0]?.type === "text" &&
        (storedAsst.parts[0] as { text: string }).text ===
          "IOF is constructive on NVDA.",
      "assistant message content intact",
    );

    // ── listThreads + last_message_at advanced ───────────────────────────────
    console.log("\n[e] listThreads + last_message_at advanced");
    const threads = await listThreads(userId);
    assert(
      threads.some((t) => t.id === threadId),
      "listThreads includes the thread",
    );
    const refreshed = await getThread(threadId);
    assert(refreshed !== null, "getThread returns the thread");
    assert(
      refreshed!.lastMessageAt.getTime() > createdLastMessageAt.getTime(),
      `last_message_at advanced after touch (${createdLastMessageAt.toISOString()} → ${refreshed!.lastMessageAt.toISOString()})`,
    );
    assert(
      refreshed!.title === "What is IOF's view on NVDA?",
      "title auto-derived from first user message",
    );

    // ── Ownership ────────────────────────────────────────────────────────────
    console.log("\n[f] ownership enforcement");
    assert(
      (await getThreadOwned(threadId, userId)) !== null,
      "owner can read thread",
    );
    assert(
      (await getThreadOwned(threadId, otherUserId)) === null,
      "non-owner cannot read thread",
    );

    // ── PATCH title ──────────────────────────────────────────────────────────
    console.log("\n[g] update title");
    await updateThreadTitle(threadId, "NVDA discussion");
    const retitled = await getThread(threadId);
    assert(retitled!.title === "NVDA discussion", "title updated");

    // ── DELETE cascade ───────────────────────────────────────────────────────
    console.log("\n[h] delete cascades to messages");
    await deleteThread(threadId);
    const goneThread = await getThread(threadId);
    assert(goneThread === null, "thread gone after delete");
    const goneMessages = await getMessages(threadId);
    assert(goneMessages.length === 0, "messages cascade-deleted");
    threadId = null; // already deleted; skip cleanup
  } finally {
    // Defensive cleanup in case an assertion threw before the explicit delete.
    if (threadId) {
      await deleteThread(threadId);
      console.log("\n  (cleaned up test thread)");
    }
  }

  console.log("\n" + "─".repeat(50));
  if (failures === 0) {
    console.log("All assertions passed.");
  } else {
    console.error(`${failures} assertion(s) FAILED.`);
  }
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(2);
});
