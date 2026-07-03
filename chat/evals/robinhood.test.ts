/**
 * Pure unit tests for the Robinhood integration: MCP payload parsing, default-
 * account selection, the read-only tool allowlist, and the OAuth token
 * request paths (mocked fetch). No DB, no live network.
 *
 * Run:  pnpm test:robinhood
 * Or:   pnpm exec tsx evals/robinhood.test.ts
 *
 * Fixtures mirror the real get_equity_positions / get_accounts shapes
 * captured from agent.robinhood.com on 2026-07-02 (values altered).
 */

import {
  mergeHoldings,
  parseEquityPositions,
  pickDefaultAccount,
  type RawAccount,
} from "@/lib/robinhood/parse";
import { assertReadTool, READ_TOOLS } from "@/lib/robinhood/mcp-client";
import { exchangeCode, refreshAccessToken } from "@/lib/robinhood/oauth";

let failures = 0;
function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures++;
  }
}

console.log("\nrobinhood unit tests");
console.log("─".repeat(50));

// ── (a) positions payload → holdings ───────────────────────────────────────
console.log("\n[a] parseEquityPositions");
{
  const payload = {
    positions: [
      // Real field shape: string quantities, extra hold-breakdown fields.
      {
        symbol: "VOO",
        quantity: "49.206353",
        average_buy_price: "364.590000",
        shares_available_for_sells: "49.206353",
        type: "long",
      },
      { symbol: "nvda", quantity: "39.807474", type: "long" },
      // Filtered: shorts, zero, garbage, missing symbol.
      { symbol: "GME", quantity: "2.000000", type: "short" },
      { symbol: "ZERO", quantity: "0.000000", type: "long" },
      { symbol: "BAD", quantity: "not-a-number", type: "long" },
      { quantity: "5.000000", type: "long" },
    ],
    next: "https://api.robinhood.com/positions/?cursor=abc123",
  };
  const r = parseEquityPositions(payload);
  assert(r.holdings.length === 2, "long positions with valid quantities kept");
  assert(
    r.holdings.find((h) => h.ticker === "NVDA")?.shares === 39.807474,
    "quantity string coerced to number, symbol uppercased",
  );
  assert(r.nextCursor === "abc123", "cursor extracted from next URL");

  const last = parseEquityPositions({ positions: [], next: null });
  assert(last.nextCursor === null, "null next → no cursor");
  assert(
    parseEquityPositions({ positions: [], next: "rawcursor" }).nextCursor ===
      "rawcursor",
    "bare (non-URL) next passes through as cursor",
  );

  // Position with no `type` field still counts (defensive default).
  const untyped = parseEquityPositions({
    positions: [{ symbol: "MSFT", quantity: "1.5" }],
  });
  assert(untyped.holdings[0]?.ticker === "MSFT", "missing type treated as long");
}

// ── (b) page merge ──────────────────────────────────────────────────────────
console.log("\n[b] mergeHoldings");
{
  const merged = mergeHoldings([
    [
      { ticker: "VOO", shares: 10 },
      { ticker: "NVDA", shares: 5 },
    ],
    [{ ticker: "NVDA", shares: 2 }],
  ]);
  assert(merged.length === 2, "pages merge without duplicates");
  assert(
    merged.find((h) => h.ticker === "NVDA")?.shares === 7,
    "colliding tickers sum shares across pages",
  );
}

