import { NextRequest, NextResponse } from "next/server";
import { db, tables } from "@/db";
import { waitlistSignupSchema } from "@/lib/waitlist/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public, unauthenticated endpoint (the proxy allowlists it). Captures a
// landing-page waitlist signup. Dedupes on email via upsert so a repeat signup
// updates the row instead of 409-ing the visitor.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = waitlistSignupSchema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Check your details and try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { email, memberStatus, interest } = parsed.data;
  const now = new Date();

  await db
    .insert(tables.waitlist)
    .values({
      id: crypto.randomUUID(),
      email,
      memberStatus,
      interest,
      source: "landing",
      userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    })
    .onConflictDoUpdate({
      target: tables.waitlist.email,
      set: { memberStatus, interest: interest ?? null, updatedAt: now },
    });

  // Best-effort confirmation email. The Next app has no Resend dependency, so
  // this is a dependency-free REST call guarded on the key being present. A
  // failure here never fails the signup — the row is the asset, the email is
  // a courtesy.
  void sendConfirmation(email).catch(() => {});

  return NextResponse.json({ ok: true });
}

async function sendConfirmation(email: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const from = process.env.WAITLIST_FROM_EMAIL ?? "onboarding@resend.dev";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "You're on the list",
      text: [
        "Thanks for signing up.",
        "",
        "You'll be among the first invited when access opens. This is an",
        "independent assistant built for I/O Fund subscribers, not affiliated",
        "with I/O Fund.",
      ].join("\n"),
    }),
  });
}
