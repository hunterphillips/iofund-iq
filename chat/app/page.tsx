import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { hasIofCredentials } from "@/lib/iof/credentials";
import { ChatThread } from "@/components/chat-thread";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    return (
      <main className="page">
        <div className="container">
          <span className="badge">Phase 0 · scaffold</span>
          <h1 className="title">
            io<span className="accent">fund</span>-agent
          </h1>
          <p className="subtitle">
            Personal AI assistant over an I/O Fund subscription.
          </p>
          <div className="auth-state">
            <p className="status">
              Chat, weekly digest, and portfolio gap analysis arriving in this
              Phase 0 build.
            </p>
            <Link href="/auth/sign-in" className="cta">
              Sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!(await hasIofCredentials(session.user.id))) {
    redirect("/onboarding/connect-iof");
  }

  return (
    <main className="page chat-page">
      <header className="chat-header">
        <div className="chat-brand">
          io<span className="accent">fund</span>-agent
        </div>
        <div className="chat-meta">
          <span className="chat-user">{session.user.email}</span>
          <Link href="/auth/sign-out" className="link">
            Sign out
          </Link>
        </div>
      </header>
      <ChatThread />
    </main>
  );
}
