import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getMessages, getThreadOwned, rowsToUIMessages } from "@/lib/chat/threads";

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
