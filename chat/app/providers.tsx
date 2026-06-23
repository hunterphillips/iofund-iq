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
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => router.refresh()}
      Link={Link}
      social={{ providers: ["google"] }}
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
