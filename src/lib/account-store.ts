import { readFile, writeFile, mkdir, rename } from "fs/promises";
import { join, dirname } from "path";
import { randomBytes } from "crypto";
import { encrypt, decrypt } from "./crypto";

// JSON-file-backed store for connected Google accounts. Lives at
// data/connected-accounts.json (gitignored). Single-user local-only — we
// don't need transactions or row-level locks. Writes use the
// tmpfile-then-rename trick for atomicity so a crash mid-write can't
// produce a half-written file.

const DATA_FILE = join(process.cwd(), "data", "connected-accounts.json");

export type ConnectedAccountPublic = {
  id: string;
  provider: "google";
  providerAccountId: string;
  email: string;
  displayName?: string;
  // Google profile photo URL (from userinfo). Cached on connect — Google
  // serves a stable lh3.googleusercontent.com URL so we don't need to re-fetch.
  picture?: string;
  scopes: string[];
  expiresAt: number; // unix seconds
  createdAt: string; // ISO
  updatedAt: string; // ISO
  lastSyncedAt?: string;
};

// On-disk record. Includes encrypted token blobs that never cross over to
// any client/serialized response — see toPublic() below.
type StoredAccount = ConnectedAccountPublic & {
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
};

type Store = { accounts: StoredAccount[] };

function toPublic(a: StoredAccount): ConnectedAccountPublic {
  // Strip the encrypted blobs so they never accidentally land in a JSON
  // response. Tokens decrypt only on the server, only when we're about to
  // call Google.
  return {
    id: a.id,
    provider: a.provider,
    providerAccountId: a.providerAccountId,
    email: a.email,
    displayName: a.displayName,
    picture: a.picture,
    scopes: a.scopes,
    expiresAt: a.expiresAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    lastSyncedAt: a.lastSyncedAt,
  };
}

async function readStore(): Promise<Store> {
  try {
    const buf = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(buf) as Partial<Store>;
    return { accounts: parsed.accounts ?? [] };
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { accounts: [] };
    throw e;
  }
}

async function writeStore(s: Store): Promise<void> {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  // Atomic: write to a tmp file, then rename. POSIX rename is atomic;
  // Windows is "best effort" but still safe enough for a local single-user app.
  const tmp = `${DATA_FILE}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tmp, JSON.stringify(s, null, 2), "utf8");
  await rename(tmp, DATA_FILE);
}

export async function listAccounts(): Promise<ConnectedAccountPublic[]> {
  const s = await readStore();
  // Sort newest-connected first by default — matches the order users
  // typically expect ("most recent change at the top").
  return s.accounts.map(toPublic).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export async function getAccount(id: string): Promise<StoredAccount | null> {
  const s = await readStore();
  return s.accounts.find((a) => a.id === id) ?? null;
}

export async function upsertAccount(input: {
  providerAccountId: string;
  email: string;
  displayName?: string;
  picture?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
}): Promise<ConnectedAccountPublic> {
  const s = await readStore();
  const now = new Date().toISOString();
  // Dedupe by Google's stable `sub` (providerAccountId). If the same Google
  // account is re-added we update its tokens in place instead of stacking.
  const existing = s.accounts.findIndex(
    (a) => a.providerAccountId === input.providerAccountId
  );
  const id =
    existing >= 0
      ? s.accounts[existing].id
      : "acc_" + randomBytes(6).toString("hex");
  const record: StoredAccount = {
    id,
    provider: "google",
    providerAccountId: input.providerAccountId,
    email: input.email,
    displayName: input.displayName,
    picture: input.picture,
    accessTokenEncrypted: encrypt(input.accessToken),
    refreshTokenEncrypted: encrypt(input.refreshToken),
    expiresAt: input.expiresAt,
    scopes: input.scopes,
    createdAt: existing >= 0 ? s.accounts[existing].createdAt : now,
    updatedAt: now,
  };
  if (existing >= 0) s.accounts[existing] = record;
  else s.accounts.push(record);
  await writeStore(s);
  return toPublic(record);
}

export async function deleteAccount(id: string): Promise<boolean> {
  const s = await readStore();
  const before = s.accounts.length;
  s.accounts = s.accounts.filter((a) => a.id !== id);
  if (s.accounts.length === before) return false;
  await writeStore(s);
  return true;
}

export async function updateLastSynced(id: string): Promise<void> {
  const s = await readStore();
  const idx = s.accounts.findIndex((a) => a.id === id);
  if (idx === -1) return;
  s.accounts[idx].lastSyncedAt = new Date().toISOString();
  await writeStore(s);
}

// ---- Token refresh ------------------------------------------------------

async function refreshAccountTokens(id: string): Promise<string> {
  const acc = await getAccount(id);
  if (!acc) throw new Error("account_not_found");
  const refreshToken = decrypt(acc.refreshTokenEncrypted);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      `google_refresh_failed_${res.status}: ${data.error_description ?? data.error ?? "unknown"}`
    );
  }
  const s = await readStore();
  const idx = s.accounts.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error("account_not_found");
  s.accounts[idx] = {
    ...s.accounts[idx],
    accessTokenEncrypted: encrypt(data.access_token),
    // Google omits refresh_token on most refreshes — keep the existing one.
    refreshTokenEncrypted: data.refresh_token
      ? encrypt(data.refresh_token)
      : s.accounts[idx].refreshTokenEncrypted,
    expiresAt:
      Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    updatedAt: new Date().toISOString(),
  };
  await writeStore(s);
  return data.access_token;
}

// Returns a valid (refreshing if needed) access token for the given account.
// Plain string — the caller is responsible for not logging it.
export async function getValidAccessToken(id: string): Promise<string> {
  const acc = await getAccount(id);
  if (!acc) throw new Error("account_not_found");
  // 60s safety window so we don't hand out a token that's about to expire
  // mid-request.
  if (Date.now() / 1000 < acc.expiresAt - 60) {
    return decrypt(acc.accessTokenEncrypted);
  }
  return await refreshAccountTokens(id);
}
