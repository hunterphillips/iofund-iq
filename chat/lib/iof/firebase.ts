/**
 * IOF authenticates against Google Identity Toolkit (Firebase Auth). The API
 * key below is a public client identifier — Firebase API keys are designed
 * to be visible in browser code; the security model relies on Firebase rules,
 * not key secrecy. Override via env if IOF ever rotates it.
 */
const FIREBASE_API_KEY =
  process.env.IOF_FIREBASE_API_KEY ??
  "AIzaSyBbWVb0wkR8tHpNezOqdU49hpgjjzzU6k0";

const SIGN_IN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;

export interface IofSignInOk {
  ok: true;
  idToken: string;
  refreshToken: string;
  localId: string;
  email: string;
  expiresIn: string;
}

export interface IofSignInErr {
  ok: false;
  /** Firebase error code (e.g. "EMAIL_NOT_FOUND", "INVALID_PASSWORD", "USER_DISABLED"). */
  code: string;
  /** Human-safe message; safe to surface to the user but kept generic. */
  message: string;
}

export type IofSignInResult = IofSignInOk | IofSignInErr;

/**
 * Verifies an IOF email+password against Firebase Identity Toolkit.
 * Returns tokens on success; a normalized error shape on failure.
 * Never throws on auth failures — only on transport errors.
 */
export async function verifyIofCredentials(
  email: string,
  password: string,
): Promise<IofSignInResult> {
  const response = await fetch(SIGN_IN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  const body = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const code =
      typeof body?.error === "object" && body?.error !== null
        ? String((body.error as Record<string, unknown>).message ?? "UNKNOWN")
        : "UNKNOWN";
    return {
      ok: false,
      code,
      message: friendlyMessage(code),
    };
  }

  return {
    ok: true,
    idToken: String(body.idToken),
    refreshToken: String(body.refreshToken),
    localId: String(body.localId),
    email: String(body.email),
    expiresIn: String(body.expiresIn),
  };
}

function friendlyMessage(code: string): string {
  // Don't leak whether email exists vs password is wrong — collapse to one message.
  if (
    code === "EMAIL_NOT_FOUND" ||
    code === "INVALID_PASSWORD" ||
    code.startsWith("INVALID_LOGIN_CREDENTIALS")
  ) {
    return "That email and password don't match an active I/O Fund account.";
  }
  if (code === "USER_DISABLED") {
    return "Your I/O Fund account is disabled. Contact I/O Fund support.";
  }
  if (code.startsWith("TOO_MANY_ATTEMPTS")) {
    return "Too many sign-in attempts. Wait a few minutes and try again.";
  }
  return "Couldn't sign in to I/O Fund. Try again in a moment.";
}
