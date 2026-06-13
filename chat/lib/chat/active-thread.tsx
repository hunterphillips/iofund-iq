"use client";

/**
 * ActiveThreadProvider — shared "which conversation is active" state across the
 * drawer (components/drawer-chat.tsx) and the full-screen /chat view
 * (app/(app)/chat/ChatView.tsx).
 *
 * Mounted once in app/(app)/layout.tsx alongside PageContextRoot, so it lives in
 * the persistent layout subtree and survives route navigation (the layout does
 * not remount between sibling routes). This is what satisfies the slice #10 AC
 * "drawer and /chat view the same active thread": selecting a thread in /chat
 * sets activeThreadId; the next time the drawer opens it resumes that thread
 * instead of defaulting to the most-recent one (and vice-versa).
 *
 * In-memory only — no localStorage. The two surfaces are rarely on screen at the
 * same time (/chat is a full route), so shared in-memory state across navigation
 * is sufficient; localStorage persistence across full reloads is optional polish.
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
