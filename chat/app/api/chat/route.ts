import {
  convertToModelMessages,
  generateId,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { auth } from "@/lib/auth/server";
import { hasIofCredentials } from "@/lib/iof/credentials";
import { hasRobinhoodConnection } from "@/lib/robinhood/connection";
import { chatTools } from "@/lib/chat/tools";
import { resolveChatModel } from "@/lib/chat/models";
import { SYSTEM_PROMPT } from "@/lib/chat/system-prompt";
import { buildSystemPrompt } from "@/lib/chat/page-context-prompt";
import type { PageContext } from "@/lib/page-context/context";
import {
  appendMessage,
  deriveTitle,
  getThreadOwned,
  touchThread,
  updateThreadTitle,
} from "@/lib/chat/threads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Defensively parse the `x-page-context` request header into a PageContext.
 * Returns null when the header is absent or malformed — injection is best-effort
 * and must never break the chat request.
 */
function parsePageContext(raw: string | null): PageContext | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as { route?: unknown }).route === "string"
    ) {
      return parsed as PageContext;
    }
  } catch {
    // Malformed header — ignore.
  }
  return null;
}

export async function POST(request: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return new Response("Not signed in.", { status: 401 });
  }
  if (!(await hasIofCredentials(session.user.id))) {
    return new Response("I/O Fund account not connected.", { status: 403 });
  }

  const { messages, threadId, model } = (await request.json()) as {
    messages: UIMessage[];
    threadId?: string;
    model?: string;
  };

  // threadId is always present: the client resolves or lazily creates the
  // thread inside prepareSendMessagesRequest before the first send fires.
  if (!threadId) {
    return new Response("Missing threadId.", { status: 400 });
  }

  // Ownership: never write to another user's thread.
  const thread = await getThreadOwned(threadId, session.user.id);
  if (!thread) {
    return new Response("Thread not found.", { status: 404 });
  }

  // Persist the latest user message immediately (role + full UIMessage parts).
  // A DB failure here is caught and logged; we fail fast with 500 BEFORE
  // streaming starts so the client never receives a half-streamed response with
  // a missing user message in history.
  const latest = messages[messages.length - 1];
  if (latest && latest.role === "user") {
    try {
      await appendMessage(threadId, "user", latest);
      // Backfill an auto-derived title from the first user message.
      if (!thread.title) {
        const title = deriveTitle(latest);
        if (title) await updateThreadTitle(threadId, title);
      }
    } catch (err) {
      console.error("[chat] failed to persist user message", { threadId, err });
      return new Response("Failed to persist message.", { status: 500 });
    }
  }

  // Per-turn page context: the drawer/chat client sends a compact JSON
  // `x-page-context` header describing what the user is viewing. We parse it
  // defensively (absent/malformed → ignored) and prepend a single context
  // block to the system prompt. The client never mutates the prompt itself.
  const pageContext = parsePageContext(request.headers.get("x-page-context"));

  // Per-turn broker flag so the model knows whether portfolio questions need
  // a screenshot or can ride the Robinhood sync.
  const robinhoodNote = (await hasRobinhoodConnection(session.user.id))
    ? "\n\nBroker connection: the user HAS connected Robinhood. For portfolio questions, call analyze_portfolio_gap with no holdings (their synced positions are used automatically); do not ask for a screenshot."
    : "\n\nBroker connection: the user has NOT connected a brokerage. Portfolio questions need a portfolio screenshot attached in chat (or they can connect Robinhood from the account menu).";

  const result = streamText({
    model: resolveChatModel(model),
    system: buildSystemPrompt(SYSTEM_PROMPT, pageContext) + robinhoodNote,
    messages: await convertToModelMessages(messages),
    tools: chatTools,
    stopWhen: stepCountIs(5),
  });

  // Persist the assistant response (including tool-call parts → Sources) once
  // the stream finishes, then bump the thread's activity timestamp.
  // onFinish runs after the stream is flushed — failures are invisible to the
  // client, so we log and swallow rather than rethrow (which would reject the
  // stream tail in some runtimes).
  return result.toUIMessageStreamResponse({
    // Without this, the response message's id is "" (AI SDK only assigns one when
    // generateMessageId or originalMessages is provided). That empty id gets
    // persisted and streamed to the client, so a thread with two assistant turns
    // renders two <Message key=""> — React's duplicate-key warning.
    generateMessageId: generateId,
    onFinish: async ({ responseMessage }) => {
      try {
        await appendMessage(threadId, "assistant", responseMessage);
        await touchThread(threadId);
      } catch (err) {
        console.error("[chat] failed to persist assistant message", {
          threadId,
          err,
        });
      }
    },
  });
}
