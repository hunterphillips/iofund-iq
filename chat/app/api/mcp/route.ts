import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import packageJson from "@/package.json";
import { authenticateKey } from "@/lib/mcp/auth";
import { MCP_TOOLS, runTool } from "@/lib/mcp/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const mcpHandler = createMcpHandler(
  (server) => {
    for (const def of MCP_TOOLS) {
      server.registerTool(
        def.name,
        {
          description: def.description,
          inputSchema: z.object(def.schema),
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
          },
        },
        async (args, context) => {
          const userId = context.http?.authInfo?.extra?.userId;
          if (typeof userId !== "string") {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: "unauthorized",
                    message: "A valid API key is required.",
                  }),
                },
              ],
              isError: true,
            };
          }

          const result = await runTool(def, userId, args);
          return {
            content: [
              {
                type: "text" as const,
                text:
                  typeof result === "string"
                    ? result
                    : JSON.stringify(result, null, 2),
              },
            ],
          };
        },
      );
    }
  },
  {
    serverInfo: {
      name: "iofund-iq",
      version: packageJson.version,
    },
  },
);

const authenticatedHandler = withMcpAuth(
  mcpHandler,
  async (request) => {
    const authenticated = await authenticateKey(
      request.headers.get("authorization"),
    );
    if (!authenticated) return undefined;

    return {
      token: "iofund-iq-api-key",
      clientId: authenticated.keyId,
      scopes: [],
      extra: { userId: authenticated.userId },
    };
  },
  { required: true },
);

export { authenticatedHandler as GET, authenticatedHandler as POST };
