import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { hasIofCredentials } from "@/lib/iof/credentials";
import { hasUserHoldings } from "@/lib/portfolio/holdings";
import { PortfolioForm } from "@/app/portfolio/form";

export const dynamic = "force-dynamic";

export default async function UploadPortfolioPage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    redirect("/auth/sign-in");
  }
  if (!(await hasIofCredentials(session.user.id))) {
    redirect("/onboarding/connect-iof");
  }
  if (await hasUserHoldings(session.user.id)) {
    redirect("/");
  }

  return (
    <main className="page">
      <div className="container auth-container">
        <span className="badge">Step 3 of 3 · Optional</span>
        <h1 className="title-sm">
          Upload your <span className="accent">portfolio</span>
        </h1>
        <p className="status">
          Drop a screenshot of your brokerage holdings. The assistant uses it
          to compare your book against I/O Fund&apos;s current positions. We
          extract just the ticker symbols and share counts — no dollar amounts
          stored. Skip if you&apos;d rather do this later.
        </p>
        <PortfolioForm mode="onboarding" initial={null} />
      </div>
    </main>
  );
}
