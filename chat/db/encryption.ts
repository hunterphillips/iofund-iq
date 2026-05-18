import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function key(): Buffer {
  const raw = process.env.IOF_CREDS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("IOF_CREDS_ENCRYPTION_KEY is not set");
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `IOF_CREDS_ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length}); regenerate with: openssl rand -base64 32`,
    );
  }
  return buf;
}

export function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]);
}

export function decrypt(payload: Buffer): string {
  if (payload.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("encrypted payload is too short");
  }
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(payload.length - TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH, payload.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8",
  );
}
