"use client";

// Persistent app chrome for the authenticated route group (app/(app)/layout.tsx).
//
// Renders:
//   · sticky top nav — IOF wordmark (left), the three destinations (centered,
//     active tab gets a 2px orange underline), and the nav-right cluster: a
//     light/dark theme toggle, the "Assistant" button that opens the chat
//     drawer, and the avatar dropdown;
//   · a centered assistant modal (<AssistantModal />) — two-pane layout with a
//     conversation sidebar + chat surface, full-screen on mobile — mounted only
//     while open so its thread list reloads each time and no chat state lingers
//     while closed.
//
// Chat lives ONLY in this modal — there is no separate /chat destination.
//
// State (drawer open/closed, dropdown open/closed) lives here, in the layout's
// client subtree, so it persists across route navigation (the layout does not
// remount between sibling routes). The theme toggle mutates data-theme on
// <html> directly (the value is applied pre-hydration in app/layout.tsx). The
// per-turn page context flows through PageContextRoot, not prop-drilling.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AssistantModal } from "./assistant-modal";
import { BottomNav } from "./bottom-nav";
import { IoMark } from "./io-mark";
import { SparkleGlyph } from "./sparkle-glyph";
import { OPEN_ASSISTANT_EVENT } from "@/lib/chat/open-assistant";

const NAV: { label: string; href: string }[] = [
  { label: "Overview", href: "/fund" },
  { label: "Articles", href: "/articles" },
  { label: "Portfolio", href: "/portfolio" },
];

