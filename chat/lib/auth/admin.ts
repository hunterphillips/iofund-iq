/**
 * Admin gate — mirrors the allowlist pattern in allowlist.ts. ADMIN_EMAILS is
 * comma-separated; unset means NO admins (fail closed). Admin only unlocks
 * operator actions (manual cron triggers), not data access — every data path
 * is already per-user.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return false;
  const normalized = email.trim().toLowerCase();
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}
