import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { auth } from "@/lib/auth/server";
import { hasIofCredentials } from "@/lib/iof/credentials";
import { chatTools } from "@/lib/chat/tools";
import { SYSTEM_PROMPT } from "@/lib/chat/system-prompt";
import {
  appendMessage,
  deriveTitle,
  getThreadOwned,
  touchThread,
  updateThreadTitle,
} from "@/lib/chat/threads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return new Response("Not signed in.", { status: 401 });
  }
  if (!(await hasIofCredentials(session.user.id))) {
    return new Response("I/O Fund account not connected.", { status: 403 });
  }

  const { messages, threadId } = (await request.json()) as {
    messages: UIMessage[];
    threadId?: string;
  };

  // Client-creates-first: the thread is created via POST /api/chat/threads
  // before the first message is sent, so threadId is always present here.
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

  const result = streamText({
    model: "anthropic/claude-sonnet-4-6",
    system: SYSTEM_PROMPT,
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
