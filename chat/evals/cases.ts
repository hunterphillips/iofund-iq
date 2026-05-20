/**
 * Eval cases for the IOFund Companion chat agent.
 *
 * Each case is a single user question + a set of mechanical assertions about
 * the resulting tool-call trace and final text. Assertions are deliberately
 * coarse: we test "did the right tool get called with a reasonable arg" and
 * "does the response cite the right URL," not "is the prose beautiful."
 *
 * LLM-as-judge for stance/nuance is a separate layer that lives behind these.
 */

export type ToolCall = {
  toolName: string;
  args: Record<string, unknown>;
  result?: string;
};

export type Trace = {
  text: string;
  toolCalls: ToolCall[];
  steps: number;
};

export type Assertion = {
  label: string;
  check: (t: Trace) => boolean;
};

// --- assertion helpers ---

export function toolCalled(name: string): Assertion {
  return {
    label: `tool '${name}' was called`,
    check: (t) => t.toolCalls.some((c) => c.toolName === name),
  };
}

export function toolCalledWith(name: string, argRegex: RegExp): Assertion {
  return {
    label: `tool '${name}' called with arg matching ${argRegex}`,
    check: (t) =>
      t.toolCalls
        .filter((c) => c.toolName === name)
        .some((c) =>
          Object.values(c.args).some(
            (v) => typeof v === "string" && argRegex.test(v),
          ),
        ),
  };
}

export function toolResultIncludes(name: string, regex: RegExp): Assertion {
  return {
    label: `tool '${name}' returned a result matching ${regex}`,
    check: (t) =>
      t.toolCalls
        .filter((c) => c.toolName === name)
        .some((c) => c.result !== undefined && regex.test(c.result)),
  };
}

export function responseIncludes(regex: RegExp): Assertion {
  return {
    label: `response includes /${regex.source}/${regex.flags}`,
    check: (t) => regex.test(t.text),
  };
}

export function responseExcludes(regex: RegExp): Assertion {
  return {
    label: `response does NOT include /${regex.source}/${regex.flags}`,
    check: (t) => !regex.test(t.text),
  };
}

// --- cases ---

export type EvalCase = {
  id: string;
  question: string;
  assertions: Assertion[];
};

/** Reusable: any markdown link pointing at io-fund.com. Useful for cases
 * where we want citation discipline without pinning a specific URL. */
export const IOFUND_MARKDOWN_LINK = /\[[^\]]+\]\(https:\/\/io-fund\.com\/[^)]+\)/;

export const CASES: EvalCase[] = [
  {
    id: "market_outlook_surfaces_cycle_article",
    question:
      "what is the fund's overall market outlook for 2026? and are the main risks to watch for?",
    assertions: [
      toolCalled("search_articles"),
      toolCalledWith(
        "search_articles",
        /outlook|market|macro|cycle|volatility|risk/i,
      ),
      toolResultIncludes(
        "search_articles",
        /2026-stock-market-outlook-cycle-convergence/i,
      ),
      toolCalledWith(
        "read_article",
        /2026-stock-market-outlook-cycle-convergence/i,
      ),
    ],
  },
  {
    id: "maxlinear_optical_demand_surfaces_article",
    question:
      "why is IOF paying attention to MXL here? is there an actual AI data center angle or just another chip trade?",
    assertions: [
      toolCalled("search_articles"),
      toolCalledWith(
        "search_articles",
        /maxlinear|optical|data center|demand|margin|MXL/i,
      ),
      toolResultIncludes(
        "search_articles",
        /maxlinear-optical-data-center-demand-accelerating-margins-to-improve-in-q2/i,
      ),
      toolCalledWith(
        "read_article",
        /maxlinear-optical-data-center-demand-accelerating-margins-to-improve-in-q2/i,
      ),
    ],
  },
  {
    id: "bitcoin_liquidity_downside_surfaces_article",
    question:
      "does IOF still think bitcoin can hold up this year, or are they worried the setup has turned bearish?",
    assertions: [
      toolCalled("search_articles"),
      toolCalledWith(
        "search_articles",
        /bitcoin|BTC|dollar|liquidity|volume|downside|risk/i,
      ),
      toolResultIncludes(
        "search_articles",
        /bitcoin-price-prediction-2026-dollar-liquidity-volume-downside/i,
      ),
      toolCalledWith(
        "read_article",
        /bitcoin-price-prediction-2026-dollar-liquidity-volume-downside/i,
      ),
    ],
  },
];
