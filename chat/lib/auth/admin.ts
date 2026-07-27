import { eq } from "drizzle-orm";
import { db, tables } from "@/db";

/**
 * Admin gate — data-driven via the admin_users table (rows managed by SQL,
 * no env var or redeploy). Empty table means no admins (fail closed). Admin
 * only unlocks operator actions (manual cron triggers), not data access —
 * every data path is already per-user.
 */
export async function isAdminUser(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const [row] = await db
    .select({ userId: tables.adminUsers.userId })
    .from(tables.adminUsers)
    .where(eq(tables.adminUsers.userId, userId))
    .limit(1);
  return Boolean(row);
}