export function AppChrome({
  email,
  name,
  iofConnected = false,
  robinhoodStatus = "none",
  children,
}: {
  email: string | null;
  name: string | null;
  iofConnected?: boolean;
  /** Optional brokerage link: none | active | expired (refresh failed). */
  robinhoodStatus?: "none" | "active" | "expired";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the avatar dropdown on outside-click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Close the drawer on Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Let deep pages open the drawer (e.g. "Ask about this article" CTA).
  useEffect(() => {
    function open() {
      setDrawerOpen(true);
    }
    window.addEventListener(OPEN_ASSISTANT_EVENT, open);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, open);
  }, []);

  const initials = deriveInitials(name, email);

  return (
    <div className="relative z-10 min-h-screen text-cream font-sans">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="relative max-w-[1180px] mx-auto px-8 h-[68px] flex items-center justify-between gap-4">
          <Link
            href="/fund"
            aria-label="I/O Fund"
            className="inline-flex items-center gap-1.5 font-serif text-xl font-semibold tracking-tight whitespace-nowrap"
          >
            <IoMark className="h-[0.9em] w-[1.34em] text-orange" />
            Fund
          </Link>

          <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            {NAV.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    "relative px-4 py-2 rounded-lg text-[15px] font-medium transition-colors hover:text-cream " +
                    (active ? "text-cream" : "text-muted")
                  }
                >
                  {n.label}
                  {active && (
                    <span className="absolute left-4 right-4 -bottom-[14px] h-0.5 rounded bg-orange" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label="Open assistant"
              aria-expanded={drawerOpen}
              className="grid place-items-center w-[38px] h-[38px] rounded-[10px] bg-orange text-white hover:brightness-110 transition-[filter]"
            >
              <SparkleGlyph />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle light or dark theme"
              className="theme-toggle w-[38px] h-[38px] rounded-[10px] border border-border bg-surface text-muted hover:text-cream hover:border-muted-deep transition-colors grid place-items-center"
            >
              <SunGlyph />
              <MoonGlyph />
            </button>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={
                  iofConnected
                    ? "Account menu"
                    : "Account menu — I/O Fund not connected"
                }
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="relative w-[38px] h-[38px] rounded-full grid place-items-center text-xs font-bold border border-border bg-surface text-muted hover:text-cream hover:border-muted-deep transition-colors"
              >
                {initials}
                {/* Attention dot when I/O Fund isn't connected yet — a required
                    setup step the user might not realize is pending. */}
                {!iofConnected && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-orange border-2 border-bg"
                    aria-hidden="true"
                  />
                )}
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 rounded-md border border-border bg-surface py-1 shadow-lg z-50"
                >
                  {email && (
                    <div className="px-4 py-2 text-xs text-muted-deep truncate border-b border-border">
                      {email}
                    </div>
                  )}

                  {/* I/O Fund connection status + connect/reconnect affordance. */}
                  <div className="px-4 py-2.5 border-b border-border">
                    <div className="flex items-center gap-2 text-[13px] text-cream">
                      <span
                        className={
                          "w-1.5 h-1.5 rounded-full " +
                          (iofConnected ? "bg-cat-energy" : "bg-orange")
                        }
                        aria-hidden="true"
                      />
                      {iofConnected
                        ? "I/O Fund connected"
                        : "I/O Fund not connected"}
                    </div>
                    <Link
                      href={
                        iofConnected
                          ? "/onboarding/connect-iof?reconnect=1"
                          : "/onboarding/connect-iof"
                      }
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="mt-1 inline-block text-xs font-semibold text-orange hover:underline"
                    >
                      {iofConnected ? "Reconnect" : "Connect now"}
                    </Link>
                  </div>

                  {/* Robinhood connection — optional, so no attention dot.
                      Connect/reconnect is a full document nav (OAuth redirect). */}
                  <div className="px-4 py-2.5 border-b border-border">
                    <div className="flex items-center gap-2 text-[13px] text-cream">
                      <span
                        className={
                          "w-1.5 h-1.5 rounded-full " +
                          (robinhoodStatus === "active"
                            ? "bg-cat-energy"
                            : robinhoodStatus === "expired"
                              ? "bg-orange"
                              : "bg-muted-deep")
                        }
                        aria-hidden="true"
                      />
                      {robinhoodStatus === "active"
                        ? "Robinhood connected"
                        : robinhoodStatus === "expired"
                          ? "Robinhood connection expired"
                          : "Robinhood not connected"}
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      {robinhoodStatus !== "active" && (
                        <a
                          href="/api/robinhood/connect"
                          role="menuitem"
                          className="inline-block text-xs font-semibold text-orange hover:underline"
                        >
                          {robinhoodStatus === "expired" ? "Reconnect" : "Connect"}
                        </a>
                      )}
                      {robinhoodStatus !== "none" && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={async () => {
                            await fetch("/api/robinhood/disconnect", {
                              method: "POST",
                            });
                            window.location.reload();
                          }}
                          className="text-xs font-semibold text-muted hover:text-cream hover:underline"
                        >
                          Disconnect
                        </button>
                      )}
                    </div>
                  </div>

                  <MenuLink href="/profile" onSelect={() => setMenuOpen(false)}>
                    Profile
                  </MenuLink>
                  <div className="my-1 border-t border-border" />
                  <MenuLink href="/auth/sign-out" onSelect={() => setMenuOpen(false)}>
                    Sign out
                  </MenuLink>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-16 border-t border-border pt-6 pb-24 md:pb-8">
        <div className="max-w-[1180px] mx-auto px-8 text-xs leading-relaxed text-muted">
          For informational purposes only. Not investment advice. Content is
          distilled from I/O Fund research; do your own due diligence before
          making any investment decision.
        </div>
      </footer>

      {/* Mobile primary nav — fixed bottom tab bar (hidden md+). The desktop
          nav above is hidden below md, so this is the only nav on phones. */}
      <BottomNav items={NAV} isActive={(href) => isActive(pathname, href)} />

      {/* Centered assistant modal — two-pane layout (conversation sidebar + chat),
          full-screen on mobile. Mounted only while open so the thread list
          reloads fresh and no chat state lingers while closed. */}
      {drawerOpen && <AssistantModal onClose={() => setDrawerOpen(false)} />}
    </div>
  );
}

/** Toggle data-theme on <html> and persist; pre-hydration script reads it back. */
function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
  root.setAttribute("data-theme", next);
  try {
    localStorage.setItem("theme", next);
  } catch {
    /* private mode / disabled storage — theme still applies for the session */
  }
}

function MenuLink({
  href,
  onSelect,
  children,
}: {
  href: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onSelect}
      className="block px-4 py-2 text-sm text-cream hover:bg-bg transition-colors"
    >
      {children}
    </Link>
  );
}

function SunGlyph() {
  return (
    <svg
      className="i-sun"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonGlyph() {
  return (
    <svg
      className="i-moon"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.6 6.6 0 0 0 21 12.8z" />
    </svg>
  );
}

/** Active when the pathname equals the destination or sits beneath it. */
function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

function deriveInitials(name: string | null, email: string | null): string {
  const source = (name ?? email ?? "").trim();
  if (!source) return "·";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
