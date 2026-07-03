import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function key(envVar: string): Buffer {
  const raw = process.env[envVar];
  if (!raw) {
    throw new Error(`${envVar} is not set`);
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `${envVar} must decode to 32 bytes (got ${buf.length}); regenerate with: openssl rand -base64 32`,
    );
  }
  return buf;
}

function encryptWith(envVar: string, plaintext: string): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key(envVar), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]);
}

function decryptWith(envVar: string, payload: Buffer): string {
  if (payload.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("encrypted payload is too short");
  }
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(payload.length - TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH, payload.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key(envVar), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8",
  );
}

/** Cipher bound to one key env var, so each credential family gets its own key. */
export function cipherFor(envVar: string) {
  return {
    encrypt: (plaintext: string) => encryptWith(envVar, plaintext),
    decrypt: (payload: Buffer) => decryptWith(envVar, payload),
  };
}

// IOF credentials — the original (unrotatable) key. Existing callers keep
// importing { encrypt, decrypt } unchanged.
export const { encrypt, decrypt } = cipherFor("IOF_CREDS_ENCRYPTION_KEY");
