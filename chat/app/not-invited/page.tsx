import Link from "next/link";

// Shown to a signed-in user whose email is not on the invite allowlist. The
// `user.before_create` webhook normally prevents such an account from existing
// at all; this page is the landing spot for the defense-in-depth layout guard
// (covers any account created before the webhook was registered). Lives outside
// the (app) group so it renders chrome-free.
export const dynamic = "force-dynamic";

export default function NotInvitedPage() {
  return (
    <main className="page">
      <div className="container auth-container">
        <span className="badge">Private beta</span>
        <h1 className="title-sm">
          You&rsquo;re not on the <span className="accent">invite list</span> yet
        </h1>
        <p className="status">
          Access to this app is currently limited to invited members. If you
          believe you should have access, contact the site owner with the email
          address you signed in with.
        </p>
        <Link
          href="/auth/sign-out"
          className="block px-4 py-2 rounded border border-border text-sm text-muted hover:text-cream hover:bg-surface transition-colors"
        >
          Sign out
        </Link>
      </div>
    </main>
  );
}
