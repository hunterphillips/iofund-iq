/**
 * Chat model allowlist — shared by the composer's model selector (client) and
 * /api/chat (server). The server never trusts the client string: anything not
 * in this list resolves to the default.
 */
export const CHAT_MODELS = [
  { id: "anthropic/claude-sonnet-4-6", label: "Sonnet" },
  { id: "anthropic/claude-opus-4-8", label: "Opus" },
] as const;

export type ChatModelId = (typeof CHAT_MODELS)[number]["id"];

export const DEFAULT_CHAT_MODEL: ChatModelId = "anthropic/claude-sonnet-4-6";

export function resolveChatModel(candidate: unknown): ChatModelId {
  return CHAT_MODELS.some((m) => m.id === candidate)
    ? (candidate as ChatModelId)
    : DEFAULT_CHAT_MODEL;
}
