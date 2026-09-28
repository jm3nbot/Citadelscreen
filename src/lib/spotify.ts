import { cookies } from "next/headers";
import { createHmac, randomBytes } from "crypto";

// Spotify OAuth runs in its own cookie-based flow, completely independent of
// NextAuth. Reason: NextAuth's JWT strategy (no DB adapter) cannot link two
// providers — signing in with a second one resets the JWT, wiping the first
// provider's tokens. Keeping them separate means Google and Spotify never
// trample each other.

const SPOTIFY_API = "https://api.spotify.com/v1";
const SPOTIFY_AUTH = "https://accounts.spotify.com";
const TOKEN_COOKIE = "citadel-spotify";
const STATE_COOKIE = "citadel-spotify-state";

export const SPOTIFY_SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-read-recently-played",
  "user-top-read",
].join(" ");

export function spotifyConfigured(): boolean {
  return Boolean(
    process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
  );
}

// Redirect URI must exactly match what's registered in the Spotify Dashboard.
// The user registered the NextAuth-style path; we'll just serve our own
// file-system route at the same path (file routes beat NextAuth's catch-all).
export function spotifyRedirectUri(): string {
  const base =
    process.env.SPOTIFY_REDIRECT_URI ??
    process.env.NEXTAUTH_URL ??
    "http://127.0.0.1:3000";
  return `${base.replace(/\/$/, "")}/api/auth/callback/spotify`;
}

type TokenBundle = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms epoch
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
    maxAge: 60 * 60 * 24 * 90,
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

async function tokenRequest(body: URLSearchParams): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}> {
  const res = await fetch(`${SPOTIFY_AUTH}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64"),
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`spotify_token_${res.status}: ${text.slice(0, 80)}`);
  }
  return (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };
}

export async function exchangeCode(code: string): Promise<TokenBundle> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: spotifyRedirectUri(),
  });
  const r = await tokenRequest(body);
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token ?? "",
    expiresAt: Date.now() + r.expires_in * 1000,
  };
}

async function refreshAccessToken(refreshToken: string): Promise<TokenBundle> {
  const r = await tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token ?? refreshToken,
    expiresAt: Date.now() + r.expires_in * 1000,
  };
}

export async function getValidAccessToken(): Promise<string | null> {
  const stored = getStoredTokens();
  if (!stored) return null;
  if (Date.now() < stored.expiresAt - 60_000) return stored.accessToken;
  if (!stored.refreshToken) return null;
  try {
    const refreshed = await refreshAccessToken(stored.refreshToken);
    storeTokens(refreshed);
    return refreshed.accessToken;
  } catch {
    return null;
  }
}

export class SpotifyNotConnected extends Error {
  constructor() {
    super("spotify_not_connected");
  }
}

export async function spotifyFetch<T>(path: string): Promise<T | null> {
  const token = await getValidAccessToken();
  if (!token) throw new SpotifyNotConnected();
  const res = await fetch(`${SPOTIFY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`spotify_${res.status}`);
  return (await res.json()) as T;
}

export type SpotifyStatusResp = {
  configured: boolean;
  connected: boolean;
  account?: { displayName?: string; email?: string; product?: string };
  error?: string;
};

export async function checkSpotifyConnection(): Promise<SpotifyStatusResp> {
  if (!spotifyConfigured()) return { configured: false, connected: false };
  if (!getStoredTokens()) return { configured: true, connected: false };
  try {
    const profile = await spotifyFetch<{
      display_name?: string;
      email?: string;
      product?: string;
    }>("/me");
    if (!profile) return { configured: true, connected: true };
    return {
      configured: true,
      connected: true,
      account: {
        displayName: profile.display_name,
        email: profile.email,
        product: profile.product,
      },
    };
  } catch (e) {
    return {
      configured: true,
      connected: false,
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}
