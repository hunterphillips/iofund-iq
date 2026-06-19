import Link from "next/link";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { data: session } = await auth.getSession();
  const user = session?.user;

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-24">
      <div className="text-xs uppercase tracking-[0.18em] mb-3 text-orange">
        Profile
      </div>
      <h1 className="font-serif text-4xl leading-tight tracking-tight text-cream mb-12">
        Your account
      </h1>

      <div className="border border-border rounded-md bg-surface max-w-sm">
        <div className="px-6 py-4 border-b border-border">
          <div className="text-xs uppercase tracking-[0.12em] text-muted mb-1">
            Name
          </div>
          <div className="text-sm text-cream">{user?.name ?? "—"}</div>
        </div>
        <div className="px-6 py-4">
          <div className="text-xs uppercase tracking-[0.12em] text-muted mb-1">
            Email
          </div>
          <div className="text-sm text-cream">{user?.email ?? "—"}</div>
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-3 max-w-sm">
        <Link
          href="/onboarding/connect-iof"
          className="block px-4 py-2 rounded border border-border text-sm text-cream hover:bg-surface transition-colors"
        >
          Re-connect I/O Fund credentials
        </Link>
        <Link
          href="/onboarding/upload-portfolio"
          className="block px-4 py-2 rounded border border-border text-sm text-cream hover:bg-surface transition-colors"
        >
          Re-upload portfolio
        </Link>
        <Link
          href="/auth/sign-out"
          className="block px-4 py-2 rounded border border-border text-sm text-muted hover:text-cream hover:bg-surface transition-colors"
        >
          Sign out
        </Link>
      </div>
    </div>
  );
}
