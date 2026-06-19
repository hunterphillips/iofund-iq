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
import { OPEN_ASSISTANT_EVENT } from "@/lib/chat/open-assistant";

const NAV: { label: string; href: string }[] = [
  { label: "Fund", href: "/fund" },
  { label: "Articles", href: "/articles" },
  { label: "Portfolio", href: "/portfolio" },
];

export function AppChrome({
  email,
  name,
  children,
}: {
  email: string | null;
  name: string | null;
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
            className="font-serif text-xl font-semibold tracking-tight whitespace-nowrap"
          >
            I/<span className="text-orange">O</span> Fund
          </Link>

          <nav className="flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
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
              className="flex items-center gap-2 h-[38px] px-4 rounded-[10px] bg-orange text-white font-semibold text-sm hover:brightness-110 transition-[filter]"
            >
              <SparkGlyph />
              Assistant
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
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="w-[38px] h-[38px] rounded-full grid place-items-center text-xs font-bold border border-border bg-surface text-muted hover:text-cream hover:border-muted-deep transition-colors"
              >
                {initials}
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-60 rounded-md border border-border bg-surface py-1 shadow-lg z-50"
                >
                  {email && (
                    <div className="px-4 py-2 text-xs text-muted-deep truncate border-b border-border">
                      {email}
                    </div>
                  )}
                  <MenuLink href="/profile" onSelect={() => setMenuOpen(false)}>
                    Profile
                  </MenuLink>
                  <MenuLink href="/onboarding/connect-iof" onSelect={() => setMenuOpen(false)}>
                    Connect IOF credentials
                  </MenuLink>
                  <MenuLink href="/onboarding/upload-portfolio" onSelect={() => setMenuOpen(false)}>
                    Upload portfolio
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

function SparkGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.6 4.9L18.5 8.5 14 11l1.6 5L12 13.2 8.4 16 10 11 5.5 8.5l4.9-1.6z" />
    </svg>
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
