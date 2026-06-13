import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import type { Holding } from "./extract";

export interface SavedHoldings {
  holdings: Holding[];
  source: string;
  uploadedAt: Date;
}

export async function hasUserHoldings(userId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: tables.userHoldings.userId })
    .from(tables.userHoldings)
    .where(eq(tables.userHoldings.userId, userId))
    .limit(1);
  return rows.length > 0;
}

export async function getUserHoldings(
  userId: string,
): Promise<SavedHoldings | null> {
  const [row] = await db
    .select()
    .from(tables.userHoldings)
    .where(eq(tables.userHoldings.userId, userId))
    .limit(1);
  if (!row) return null;
  return {
    holdings: row.holdings as Holding[],
    source: row.source,
    uploadedAt: row.uploadedAt,
  };
}

export async function upsertUserHoldings(
  userId: string,
  holdings: Holding[],
  source: string,
): Promise<Date> {
  const now = new Date();
  await db
    .insert(tables.userHoldings)
    .values({
      userId,
      holdings,
      source,
      uploadedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: tables.userHoldings.userId,
      set: {
        holdings,
        source,
        uploadedAt: now,
        updatedAt: now,
      },
    });
  return now;
}

export async function deleteUserHoldings(userId: string): Promise<void> {
  await db
    .delete(tables.userHoldings)
    .where(eq(tables.userHoldings.userId, userId));
}
