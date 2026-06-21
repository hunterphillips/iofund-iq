import { isEmailAllowed } from "@/lib/auth/allowlist";
import { verifyNeonWebhook } from "@/lib/auth/neon-webhook";

// Neon Auth `user.before_create` blocking webhook — the registration gate.
//
// Neon pauses account creation until this endpoint responds. It fires on the
// FIRST account creation for both email/password and Google OAuth (the payload
// carries `event_data.auth_provider`), which is what closes the "anyone can own
// a Google account" gap: the gate is server-side at row-creation time.
//
// Response contract (per Neon docs): return 2xx with `{ allowed: true }` to
// permit, or `{ allowed: false, error_message, error_code }` to reject. A
// non-2xx / invalid response makes Neon fail CLOSED (signup rejected), so a bad
// signature here safely blocks the signup.
//
// The raw body must be read with request.text() BEFORE JSON.parse — the
// signature is over the exact bytes.

export const runtime = "nodejs"; // signature verification uses node:crypto
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    await verifyNeonWebhook(rawBody, request.headers);
  } catch (err) {
    // Reject the request outright — Neon fail-closes the signup on non-2xx.
    console.error("[neon-webhook] signature verification failed:", err);
    return new Response("invalid signature", { status: 401 });
  }

  const eventType = request.headers.get("x-neon-event-type");
  const payload = JSON.parse(rawBody) as {
    user?: { email?: string };
    event_data?: { auth_provider?: string };
  };

  if (eventType === "user.before_create") {
    const email = payload.user?.email;
    if (isEmailAllowed(email)) {
      return Response.json({ allowed: true });
    }
    console.warn(
      `[neon-webhook] rejected signup for ${email ?? "<no email>"} ` +
        `(provider=${payload.event_data?.auth_provider ?? "?"})`,
    );
    return Response.json({
      allowed: false,
      error_message:
        "This is a private beta. Sign-ups are by invitation only — contact the site owner for access.",
      error_code: "NOT_INVITED",
    });
  }

  // Any other event type we happen to receive: acknowledge without action.
  return Response.json({ received: true });
}
