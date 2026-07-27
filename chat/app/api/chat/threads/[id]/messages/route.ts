import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import {
  deleteMessagesFrom,
  getMessages,
  getThreadOwned,
  rowsToUIMessages,
} from "@/lib/chat/threads";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/chat/threads/[id]/messages → ordered message history for the thread.
export async function GET(_request: Request, { params }: Params) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;

  const owned = await getThreadOwned(id, session.user.id);
  if (!owned) {
    return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  }

  const rows = await getMessages(id);
  return NextResponse.json({ messages: rowsToUIMessages(rows) });
}

// DELETE /api/chat/threads/[id]/messages?from=<uiMessageId> → delete that
// message and everything after it. Used by the stop/interrupt rollback, which
// returns the stopped user message to the composer.
export async function DELETE(request: Request, { params }: Params) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;

  const owned = await getThreadOwned(id, session.user.id);
  if (!owned) {
    return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  }

  const from = new URL(request.url).searchParams.get("from");
  if (!from) {
    return NextResponse.json({ error: "Missing 'from'." }, { status: 400 });
  }

  const deleted = await deleteMessagesFrom(id, from);
  return NextResponse.json({ deleted });
}
