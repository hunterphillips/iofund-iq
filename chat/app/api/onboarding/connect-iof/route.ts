import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { verifyIofCredentials } from "@/lib/iof/firebase";
import { upsertIofCredentials } from "@/lib/iof/credentials";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let payload: { email?: unknown; password?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email =
    typeof payload.email === "string" ? payload.email.trim() : "";
  const password =
    typeof payload.password === "string" ? payload.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Both email and password are required." },
      { status: 400 },
    );
  }

  const result = await verifyIofCredentials(email, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  await upsertIofCredentials(session.user.id, email, password);

  return NextResponse.json({ ok: true });
}
