import { AuthView } from "@neondatabase/auth-ui";
// Scoped to the auth route on purpose: this stylesheet ships its own un-layered
// Tailwind Preflight, which would otherwise override the app's padding/font-size
// utilities everywhere (see app/globals.css note). Only the auth pages need it.
import "@neondatabase/auth-ui/css";
import { Engraving } from "@/components/engraving";
import { ForceTheme } from "@/components/force-theme";
import { IoMark } from "@/components/io-mark";

export const dynamic = "force-dynamic";

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  return (
    <main className="page">
      {/* Auth pages always render in the light theme. The pre-paint pin lives in
          the root layout's head script (route-aware); ForceTheme keeps it pinned
          on client navigation and restores the user's preference on leave. */}
      <ForceTheme value="light" />
      {/* Inline layout instead of the legacy .container/.auth-container classes:
          @neondatabase/auth-ui/css ships its own Tailwind `.container` utility
          that overrides ours here, so we pin width + centering inline. */}
      <div
        style={{
          width: "100%",
          maxWidth: "28rem",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        {/* Editorial sign-in hero — Athena's owl engraving + wordmark */}
        <div className="flex flex-col items-center text-center mb-2">
          <Engraving name="owl" className="w-[15em] h-auto opacity-90 mb-5" />
          <div className="inline-flex items-center gap-2 font-serif text-2xl font-semibold tracking-tight text-cream">
            <IoMark className="h-[0.9em] w-[1.34em] text-orange" />
            Fund
          </div>
          <p className="text-sm text-muted mt-2 max-w-[22rem] leading-relaxed">
            I/O Fund intelligence layer for research, trades, and portfolio
            analysis.
          </p>
        </div>
        {/* auth-light pins the Neon Auth form to a warm light palette regardless
            of next-themes' .dark class on <html>; scoped here so it doesn't
            touch the hero's text-muted (a different --color-muted semantic). */}
        <div className="auth-light w-full flex justify-center">
          <AuthView pathname={path} />
        </div>
      </div>
    </main>
  );
}
