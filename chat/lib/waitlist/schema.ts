import { z } from "zod";

/**
 * Waitlist signup validation — shared by the API route and the unit test, so
 * the rules live in one place and stay verifiable without a DB. Pure: no
 * imports beyond zod.
 *
 * `memberStatus` is the load-bearing field. Its distribution across signups is
 * the evidence we put in front of the fund, so we constrain it to a closed set
 * rather than accept free text.
 */
export const MEMBER_STATUSES = ["member", "prospect", "considering"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const INTEREST_MAX = 500;

export const waitlistSignupSchema = z.object({
  // Lowercased + trimmed so dedupe-by-email is case-insensitive at the row level.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(254, "That email is too long."),
  memberStatus: z.enum(MEMBER_STATUSES, {
    message: "Select whether you're an I/O Fund member.",
  }),
  // Optional free-text. Empty string normalizes to undefined so we store NULL,
  // not "". Capped to keep the column tidy and block abuse.
  interest: z
    .string()
    .trim()
    .max(INTEREST_MAX, `Keep it under ${INTEREST_MAX} characters.`)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export type WaitlistSignup = z.infer<typeof waitlistSignupSchema>;
