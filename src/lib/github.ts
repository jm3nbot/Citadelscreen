import { cookies } from "next/headers";
import { createHmac, randomBytes } from "crypto";

// GitHub OAuth runs its own cookie-based flow, independent of NextAuth — same
// rationale as src/lib/spotify.ts. Each user gets a per-browser cookie holding
// a signed token bundle; the server reads it on every request and talks to
// GitHub on their behalf. No env-var token, no shared identity.

const GITHUB_API = "https://api.github.com";
const GITHUB_AUTH = "https://github.com/login/oauth";
const TOKEN_COOKIE = "citadel-github";
const STATE_COOKIE = "citadel-github-state";

// Read access to repos, profile, and emails. `read:org` lets us surface
// org-owned repos in "top repos". Add more scopes here if you add features
// that need them (e.g. `notifications` for the notifications counter).
export const GITHUB_SCOPES = ["read:user", "user:email", "repo", "read:org"].join(" ");

export function githubConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

export function githubRedirectUri(): string {
  const base =
    process.env.GITHUB_REDIRECT_URI ??
    process.env.NEXTAUTH_URL ??
    "http://127.0.0.1:3000";
  return `${base.replace(/\/$/, "")}/api/auth/callback/github`;
}

// GitHub OAuth Apps (not GitHub Apps) issue non-expiring tokens, so we only
// need to store the access token. We still keep a typed shape in case we
// migrate to GitHub Apps later (which do refresh).
type TokenBundle = {
  accessToken: string;
  scope?: string;
  storedAt: number;
};

function secret(): string {
  return process.env.NEXTAUTH_SECRET || "dev-secret-do-not-use-in-prod";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(b: TokenBundle): string {
  const payload = Buffer.from(JSON.stringify(b)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(cookie: string): TokenBundle | null {
  try {
    const [payload, sig] = cookie.split(".");
    if (!payload || !sig) return null;
    if (sign(payload) !== sig) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
}

function getStoredTokens(): TokenBundle | null {
  const c = cookies().get(TOKEN_COOKIE)?.value;
  if (!c) return null;
  return decode(c);
}

export function storeTokens(b: TokenBundle): void {
  cookies().set(TOKEN_COOKIE, encode(b), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180, // 6 months; GitHub tokens don't expire but users may revoke
  });
}

export function clearStoredTokens(): void {
  cookies().delete(TOKEN_COOKIE);
}

export function newAuthState(): string {
  const state = randomBytes(16).toString("hex");
  cookies().set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return state;
}

export function verifyAuthState(received: string | null): boolean {
  const expected = cookies().get(STATE_COOKIE)?.value;
  cookies().delete(STATE_COOKIE);
  return Boolean(received && expected && received === expected);
}

export async function exchangeCode(code: string): Promise<TokenBundle> {
  const res = await fetch(`${GITHUB_AUTH}/access_token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID ?? "",
      client_secret: process.env.GITHUB_CLIENT_SECRET ?? "",
      code,
      redirect_uri: githubRedirectUri(),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`github_token_${res.status}: ${text.slice(0, 80)}`);
  }
  const j = (await res.json()) as {
    access_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!j.access_token) {
    throw new Error(j.error_description ?? j.error ?? "github_no_token");
  }
  return {
    accessToken: j.access_token,
    scope: j.scope,
    storedAt: Date.now(),
  };
}

export function getStoredAccessToken(): string | null {
  return getStoredTokens()?.accessToken ?? null;
}

export class GithubNotConnected extends Error {
  constructor() {
    super("github_not_connected");
  }
}

// Per-user authenticated REST fetch. Mirrors the env-var-backed ghFetch in
// integrations.ts but reads the per-user cookie. The two helpers can coexist:
// integrations.ts is for server-side / cron contexts, this is for user routes.
export async function githubFetch<T>(path: string, revalidate = 30): Promise<T> {
  const token = getStoredAccessToken();
  if (!token) throw new GithubNotConnected();
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    next: { revalidate },
  });
  if (res.status === 401) {
    // Token revoked or invalid — clear the cookie so the UI shows "not connected"
    clearStoredTokens();
    throw new GithubNotConnected();
  }
  if (!res.ok) throw new Error(`github_${res.status}`);
  return (await res.json()) as T;
}

export async function githubGraphql<T>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const token = getStoredAccessToken();
  if (!token) throw new GithubNotConnected();
  const res = await fetch(`${GITHUB_API}/graphql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 300 },
  });
  if (res.status === 401) {
    clearStoredTokens();
    throw new GithubNotConnected();
  }
  if (!res.ok) throw new Error(`github_graphql_${res.status}`);
  const j = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (j.errors?.length) {
    throw new Error(`github_graphql: ${j.errors.map((e) => e.message).join("; ")}`);
  }
  if (!j.data) throw new Error("github_graphql_empty");
  return j.data;
}

export type GithubStatusResp = {
  configured: boolean;
  connected: boolean;
  account?: { login: string; name?: string; avatarUrl?: string };
  error?: string;
};

export async function checkGithubConnection(): Promise<GithubStatusResp> {
  if (!githubConfigured()) return { configured: false, connected: false };
  if (!getStoredAccessToken()) return { configured: true, connected: false };
  try {
    const u = await githubFetch<{ login: string; name?: string | null; avatar_url?: string }>(
      "/user",
      60
    );
    return {
      configured: true,
      connected: true,
      account: {
        login: u.login,
        name: u.name ?? undefined,
        avatarUrl: u.avatar_url,
      },
    };
  } catch (e) {
    if (e instanceof GithubNotConnected) {
      return { configured: true, connected: false };
    }
    return {
      configured: true,
      connected: false,
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}
