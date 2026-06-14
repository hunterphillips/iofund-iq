import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import {
  deleteThread,
  getThreadOwned,
  updateThreadTitle,
} from "@/lib/chat/threads";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

// PATCH /api/chat/threads/[id] → update the thread title.
export async function PATCH(request: Request, { params }: Params) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;

  // Ownership: 404 if the thread doesn't exist or isn't theirs.
  const owned = await getThreadOwned(id, session.user.id);
  if (!owned) {
    return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  }

  let title: string;
  try {
    const body = (await request.json()) as { title?: unknown };
    if (typeof body?.title !== "string" || !body.title.trim()) {
      return NextResponse.json(
        { error: "title is required." },
        { status: 400 },
      );
    }
    title = body.title.trim().slice(0, 200);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const thread = await updateThreadTitle(id, title);
  return NextResponse.json({ thread });
}

// DELETE /api/chat/threads/[id] → delete the thread (messages cascade).
export async function DELETE(_request: Request, { params }: Params) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;

  const owned = await getThreadOwned(id, session.user.id);
  if (!owned) {
    return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  }

  await deleteThread(id);
  return NextResponse.json({ ok: true });
}
