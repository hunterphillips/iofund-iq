/**
 * Eval runner — executes each case against the production chat code path
 * (same SYSTEM_PROMPT, same chatTools, same model, same stop condition),
 * then evaluates assertions against the collected trace.
 *
 * Usage:
 *     cd chat
 *     pnpm eval
 *     pnpm eval --id market_outlook_surfaces_cycle_article   # filter
 *
 * Required env (read from chat/.env.local):
 *     AI_GATEWAY_API_KEY  — LLM calls
 *     DATABASE_URL        — for the tools that hit Postgres
 */
import { generateText, stepCountIs } from "ai";
import { SYSTEM_PROMPT } from "@/lib/chat/system-prompt";
import { chatTools } from "@/lib/chat/tools";
import { CASES, type EvalCase, type ToolCall, type Trace } from "./cases";

const MODEL = "anthropic/claude-sonnet-4-6";

type CaseResult = {
  id: string;
  question: string;
  trace: Trace;
  results: { label: string; passed: boolean }[];
  passed: boolean;
  durationMs: number;
};

async function runCase(c: EvalCase): Promise<CaseResult> {
  const t0 = Date.now();
  const result = await generateText({
    model: MODEL,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: c.question }],
    tools: chatTools,
    stopWhen: stepCountIs(5),
  });

  const toolCalls: ToolCall[] = [];
  for (const step of result.steps) {
    for (const call of step.toolCalls) {
      const matchingResult = step.toolResults?.find(
        (r: { toolCallId: string; output: unknown }) =>
          r.toolCallId === call.toolCallId,
      );
      toolCalls.push({
        toolName: call.toolName,
        args: call.input as Record<string, unknown>,
        result:
          matchingResult && typeof matchingResult.output === "string"
            ? matchingResult.output
            : matchingResult
              ? JSON.stringify(matchingResult.output)
              : undefined,
      });
    }
  }

  const trace: Trace = {
    text: result.text,
    toolCalls,
    steps: result.steps.length,
  };

  const results = c.assertions.map((a) => ({
    label: a.label,
    passed: a.check(trace),
  }));

  return {
    id: c.id,
    question: c.question,
    trace,
    results,
    passed: results.every((r) => r.passed),
    durationMs: Date.now() - t0,
  };
}

function summarize(results: CaseResult[]): void {
  console.log("");
  console.log("─".repeat(70));
  console.log("SUMMARY");
  console.log("─".repeat(70));
  let passedCount = 0;
  for (const r of results) {
    const mark = r.passed ? "✓" : "✗";
    console.log(`${mark} ${r.id}  (${r.durationMs}ms · ${r.trace.steps} steps)`);
    if (r.passed) {
      passedCount++;
      continue;
    }
    for (const a of r.results) {
      if (!a.passed) console.log(`    ✗ ${a.label}`);
    }
  }
  console.log("─".repeat(70));
  console.log(`${passedCount} / ${results.length} cases passed`);
  console.log("─".repeat(70));
}

function printTrace(r: CaseResult): void {
  console.log("");
  console.log(`━ ${r.id} ━`.padEnd(70, "━"));
  console.log(`Q: ${r.question}`);
  console.log("");
  console.log("Tool calls:");
  if (r.trace.toolCalls.length === 0) {
    console.log("  (none)");
  } else {
    for (const c of r.trace.toolCalls) {
      console.log(`  • ${c.toolName}(${JSON.stringify(c.args)})`);
      if (c.result) {
        const preview = c.result
          .replace(/\s+/g, " ")
          .slice(0, 200);
        console.log(
          `      → ${preview}${c.result.length > 200 ? " …" : ""}`,
        );
      }
    }
  }
  console.log("");
  console.log("Response:");
  console.log(
    r.trace.text
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n"),
  );
  console.log("");
  console.log("Assertions:");
  for (const a of r.results) {
    console.log(`  ${a.passed ? "✓" : "✗"} ${a.label}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const idIdx = args.indexOf("--id");
  const filterId = idIdx >= 0 ? args[idIdx + 1] : undefined;

  const selected = filterId ? CASES.filter((c) => c.id === filterId) : CASES;
  if (selected.length === 0) {
    console.error(`No cases match --id=${filterId}`);
    process.exit(2);
  }

  console.log(
    `Running ${selected.length} eval case(s) · model=${MODEL} · stepCountIs=5`,
  );
  const results: CaseResult[] = [];
  for (const c of selected) {
    console.log(`▶ ${c.id} …`);
    const r = await runCase(c);
    results.push(r);
    printTrace(r);
  }
  summarize(results);

  const anyFailed = results.some((r) => !r.passed);
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error("Eval harness crashed:", err);
  process.exit(2);
});
