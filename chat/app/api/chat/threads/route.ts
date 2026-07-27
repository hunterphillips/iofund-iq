import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { createThread, listThreads, searchThreads } from "@/lib/chat/threads";

export const dynamic = "force-dynamic";

// GET /api/chat/threads → list the signed-in user's threads (newest activity first).
// GET /api/chat/threads?q=... → search threads by title + message text.
export async function GET(request: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (q) {
    const threads = await searchThreads(session.user.id, q.slice(0, 200));
    return NextResponse.json({ threads });
  }

  const threads = await listThreads(session.user.id);
  return NextResponse.json({ threads });
}

// POST /api/chat/threads → create a new empty thread, return its id.
export async function POST(request: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let title: string | null = null;
  try {
    const body = (await request.json()) as { title?: unknown };
    if (typeof body?.title === "string" && body.title.trim()) {
      title = body.title.trim().slice(0, 200);
    }
  } catch {
    // Empty / invalid body is fine — create an untitled thread.
  }

  const thread = await createThread(session.user.id, title);
  return NextResponse.json({ thread }, { status: 201 });
}
