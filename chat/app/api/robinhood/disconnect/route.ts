import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { deleteRobinhoodConnection } from "@/lib/robinhood/connection";

export const dynamic = "force-dynamic";

export async function POST() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  await deleteRobinhoodConnection(session.user.id);
  return NextResponse.json({ ok: true });
}
