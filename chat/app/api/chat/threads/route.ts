import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { createThread, listThreads } from "@/lib/chat/threads";

export const dynamic = "force-dynamic";

// GET /api/chat/threads → list the signed-in user's threads (newest activity first).
export async function GET() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
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
