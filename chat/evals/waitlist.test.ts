/**
 * Pure unit tests for the waitlist signup validation. No DB, no network.
 *
 * Run:  pnpm test:waitlist
 * Or:   pnpm exec tsx evals/waitlist.test.ts
 *
 * Pins the zod schema shared by the public POST /api/waitlist route: email
 * normalization, the closed member-status set, and interest trimming/capping.
 */

import {
  waitlistSignupSchema,
  INTEREST_MAX,
} from "@/lib/waitlist/schema";

let failures = 0;
function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures++;
  }
}

console.log("\nwaitlist validation unit tests");
console.log("─".repeat(50));

// ── valid payloads ──────────────────────────────────────────────────────────
console.log("\n[a] valid payloads");
{
  const r = waitlistSignupSchema.safeParse({
    email: "  Investor@Example.COM ",
    memberStatus: "member",
    interest: "  catch every move  ",
  });
  assert(r.success, "well-formed payload parses");
  assert(r.success && r.data.email === "investor@example.com", "email trimmed + lowercased");
  assert(r.success && r.data.interest === "catch every move", "interest trimmed");

  // All three member statuses accepted.
  for (const s of ["member", "prospect", "considering"] as const) {
    assert(
      waitlistSignupSchema.safeParse({ email: "a@b.co", memberStatus: s }).success,
      `memberStatus ${s} accepted`,
    );
  }
}

// ── interest is optional + normalizes empty → undefined ─────────────────────
console.log("\n[b] optional interest");
{
  const noInterest = waitlistSignupSchema.safeParse({
    email: "a@b.co",
    memberStatus: "prospect",
  });
  assert(noInterest.success && noInterest.data.interest === undefined, "omitted interest → undefined");

  const blank = waitlistSignupSchema.safeParse({
    email: "a@b.co",
    memberStatus: "prospect",
    interest: "   ",
  });
  assert(blank.success && blank.data.interest === undefined, "whitespace-only interest → undefined (stores NULL)");
}

// ── rejections ──────────────────────────────────────────────────────────────
console.log("\n[c] rejections");
{
  assert(
    !waitlistSignupSchema.safeParse({ email: "not-an-email", memberStatus: "member" }).success,
    "bad email rejected",
  );
  assert(
    !waitlistSignupSchema.safeParse({ email: "a@b.co", memberStatus: "vip" }).success,
    "unknown member status rejected",
  );
  assert(
    !waitlistSignupSchema.safeParse({ memberStatus: "member" }).success,
    "missing email rejected",
  );
  assert(
    !waitlistSignupSchema.safeParse({ email: "a@b.co" }).success,
    "missing member status rejected",
  );
  const tooLong = waitlistSignupSchema.safeParse({
    email: "a@b.co",
    memberStatus: "member",
    interest: "x".repeat(INTEREST_MAX + 1),
  });
  assert(!tooLong.success, `interest over ${INTEREST_MAX} chars rejected`);
  // Exactly at the cap is fine.
  assert(
    waitlistSignupSchema.safeParse({
      email: "a@b.co",
      memberStatus: "member",
      interest: "x".repeat(INTEREST_MAX),
    }).success,
    `interest at exactly ${INTEREST_MAX} chars accepted`,
  );
}

console.log("\n" + "─".repeat(50));
if (failures === 0) {
  console.log("All waitlist tests passed.\n");
} else {
  console.error(`${failures} waitlist test(s) failed.\n`);
  process.exit(1);
}
