import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

// AES-256-GCM symmetric encryption for OAuth tokens stored on disk.
// The TOKEN_ENCRYPTION_KEY env var is run through scrypt to produce a fixed
// 32-byte key, so any reasonable string length works — users don't have to
// supply exactly 32 bytes of base64 themselves.
//
// Output format: base64(iv || authTag || ciphertext). All three are needed
// to decrypt + verify integrity. Tampering with any byte breaks decryption.

const ALGO = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const SALT = "citadel-token-salt-v1";

let cachedKey: Buffer | null = null;
let cachedFor: string | null = null;

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set in .env.local — set it to any " +
        "long random string (e.g. `openssl rand -base64 32`) so we can " +
        "encrypt OAuth tokens before writing them to disk."
    );
  }
  if (raw.length < 16) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is too short (<16 chars). Use at least 32 chars."
    );
  }
  if (cachedKey && cachedFor === raw) return cachedKey;
  cachedKey = scryptSync(raw, SALT, KEY_LEN);
  cachedFor = raw;
  return cachedKey;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("encrypted_payload_too_short");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
    "utf8"
  );
}

// Sanity self-test. Useful for surfacing key misconfiguration at startup
// rather than the first time we try to decrypt a token.
export function selfTestCrypto(): boolean {
  try {
    const sample = "citadel-crypto-roundtrip-" + Date.now();
    return decrypt(encrypt(sample)) === sample;
  } catch {
    return false;
  }
}
