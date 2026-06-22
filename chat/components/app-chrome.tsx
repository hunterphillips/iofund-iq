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
import { OPEN_ASSISTANT_EVENT } from "@/lib/chat/open-assistant";

const NAV: { label: string; href: string }[] = [
  { label: "Overview", href: "/fund" },
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
                    Connect I/O Fund credentials
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

/** The I/O Fund "io" infinity mark (traced from the brand PNG with potrace).
 *  Coords live in a 10× space flipped on Y, hence the group transform. Fills
 *  with currentColor so it inherits the button's text color. */
function IoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 930 624"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <g transform="translate(0,624) scale(0.1,-0.1)">
        <path d="M521 6229 c-186 -31 -367 -168 -450 -341 -48 -101 -61 -161 -61 -281 0 -114 18 -186 72 -290 79 -152 236 -273 404 -313 110 -26 268 -16 366 23 317 125 478 464 371 783 -98 296 -391 470 -702 419z M6095 5810 c-684 -76 -1292 -366 -1770 -845 -184 -184 -344 -395 -482 -635 -66 -115 -2010 -3129 -2036 -3158 -23 -25 -42 -36 -124 -77 -198 -98 -417 -16 -516 193 l-32 67 -3 1616 -2 1616 -92 -34 c-298 -112 -594 -102 -891 30 l-58 26 4 -1667 c3 -1522 5 -1674 20 -1750 123 -600 551 -1040 1130 -1164 134 -28 385 -30 527 -5 189 35 382 114 550 226 93 61 274 234 337 321 22 30 237 361 477 735 241 374 453 700 472 725 31 42 1035 1603 1134 1763 24 39 81 128 126 197 292 445 836 753 1392 789 332 21 640 -39 937 -184 218 -106 361 -211 541 -398 140 -145 226 -266 317 -448 228 -451 265 -932 110 -1414 -86 -269 -232 -511 -438 -724 -298 -310 -676 -498 -1113 -556 -484 -64 -1006 84 -1392 395 -95 77 -160 116 -226 138 -339 113 -684 -133 -684 -488 0 -191 79 -323 288 -483 428 -328 909 -528 1418 -591 704 -87 1393 74 1979 463 160 106 290 214 446 370 167 168 245 262 370 450 234 352 386 749 456 1191 26 166 26 665 0 830 -59 372 -174 706 -349 1011 -143 251 -284 435 -483 634 -441 438 -1000 721 -1615 816 -152 24 -581 35 -725 19z" />
      </g>
    </svg>
  );
}

/** Two-point "sparkle" — the AI mark for the assistant (a large four-point
 *  star with a smaller companion), replacing the old single-star glyph. */
function SparkleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M10 4.5C10.7 9 13 11.3 17.5 12 13 12.7 10.7 15 10 19.5 9.3 15 7 12.7 2.5 12 7 11.3 9.3 9 10 4.5Z" />
      <path d="M18 2.5C18.3 4.2 19.3 5.2 21 5.5 19.3 5.8 18.3 6.8 18 8.5 17.7 6.8 16.7 5.8 15 5.5 16.7 5.2 17.7 4.2 18 2.5Z" />
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
