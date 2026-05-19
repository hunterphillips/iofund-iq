import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { auth } from "@/lib/auth/server";
import { hasIofCredentials } from "@/lib/iof/credentials";
import { chatTools } from "@/lib/chat/tools";
import { SYSTEM_PROMPT } from "@/lib/chat/system-prompt";

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

  const { messages } = (await request.json()) as { messages: UIMessage[] };

  const result = streamText({
    model: "anthropic/claude-sonnet-4-6",
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: chatTools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
