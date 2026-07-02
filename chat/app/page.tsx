import Link from "next/link";
import { auth } from "@/lib/auth/server";
import { IoMark } from "@/components/io-mark";
import { SparkleGlyph } from "@/components/sparkle-glyph";
import { Engraving, RuleOrnament } from "@/components/engraving";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { ProductVignette } from "@/components/marketing/product-vignette";

export const dynamic = "force-dynamic";

// Public landing page. Replaces the former pure-redirector root. The real app
// stays gated behind sign-in (the (app) route group); this surface carries no
// real I/O Fund content — only marketing prose + fabricated product imagery.
export default async function Landing() {
  const { data: session } = await auth.getSession();
  const signedIn = Boolean(session?.user);

  return (
    <div className="relative z-10 min-h-screen">
      {/* Top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="inline-flex items-center gap-2 font-serif text-xl font-semibold tracking-tight text-cream">
          <IoMark className="h-[0.9em] w-[1.34em] text-orange" />
          Fund
        </div>
        {signedIn ? (
          <Link
            href="/fund"
            className="rounded-lg border border-border px-4 py-2 text-sm text-cream transition hover:border-muted-deep"
          >
            Open app
          </Link>
        ) : (
          <Link
            href="/auth/sign-in"
            className="text-sm text-muted underline-offset-4 transition hover:text-cream hover:underline"
          >
            Sign in
          </Link>
        )}
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-10 pb-16 sm:pt-16">
        <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-muted">
              <SparkleGlyph className="h-3.5 w-3.5 text-orange" />
              Coming soon · Private preview
            </span>
            <h1 className="mt-5 font-serif text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-cream sm:text-6xl">
              Ask your I/O&nbsp;Fund subscription anything.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              An independent AI assistant that reads every I/O Fund trade,
              article, and portfolio move, then answers in plain language with
              sources. Built for subscribers who want the signal without
              re-reading every alert.
            </p>

            {signedIn ? (
              <div className="mt-8 rounded-2xl border border-border bg-surface/70 p-6">
                <p className="font-serif text-xl text-cream">
                  You already have access.
                </p>
                <Link
                  href="/fund"
                  className="mt-4 inline-block rounded-xl bg-orange px-5 py-3 text-sm font-semibold text-bg transition hover:brightness-110"
                >
                  Open the app
                </Link>
              </div>
            ) : (
              <WaitlistForm className="mt-8 max-w-xl" />
            )}
          </div>

          {/* Visual: fabricated product mock + engraving accent */}
          <div className="relative lg:pt-10">
            <Engraving
              name="owl"
              className="pointer-events-none absolute -right-6 -top-10 -z-10 w-44 opacity-[0.12] sm:w-56"
            />
            <ProductVignette />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6">
        <RuleOrnament />
      </div>

      {/* Value props */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="max-w-2xl font-serif text-3xl font-semibold tracking-tight text-cream sm:text-4xl">
          Everything you pay for, finally answerable.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Ask in plain language",
              body: "Chat over the full trade log and distilled research. “Why did they trim that name?” “What’s the view on optical networking?” Answers cite the source.",
            },
            {
              title: "Never miss a move",
              body: "A weekly digest summarizes new trades and articles, and flags when fresh activity changes the running thesis. Read one note instead of fifty alerts.",
            },
            {
              title: "See your gaps",
              body: "Paste a brokerage screenshot and get a live read of where your holdings sit against the current book — over- and under-weights, by theme.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-surface/60 p-6"
            >
              <h3 className="font-serif text-xl text-cream">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Member / prospect framing */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-orange/30 bg-orange/[0.06] p-7">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-orange">
              Already a member
            </p>
            <h3 className="mt-3 font-serif text-2xl text-cream">
              Get more from a subscription you already pay for.
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Connect your account and the assistant works against your own
              authenticated content. Nothing is redistributed; it just makes
              what you already have easier to act on.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface/60 p-7">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-deep">
              Not a member yet
            </p>
            <h3 className="mt-3 font-serif text-2xl text-cream">
              See what a subscription unlocks.
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              The assistant is only as good as the research behind it. Join the
              list and we’ll point you to I/O Fund when access opens.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-2 font-serif text-lg font-semibold text-cream">
              <IoMark className="h-[0.9em] w-[1.34em] text-orange" />
              Fund
            </div>
            {!signedIn ? (
              <Link
                href="/auth/sign-in"
                className="text-sm text-muted underline-offset-4 transition hover:text-cream hover:underline"
              >
                Already invited? Sign in
              </Link>
            ) : null}
          </div>
          <p className="mt-6 max-w-2xl text-xs leading-relaxed text-muted-deep">
            Independent project. Not affiliated with, endorsed by, or operated by
            I/O Fund. All research, trade ideas, and framework material referenced
            belong to I/O Fund and are accessible only through a subscriber’s own
            authenticated account. For informational purposes only. Not
            investment advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
