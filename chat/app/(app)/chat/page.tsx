import { ChatView } from "./ChatView";

// Full-screen conversation manager (slice #10): thread sidebar + reader.
// Thin server shell; all interaction lives in the <ChatView /> client component
// (thread list, active-thread selection, rename/delete, the ChatThread reader).
export const dynamic = "force-dynamic";

export default function ChatPage() {
  return <ChatView />;
}
