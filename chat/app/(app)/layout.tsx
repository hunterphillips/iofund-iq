import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { AppChrome } from "@/components/app-chrome";

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

  return (
    <AppChrome email={session.user.email ?? null} name={session.user.name ?? null}>
      {children}
    </AppChrome>
  );
}
