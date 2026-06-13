import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { HoldingSchema } from "@/lib/portfolio/extract";
import { upsertUserHoldings } from "@/lib/portfolio/holdings";

export const dynamic = "force-dynamic";

const PayloadSchema = z.object({
  holdings: z.array(HoldingSchema).min(1),
  source: z.string().min(1).max(80),
});

export async function POST(request: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = PayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const uploadedAt = await upsertUserHoldings(
    session.user.id,
    parsed.data.holdings,
    parsed.data.source,
  );

  return NextResponse.json({ ok: true, uploadedAt: uploadedAt.toISOString() });
}
