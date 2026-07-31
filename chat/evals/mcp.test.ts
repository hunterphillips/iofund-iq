/** Pure MCP registry surface, schema, and gate tests. No DB, no network. */

import { z } from "zod";
import {
  MCP_TOOLS,
  runTool,
  type McpToolDef,
  type RunToolDependencies,
} from "@/lib/mcp/registry";

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures += 1;
  }
}

function errorCode(result: unknown): string | undefined {
  if (!result || typeof result !== "object" || !("error" in result)) {
    return undefined;
  }
  return String((result as { error: unknown }).error);
}

const denyAll: RunToolDependencies = {
  hasIofEntitlement: async () => false,
  hasBrokerConnection: async () => false,
};

const allowAll: RunToolDependencies = {
  hasIofEntitlement: async () => true,
  hasBrokerConnection: async () => true,
};

function findTool(name: string): McpToolDef {
  const def = MCP_TOOLS.find((tool) => tool.name === name);
  if (!def) throw new Error(`Missing test tool: ${name}`);
  return def;
}

async function main(): Promise<void> {
  console.log("\nmcp registry unit tests");
  console.log("─".repeat(50));

  const expected = [
    "analyze_portfolio_gap",
    "get_digest",
    "get_fund_book",
    "get_my_holdings",
    "get_position",
    "get_quotes",
    "list_digests",
    "query_trades",
    "read_article",
    "read_doc",
    "search_articles",
  ];
  const actual = MCP_TOOLS.map((tool) => tool.name).sort();
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    "registry exposes exactly the 11 approved read-only tools",
  );
  assert(
    MCP_TOOLS.every((tool) => tool.description.trim().length > 0),
    "every tool has a description",
  );
  assert(
    MCP_TOOLS.every((tool) => ["iof", "broker", "none"].includes(tool.gate)),
    "every tool has a valid declarative gate",
  );

  for (const def of MCP_TOOLS.filter((tool) => tool.gate === "iof")) {
    let invoked = false;
    const stub: McpToolDef = {
      ...def,
      execute: async () => {
        invoked = true;
        return { ok: true };
      },
    };
    const result = await runTool(stub, "test-user", {}, denyAll);
    assert(
      errorCode(result) === "not_entitled" && !invoked,
      `${def.name} is blocked before execute without fund credentials`,
    );
  }

  {
    let invoked = false;
    const def: McpToolDef = {
      ...findTool("get_my_holdings"),
      execute: async () => {
        invoked = true;
        return { ok: true };
      },
    };
    const result = await runTool(def, "test-user", {}, denyAll);
    assert(
      errorCode(result) === "broker_not_connected" && !invoked,
      "get_my_holdings is blocked before execute without a broker connection",
    );
  }

  {
    let invoked = false;
    const def: McpToolDef = {
      ...findTool("get_quotes"),
      execute: async () => {
        invoked = true;
        return { ok: true };
      },
    };
    const result = await runTool(def, "test-user", {}, denyAll);
    assert(invoked && errorCode(result) === undefined, "get_quotes needs only a valid key");
  }

  const smokeCases: Array<[string, unknown]> = [
    ["get_position", { ticker: "NVDA" }],
    ["search_articles", { query: "optical", limit: 5 }],
    ["analyze_portfolio_gap", { holdings: [{ ticker: "NVDA", shares: 2 }] }],
    ["get_quotes", { tickers: ["NVDA", "BTCUSD"] }],
  ];

  for (const [name, args] of smokeCases) {
    const original = findTool(name);
    const parsed = z.object(original.schema).safeParse(args);
    assert(parsed.success, `${name} accepts its representative input shape`);
    if (!parsed.success) continue;

    let invoked = false;
    const stub: McpToolDef = {
      ...original,
      execute: async (_userId, received) => {
        invoked = received === parsed.data;
        return { ok: true };
      },
    };
    await runTool(stub, "test-user", parsed.data, allowAll);
    assert(invoked, `${name} representative input reaches execute`);
  }

  assert(
    !z.object(findTool("get_quotes").schema).safeParse({ tickers: [] }).success,
    "get_quotes rejects an empty ticker list",
  );

  console.log("\n" + "─".repeat(50));
  if (failures === 0) {
    console.log("All mcp registry assertions passed.\n");
  } else {
    console.error(`${failures} mcp registry assertion(s) failed.\n`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`MCP registry test crashed: ${message}`);
  process.exit(2);
});
