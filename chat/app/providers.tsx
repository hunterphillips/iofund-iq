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
      // Override the library default email placeholder ("m@example.com"),
      // which reads as unfamiliar, with the more conventional form.
      localization={{ EMAIL_PLACEHOLDER: "you@example.com" }}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
