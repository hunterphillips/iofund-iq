"use client";

// Mobile primary navigation — a fixed bottom tab bar shown only below `md`
// (the desktop centered nav in app-chrome.tsx is `hidden md:flex`). Renders the
// same three destinations as the desktop nav, reusing the shared NAV array and
// isActive() so the two stay in lockstep. Sits at z-30 — below the z-50
// assistant modal, which covers it full-screen on mobile.
//
// Safe-area: pads the bottom by env(safe-area-inset-bottom) so the bar clears
// the iOS home indicator; the active tab gets an orange icon + label.

import Link from "next/link";

type NavItem = { label: string; href: string };

export function BottomNav({
  items,
  isActive,
}: {
  items: NavItem[];
  isActive: (href: string) => boolean;
}) {
  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/85 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex items-stretch">
        {items.map((n) => {
          const active = isActive(n.href);
          return (
            <li key={n.href} className="flex-1">
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={
                  "flex flex-col items-center justify-center gap-1 h-[58px] text-[11px] font-medium transition-colors " +
                  (active ? "text-orange" : "text-muted hover:text-cream")
                }
              >
                <NavIcon href={n.href} />
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Destination glyphs — outlined to match the nav's stroke-based icon style. */
function NavIcon({ href }: { href: string }) {
  if (href === "/articles") return <ArticlesGlyph />;
  if (href === "/portfolio") return <PortfolioGlyph />;
  return <OverviewGlyph />;
}

function OverviewGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function ArticlesGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3h11l3 3v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M8 9h7M8 13h7M8 17h4" />
    </svg>
  );
}

function PortfolioGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 9 9h-9z" />
      <path d="M12 3v9l6.5 6.5" opacity="0.55" />
    </svg>
  );
}
