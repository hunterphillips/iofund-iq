"use client";

// Persistent app chrome for the authenticated route group (app/(app)/layout.tsx).
//
// Renders:
//   · top nav — IOF wordmark (left), four destinations (center, active tab gets
//     a 2px orange underline + full opacity; others 55% opacity), avatar
//     dropdown + drawer toggle (right);
//   · a right-side drawer <aside> housing the working assistant chat
//     (<DrawerChat />), mounted only while open so its thread list reloads each
//     time and no chat state lingers while closed.
//
// State (drawer open/closed, dropdown open/closed) lives here, in the layout's
// client subtree, so it persists across route navigation (the layout does not
// remount between sibling routes). The drawer's active thread is shared with the
// /chat view via ActiveThreadProvider (mounted in app/(app)/layout.tsx); the
// per-turn page context flows through PageContextRoot, not prop-drilling.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DrawerChat } from "./drawer-chat";

const NAV: { label: string; href: string }[] = [
  { label: "Fund", href: "/fund" },
  { label: "Articles", href: "/articles" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Chat", href: "/chat" },
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

  const initials = deriveInitials(name, email);

  return (
    <div className="min-h-screen bg-bg text-cream font-sans">
      <header className="border-b border-border">
        <div className="max-w-[1100px] mx-auto px-8 h-20 flex items-center justify-between">
          <Link href="/fund" className="font-serif text-2xl tracking-tight">
            <span className="text-orange">I/O</span> Fund
          </Link>

          <nav className="hidden sm:flex items-center gap-8 text-sm tracking-wide">
            {NAV.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    "pb-1 border-b-2 transition-opacity hover:opacity-100 " +
                    (active
                      ? "opacity-100 border-orange"
                      : "opacity-55 border-transparent")
                  }
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label="Toggle assistant"
              aria-expanded={drawerOpen}
              className="w-9 h-9 rounded-full flex items-center justify-center border border-border text-muted hover:text-cream transition-colors"
            >
              <ChatGlyph />
            </button>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold border border-border hover:border-muted transition-colors"
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

      {/* Right-side assistant drawer — working chat. ~420px on desktop,
          full-screen modal on mobile. */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            aria-label="Assistant"
            className="fixed top-0 right-0 h-screen w-full sm:w-[420px] bg-surface border-l border-border z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-6 h-20 border-b border-border">
              <span className="font-serif text-lg tracking-tight">Assistant</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close assistant"
                className="text-muted hover:text-cream transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>
            <DrawerChat />
          </aside>
        </>
      )}
    </div>
  );
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

function ChatGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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
