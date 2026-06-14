/**
 * Lets any page open the assistant drawer without threading drawer state down
 * through the tree. The drawer owner (components/app-chrome.tsx) listens for
 * this window event; deep CTAs (e.g. "Ask about this article") dispatch it.
 */

export const OPEN_ASSISTANT_EVENT = "iof:open-assistant";

export function openAssistant(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT));
  }
}
