import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { decrypt, encrypt } from "@/db/encryption";

export interface DecryptedIofCredentials {
  email: string;
  password: string;
  lastVerifiedAt: Date | null;
}

export async function hasIofCredentials(userId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: tables.iofCredentials.userId })
    .from(tables.iofCredentials)
    .where(eq(tables.iofCredentials.userId, userId))
    .limit(1);
  return rows.length > 0;
}

export async function getIofCredentials(
  userId: string,
): Promise<DecryptedIofCredentials | null> {
  const [row] = await db
    .select()
    .from(tables.iofCredentials)
    .where(eq(tables.iofCredentials.userId, userId))
    .limit(1);
  if (!row) return null;
  return {
    email: decrypt(row.encryptedEmail),
    password: decrypt(row.encryptedPassword),
    lastVerifiedAt: row.lastVerifiedAt,
  };
}

export async function upsertIofCredentials(
  userId: string,
  email: string,
  password: string,
): Promise<void> {
  const now = new Date();
  const encryptedEmail = encrypt(email);
  const encryptedPassword = encrypt(password);
  await db
    .insert(tables.iofCredentials)
    .values({
      userId,
      encryptedEmail,
      encryptedPassword,
      lastVerifiedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: tables.iofCredentials.userId,
      set: {
        encryptedEmail,
        encryptedPassword,
        lastVerifiedAt: now,
        updatedAt: now,
      },
    });
}
