/**
 * Per-user Robinhood connection: encrypted OAuth tokens in
 * robinhood_connections (mirrors lib/iof/credentials.ts, but tokens not
 * passwords, and under the rotatable ROBINHOOD_TOKEN_ENCRYPTION_KEY).
 */

import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { cipherFor } from "@/db/encryption";
import { refreshAccessToken, type TokenResponse } from "./oauth";

const cipher = cipherFor("ROBINHOOD_TOKEN_ENCRYPTION_KEY");

/** Refresh this long before expiry so in-flight calls don't race the cliff. */
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

export interface RobinhoodConnectionInfo {
  accountNumber: string;
  rhsAccountNumber: string | null;
  status: string;
  connectedAt: Date;
}

export async function getRobinhoodConnection(
  userId: string,
): Promise<RobinhoodConnectionInfo | null> {
  const [row] = await db
    .select({
      accountNumber: tables.robinhoodConnections.accountNumber,
      rhsAccountNumber: tables.robinhoodConnections.rhsAccountNumber,
      status: tables.robinhoodConnections.status,
      connectedAt: tables.robinhoodConnections.connectedAt,
    })
    .from(tables.robinhoodConnections)
    .where(eq(tables.robinhoodConnections.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function hasRobinhoodConnection(userId: string): Promise<boolean> {
  return (await getRobinhoodConnection(userId)) !== null;
}

export async function saveRobinhoodConnection(
  userId: string,
  tokens: TokenResponse,
  account: { accountNumber: string; rhsAccountNumber: string | null },
): Promise<void> {
  const now = new Date();
  const values = {
    encryptedAccessToken: cipher.encrypt(tokens.access_token),
    encryptedRefreshToken: cipher.encrypt(tokens.refresh_token),
    accountNumber: account.accountNumber,
    rhsAccountNumber: account.rhsAccountNumber,
    accessTokenExpiresAt: new Date(now.getTime() + tokens.expires_in * 1000),
    status: "active" as const,
    updatedAt: now,
  };
  await db
    .insert(tables.robinhoodConnections)
    .values({ userId, connectedAt: now, ...values })
    .onConflictDoUpdate({
      target: tables.robinhoodConnections.userId,
      set: { connectedAt: now, ...values },
    });
}

export async function deleteRobinhoodConnection(userId: string): Promise<void> {
  await db
    .delete(tables.robinhoodConnections)
    .where(eq(tables.robinhoodConnections.userId, userId));
  await db
    .delete(tables.brokerHoldings)
    .where(eq(tables.brokerHoldings.userId, userId));
}

async function markExpired(userId: string): Promise<void> {
  await db
    .update(tables.robinhoodConnections)
    .set({ status: "expired", updatedAt: new Date() })
    .where(eq(tables.robinhoodConnections.userId, userId));
}

async function persistRefreshedTokens(
  userId: string,
  tokens: TokenResponse,
): Promise<void> {
  const now = new Date();
  await db
    .update(tables.robinhoodConnections)
    .set({
      encryptedAccessToken: cipher.encrypt(tokens.access_token),
      encryptedRefreshToken: cipher.encrypt(tokens.refresh_token),
      accessTokenExpiresAt: new Date(now.getTime() + tokens.expires_in * 1000),
      status: "active",
      updatedAt: now,
    })
    .where(eq(tables.robinhoodConnections.userId, userId));
}

/**
 * Decrypted, non-expired access token for the user, refreshing (and rotating
 * the refresh token) when near expiry. Returns null when there is no
 * connection or the refresh fails — in which case the row is marked
 * `expired` and the user has to reconnect.
 *
 * Concurrent refreshes can race (both rotate; the loser's refresh token is
 * dead). Acceptable at current scale: the loser fails once, the row still
 * ends up with a working pair from the winner.
 */
export async function getValidAccessToken(
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select()
    .from(tables.robinhoodConnections)
    .where(eq(tables.robinhoodConnections.userId, userId))
    .limit(1);
  if (!row) return null;

  const expiresAt = row.accessTokenExpiresAt?.getTime() ?? 0;
  if (expiresAt > Date.now() + EXPIRY_MARGIN_MS) {
    return cipher.decrypt(row.encryptedAccessToken);
  }

  try {
    const tokens = await refreshAccessToken(
      cipher.decrypt(row.encryptedRefreshToken),
    );
    await persistRefreshedTokens(userId, tokens);
    return tokens.access_token;
  } catch {
    await markExpired(userId);
    return null;
  }
}
