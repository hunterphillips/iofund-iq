import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

export interface AuthenticatedApiKey {
  userId: string;
  keyId: string;
}

/** Return the SHA-256 hex digest stored for an API key secret. */
export function hashKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** Parse the exact bearer-key format accepted by the MCP endpoint. */
export function parseBearerKey(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer (iofiq_[A-Za-z0-9_-]+)$/.exec(header);
  return match?.[1] ?? null;
}

/** Resolve a live API key without ever logging the secret or its hash. */
export async function authenticateKey(
  header: string | null,
): Promise<AuthenticatedApiKey | null> {
  const secret = parseBearerKey(header);
  if (!secret) return null;

  try {
    const { db, tables } = await import("@/db");
    const [row] = await db
      .select({ id: tables.apiKeys.id, userId: tables.apiKeys.userId })
      .from(tables.apiKeys)
      .where(
        and(
          eq(tables.apiKeys.keyHash, hashKey(secret)),
          isNull(tables.apiKeys.revokedAt),
        ),
      )
      .limit(1);

    if (!row) return null;

    void Promise.resolve(
      db
        .update(tables.apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(tables.apiKeys.id, row.id)),
    ).catch(() => {});

    return { userId: row.userId, keyId: row.id };
  } catch {
    return null;
  }
}

/** Check the paid-content entitlement without reading or decrypting credentials. */
export async function requireIofEntitlement(userId: string): Promise<boolean> {
  const { hasIofCredentials } = await import("@/lib/iof/credentials");
  return hasIofCredentials(userId);
}
