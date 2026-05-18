import Link from "next/link";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: session } = await auth.getSession();
  const signedIn = !!session?.user;

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
        {signedIn ? (
          <div className="auth-state">
            <p className="status">
              Signed in as <strong>{session.user.email}</strong>.
            </p>
            <p className="status">
              Next: connect your I/O Fund subscription so the assistant can
              read your premium content. (Onboarding flow lands in the next
              build chunk.)
            </p>
            <Link href="/auth/sign-out" className="link">
              Sign out
            </Link>
          </div>
        ) : (
          <div className="auth-state">
            <p className="status">
              Chat, weekly digest, and portfolio gap analysis arriving in this
              Phase 0 build.
            </p>
            <Link href="/auth/sign-in" className="cta">
              Sign in
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