// ── (c) default account selection ───────────────────────────────────────────
console.log("\n[c] pickDefaultAccount");
{
  const accounts: RawAccount[] = [
    {
      account_number: "AGENTIC1",
      rhs_account_number: "AGENTIC1",
      brokerage_account_type: "individual",
      nickname: "Agentic",
      is_default: false,
      state: "active",
      deactivated: false,
    },
    {
      account_number: "MAIN1",
      rhs_account_number: "RHS-MAIN1",
      brokerage_account_type: "individual",
      is_default: true,
      state: "active",
      deactivated: false,
    },
    {
      account_number: "IRA1",
      brokerage_account_type: "ira_traditional",
      is_default: false,
      state: "active",
      deactivated: false,
    },
  ];
  const picked = pickDefaultAccount(accounts);
  assert(picked?.accountNumber === "MAIN1", "default account wins");
  assert(picked?.rhsAccountNumber === "RHS-MAIN1", "rhs number carried along");

  const noDefault = pickDefaultAccount(
    accounts.map((a) => ({ ...a, is_default: false })),
  );
  assert(
    noDefault?.accountNumber === "AGENTIC1",
    "no default → first active individual",
  );

  assert(
    pickDefaultAccount([
      { account_number: "DEAD", state: "active", deactivated: true },
      { account_number: "CLOSED", state: "closed", deactivated: false },
    ]) === null,
    "deactivated/closed accounts never picked",
  );
  assert(pickDefaultAccount([]) === null, "empty account list → null");
}

// ── (d) read-only allowlist ─────────────────────────────────────────────────
console.log("\n[d] read-only allowlist");
{
  const throws = (name: string) => {
    try {
      assertReadTool(name);
      return false;
    } catch {
      return true;
    }
  };
  assert(!throws("get_equity_positions"), "read tool passes");
  assert(!throws("get_realized_pnl"), "realized-pnl passes");
  assert(throws("place_equity_order"), "order placement blocked");
  assert(throws("cancel_equity_order"), "order cancel blocked");
  assert(throws("add_to_watchlist"), "watchlist mutation blocked");
  assert(throws("review_equity_order"), "order review (write path) blocked");
  const hasWriteTool = [...READ_TOOLS].some(
    (t) => /place|cancel|add|update|remove|create/.test(t),
  );
  assert(!hasWriteTool, "allowlist contains no mutating tool names");
}

// ── (e) token endpoint paths (mocked fetch) ─────────────────────────────────
// Wrapped in a function: tsx transpiles this file as CJS, so no top-level await.
async function tokenTests() {
  console.log("\n[e] oauth token requests");
  process.env.ROBINHOOD_CLIENT_ID = "test-client";
  const realFetch = globalThis.fetch;
  let captured: { url: string; body: string } | null = null;

  const mock = (status: number, json: unknown) => {
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(url), body: String(init?.body) };
      return new Response(JSON.stringify(json), { status });
    }) as typeof fetch;
  };

  try {
    mock(200, {
      access_token: "at-1",
      refresh_token: "rt-1",
      expires_in: 344000,
    });
    const tokens = await exchangeCode({
      code: "c",
      verifier: "v",
      redirectUri: "http://localhost:3000/api/robinhood/callback",
    });
    assert(tokens.access_token === "at-1", "code exchange returns tokens");
    const body = new URLSearchParams(captured!.body);
    assert(
      body.get("grant_type") === "authorization_code" &&
        body.get("code_verifier") === "v" &&
        body.get("client_id") === "test-client",
      "exchange sends PKCE form fields",
    );

    mock(200, { access_token: "at-2", refresh_token: "rt-2" });
    const refreshed = await refreshAccessToken("rt-1");
    assert(
      refreshed.expires_in === 3600,
      "missing expires_in falls back to 3600",
    );
    assert(
      new URLSearchParams(captured!.body).get("grant_type") === "refresh_token",
      "refresh sends refresh_token grant",
    );

    mock(400, { error: "invalid_grant" });
    let threw = false;
    try {
      await refreshAccessToken("dead");
    } catch {
      threw = true;
    }
    assert(threw, "non-2xx token response throws");

    mock(200, { access_token: "at-only" });
    threw = false;
    try {
      await refreshAccessToken("rt");
    } catch {
      threw = true;
    }
    assert(threw, "response missing refresh_token throws");
  } finally {
    globalThis.fetch = realFetch;
  }
}

void tokenTests().then(() => {
  console.log("\n" + "─".repeat(50));
  if (failures === 0) {
    console.log("All assertions passed.");
  } else {
    console.error(`${failures} assertion(s) FAILED.`);
  }
  process.exit(failures > 0 ? 1 : 0);
});
