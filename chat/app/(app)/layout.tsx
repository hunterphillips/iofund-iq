import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import { hasIofCredentials } from "@/lib/iof/credentials";
import { AppChrome } from "@/components/app-chrome";
import { PageContextRoot } from "@/lib/page-context/context";
import { ActiveThreadProvider } from "@/lib/chat/active-thread";

export const dynamic = "force-dynamic";

// Persistent shell for every authenticated route. Server-side session gate;
// the interactive nav / avatar dropdown / drawer live in <AppChrome /> (client).
// Auth + onboarding routes stay OUTSIDE this group so they render chrome-free.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    redirect("/auth/sign-in");
  }
  // Defense-in-depth: the webhook gates account creation, but block any
  // pre-existing non-allowlisted account from reaching authenticated surfaces.
  if (!isEmailAllowed(session.user.email)) {
    redirect("/not-invited");
  }

  // Whether this user has saved (encrypted) I/O Fund credentials, so the account
  // menu can show connection status instead of a bare "Connect" action.
  const iofConnected = await hasIofCredentials(session.user.id);

  return (
    <PageContextRoot>
      <ActiveThreadProvider>
        <AppChrome
          email={session.user.email ?? null}
          name={session.user.name ?? null}
          iofConnected={iofConnected}
        >
          {children}
        </AppChrome>
      </ActiveThreadProvider>
    </PageContextRoot>
  );
}
