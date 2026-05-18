import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { hasIofCredentials } from "@/lib/iof/credentials";
import { ConnectIofForm } from "./form";

export const dynamic = "force-dynamic";

export default async function ConnectIofPage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    redirect("/auth/sign-in");
  }
  if (await hasIofCredentials(session.user.id)) {
    redirect("/");
  }

  return (
    <main className="page">
      <div className="container auth-container">
        <span className="badge">Step 2 of 2</span>
        <h1 className="title-sm">
          Connect your <span className="accent">I/O Fund</span> account
        </h1>
        <p className="status">
          The assistant uses your subscription to read premium articles and
          alerts. Your credentials are encrypted at rest and never stored in
          plaintext or session cookies.
        </p>
        <ConnectIofForm />
      </div>
    </main>
  );
}
