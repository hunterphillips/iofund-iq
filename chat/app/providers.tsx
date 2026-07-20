"use client";

import { NeonAuthUIProvider } from "@neondatabase/auth-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      // Auth → app redirects must be a full document load, not SPA nav. The auth
      // pages import `@neondatabase/auth-ui/css`, whose un-layered Tailwind
      // Preflight overrides the app's @layer utilities if it lingers in the DOM
      // after a client-side redirect — producing the post-sign-in flash of
      // cramped headings, lost spacing, and collapsed `md:` nav links until a
      // manual reload. A hard navigation drops that stylesheet. (In-page sign-in
      // ↔ sign-up switching uses the `Link` prop below and stays SPA; both those
      // pages load the auth-ui css anyway, so there's no leak.)
      navigate={(href) => window.location.assign(href)}
      replace={(href) => window.location.replace(href)}
      // Post-auth destination. The library default is "/", which used to be a
      // pure redirector into the app but is now the public marketing landing —
      // signing in should land in the app, not on the pitch page.
      redirectTo="/fund"
      onSessionChange={() => router.refresh()}
      Link={Link}
      // TEMP (2026-06-23): "Sign in with Google" disabled. A rejected OAuth
      // sign-up (email not on the invite allowlist) silently bounces back to the
      // form with no feedback — the gate rejection happens in Neon's hosted OAuth
      // callback, which the AuthView can't surface as an error. Email/password
      // shows the rejection inline, so it stays enabled. Re-enable Google once the
      // errorCallbackURL + sign-in ?error banner is built (see the diagnosis in
      // the 2026-06-23 session).
      // social={{ providers: ["google"] }}
      // Client-side password rule mirroring Better Auth's server default (min 8;
      // the auth-ui library's own copy reads "8 characters at minimum"). Without
      // this the client accepts any non-empty password and the server rejects it
      // with an opaque "Password does not meet security requirements" toast; with
      // it, the form shows a precise inline error under the field instead (on the
      // first "Create account" attempt, then live on each keystroke after).
      credentials={{ passwordValidation: { minLength: 8 } }}
      // Override the library default email placeholder ("m@example.com"), which
      // reads as unfamiliar, and give the too-short error explicit copy (the
      // library default is the vague "Password too short").
      localization={{
        EMAIL_PLACEHOLDER: "you@example.com",
        PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
      }}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
