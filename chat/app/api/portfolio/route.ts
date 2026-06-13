import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { deleteUserHoldings } from "@/lib/portfolio/holdings";

export const dynamic = "force-dynamic";

export async function DELETE() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  await deleteUserHoldings(session.user.id);
  return NextResponse.json({ ok: true });
}
