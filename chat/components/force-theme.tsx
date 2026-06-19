"use client";

import { useLayoutEffect } from "react";

/**
 * Pins `<html data-theme>` to a fixed value while mounted (the auth pages always
 * render in the light "printed paper" theme), restoring the user's real
 * preference on unmount. Deliberately does NOT write to localStorage, so the
 * authenticated app picks the saved/OS theme back up after sign-in.
 *
 * Pairs with a tiny inline script on the page itself (runs at parse time) to
 * avoid a first-paint flash on hard loads; this component additionally covers
 * client-side navigation into the page and the restore-on-leave.
 */
export function ForceTheme({ value }: { value: "light" | "dark" }) {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", value);
    return () => {
      document.documentElement.setAttribute("data-theme", preferredTheme());
    };
  }, [value]);

  return null;
}

/** The user's genuine theme preference (mirrors the bootstrap in app/layout.tsx). */
function preferredTheme(): "light" | "dark" {
  try {
    const t = localStorage.getItem("theme");
    if (t === "light" || t === "dark") return t;
  } catch {
    /* private mode / disabled storage */
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}
