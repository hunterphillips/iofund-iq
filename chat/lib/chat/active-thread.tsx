"use client";

/**
 * ActiveThreadProvider — holds "which conversation is active" for the assistant
 * drawer (components/drawer-chat.tsx).
 *
 * Mounted once in app/(app)/layout.tsx alongside PageContextRoot, so it lives in
 * the persistent layout subtree and survives both route navigation and the
 * drawer unmounting on close (DrawerChat is mounted only while the drawer is
 * open). That's what lets the drawer resume the same thread the next time it
 * opens instead of defaulting to the most-recent one.
 *
 * In-memory only — no localStorage. Persisting the active thread across full
 * page reloads is optional polish.
 */

import { createContext, useContext, useState, type ReactNode } from "react";

interface ActiveThreadState {
  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;
}

const ActiveThreadCtx = createContext<ActiveThreadState>({
  activeThreadId: null,
  setActiveThreadId: () => {},
});

/** Root provider — mount once in app/(app)/layout.tsx. */
export function ActiveThreadProvider({ children }: { children: ReactNode }) {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  return (
    <ActiveThreadCtx.Provider value={{ activeThreadId, setActiveThreadId }}>
      {children}
    </ActiveThreadCtx.Provider>
  );
}

/** Read + write the shared active thread id. */
export function useActiveThread(): ActiveThreadState {
  return useContext(ActiveThreadCtx);
}
