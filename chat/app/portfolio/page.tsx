import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { hasIofCredentials } from "@/lib/iof/credentials";
import { getUserHoldings } from "@/lib/portfolio/holdings";
import { PortfolioForm } from "./form";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    redirect("/auth/sign-in");
  }
  if (!(await hasIofCredentials(session.user.id))) {
    redirect("/onboarding/connect-iof");
  }

  const saved = await getUserHoldings(session.user.id);

  return (
    <main className="page">
      <div className="container portfolio-container">
        <h1 className="title-sm">
          Your <span className="accent">portfolio</span>
        </h1>
        <p className="status">
          Upload a screenshot of your brokerage holdings. The assistant
          compares your book against I/O Fund's current positions to surface
          gaps and over/under-weightings.
        </p>
        <PortfolioForm
          mode="settings"
          initial={
            saved
              ? {
                  holdings: saved.holdings,
                  uploadedAt: saved.uploadedAt.toISOString(),
                  source: saved.source,
                }
              : null
          }
        />
      </div>
    </main>
  );
}
