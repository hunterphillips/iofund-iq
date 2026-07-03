/**
 * Thin client for Robinhood's hosted Agentic Trading MCP server.
 *
 * READ-ONLY BY CONSTRUCTION: every call goes through the allowlist below.
 * Robinhood's OAuth has a single coarse scope (no read-only grant exists), so
 * this allowlist is the app's write boundary — order placement and watchlist
 * mutations are not reachable through this module. Do not widen it with
 * mutating tools.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ROBINHOOD_MCP_URL } from "./oauth";

export const READ_TOOLS = new Set([
  "get_accounts",
  "get_portfolio",
  "get_equity_positions",
  "get_realized_pnl",
  "get_equity_quotes",
]);

/** Thrown when the MCP rejects our bearer token — caller should refresh. */
export class RobinhoodAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RobinhoodAuthError";
  }
}

export function assertReadTool(name: string): void {
  if (!READ_TOOLS.has(name)) {
    throw new Error(
      `Robinhood MCP tool "${name}" is not in the read-only allowlist`,
    );
  }
}

/**
 * Call one allowlisted read tool and return the parsed `data` payload.
 * Opens a fresh MCP session per call — the calls are rare (lazy 30-min
 * snapshot refresh, per-question P&L), so session reuse isn't worth state.
 */
export async function callRobinhoodTool(
  accessToken: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  assertReadTool(name);

  const transport = new StreamableHTTPClientTransport(
    new URL(ROBINHOOD_MCP_URL),
    {
      requestInit: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    },
  );
  const client = new Client({ name: "iofund-iq", version: "1.0.0" });

  try {
    await client.connect(transport);
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) {
      const text = extractText(result.content);
      throw new Error(`Robinhood tool ${name} errored: ${text.slice(0, 300)}`);
    }
    return parsePayload(extractText(result.content));
  } catch (err) {
    if (err instanceof Error && /\b401\b|unauthorized/i.test(err.message)) {
      throw new RobinhoodAuthError(err.message);
    }
    throw err;
  } finally {
    await client.close().catch(() => {});
  }
}

function extractText(content: unknown): string {
  if (Array.isArray(content)) {
    const texts = content
      .filter(
        (c): c is { type: "text"; text: string } =>
          typeof c === "object" && c !== null && (c as { type?: string }).type === "text",
      )
      .map((c) => c.text);
    if (texts.length) return texts.join("\n");
  }
  return "";
}

/** Robinhood wraps results as { data, guide } — the guide is prompt text for
 * a chat model, useless here; unwrap to data. */
function parsePayload(text: string): unknown {
  try {
    const parsed = JSON.parse(text) as { data?: unknown };
    return parsed.data !== undefined ? parsed.data : parsed;
  } catch {
    return text;
  }
}
