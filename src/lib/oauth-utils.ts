import { cookies } from "next/headers";
import { createHmac, randomBytes } from "crypto";
import { NextResponse } from "next/server";

// Generic OAuth 2.0 provider factory. Mirrors the per-user-cookie pattern
// established by src/lib/spotify.ts and src/lib/github.ts. Each provider
// declares its endpoints + scopes + how to fetch a profile, and gets back
// connect/callback/disconnect/status route handlers + a typed fetcher.
//
// Cookie names are isolated per provider — connecting Slack doesn't touch
// Notion. State cookies are scoped + short-lived (10 min) so a stuck OAuth
// dance can't poison future attempts.

// Auth header strategy when calling the token-exchange endpoint.
//   "body":  client_id + client_secret in form body (Slack, Discord, Linear, Figma, GitHub)
//   "basic": HTTP Basic auth header (Notion, Spotify)
export type TokenAuthMode = "body" | "basic";

// Scope delimiter. Most providers use space. Linear + Figma use comma.
export type ScopeDelimiter = " " | ",";

export type ProviderAccount = {
  id?: string | number;
  login?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  // Free-form extras for the status payload (team name, workspace, etc.).
  // Kept loose so each provider can surface what makes sense.
  extra?: Record<string, string | number | undefined>;
};

export type ProviderConfig = {
  // Stable lowercase id used in env-var names, cookie names, route paths.
  id: string;
  // Human-readable name for error messages.
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  scopeDelimiter?: ScopeDelimiter;
  tokenAuth?: TokenAuthMode;
  // Extra params to append to the authorize URL (e.g. `owner=user` for Notion,
  // `prompt=consent` for forcing the consent screen).
  extraAuthorizeParams?: Record<string, string>;
  // Per-provider profile fetch. Receives an authenticated fetch helper and
  // returns the account block we surface in /status. Throw to indicate the
  // token is no longer valid; the factory clears the cookie + returns
  // `connected: false` to the caller.
  fetchProfile: (
    apiFetch: <T>(url: string, init?: RequestInit) => Promise<T>
  ) => Promise<ProviderAccount | undefined>;
  // Optional override for the post-callback redirect. Default: "/".
  successPath?: string;
};

type TokenBundle = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  storedAt: number;
  // Free-form metadata captured at exchange time (team id, workspace id, etc.).
  meta?: Record<string, unknown>;
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

function envVarName(id: string, suffix: "CLIENT_ID" | "CLIENT_SECRET" | "REDIRECT_URI"): string {
  return `${id.toUpperCase()}_${suffix}`;
}

function clientId(id: string): string | undefined {
  return process.env[envVarName(id, "CLIENT_ID")];
}

function clientSecret(id: string): string | undefined {
  return process.env[envVarName(id, "CLIENT_SECRET")];
}

function redirectUri(id: string): string {
  const explicit = process.env[envVarName(id, "REDIRECT_URI")];
  if (explicit) return explicit;
  const base = process.env.NEXTAUTH_URL ?? "http://127.0.0.1:3000";
  return `${base.replace(/\/$/, "")}/api/auth/callback/${id}`;
}

export class OAuthNotConnected extends Error {
  constructor(public provider: string) {
    super(`${provider}_not_connected`);
  }
}

// ---- Factory ----
export function createOAuthProvider(config: ProviderConfig) {
  const tokenCookie = `citadel-${config.id}`;
  const stateCookie = `citadel-${config.id}-state`;
  const delim = config.scopeDelimiter ?? " ";
  const tokenAuth: TokenAuthMode = config.tokenAuth ?? "body";

  // ---- token storage ----
  function storeTokens(b: TokenBundle): void {
    cookies().set(tokenCookie, encode(b), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      // 6 months. Some providers (e.g. Slack) issue non-expiring tokens, so
      // a long cookie life avoids forcing reconnects on perfectly-valid tokens.
      maxAge: 60 * 60 * 24 * 180,
    });
  }
  function clearStoredTokens(): void {
    cookies().delete(tokenCookie);
  }
  function getStoredTokens(): TokenBundle | null {
    const c = cookies().get(tokenCookie)?.value;
    if (!c) return null;
    return decode(c);
  }
  function getStoredAccessToken(): string | null {
    return getStoredTokens()?.accessToken ?? null;
  }

  // ---- state (CSRF) ----
  function newAuthState(): string {
    const state = randomBytes(16).toString("hex");
    cookies().set(stateCookie, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return state;
  }
  function verifyAuthState(received: string | null): boolean {
    const expected = cookies().get(stateCookie)?.value;
    cookies().delete(stateCookie);
    return Boolean(received && expected && received === expected);
  }

  // ---- config check ----
  function configured(): boolean {
    return Boolean(clientId(config.id) && clientSecret(config.id));
  }

  // ---- token exchange ----
  async function exchangeCode(code: string): Promise<TokenBundle> {
    const cid = clientId(config.id);
    const csec = clientSecret(config.id);
    if (!cid || !csec) {
      throw new Error(`${config.id}_not_configured`);
    }
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(config.id),
    });
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (tokenAuth === "basic") {
      headers.Authorization =
        "Basic " + Buffer.from(`${cid}:${csec}`).toString("base64");
    } else {
      body.set("client_id", cid);
      body.set("client_secret", csec);
    }
    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers,
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `${config.id}_token_${res.status}: ${text.slice(0, 120)}`
      );
    }
    const j = (await res.json()) as Record<string, unknown>;
    const accessToken = (j.access_token ?? j.accessToken) as
      | string
      | undefined;
    if (!accessToken) {
      throw new Error(
        `${config.id}_no_token: ${JSON.stringify(j).slice(0, 120)}`
      );
    }
    const refreshToken = (j.refresh_token ?? j.refreshToken) as
      | string
      | undefined;
    const expiresIn = (j.expires_in ?? j.expiresIn) as number | undefined;
    const scope = (j.scope ?? j.scopes) as string | undefined;
    return {
      accessToken,
      refreshToken,
      expiresAt:
        typeof expiresIn === "number" ? Date.now() + expiresIn * 1000 : undefined,
      scope,
      storedAt: Date.now(),
      meta: { ...j, access_token: undefined, refresh_token: undefined },
    };
  }

  // ---- authenticated fetch ----
  async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
    const token = getStoredAccessToken();
    if (!token) throw new OAuthNotConnected(config.id);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...((init.headers as Record<string, string>) ?? {}),
    };
    const res = await fetch(url, { ...init, headers, cache: "no-store" });
    if (res.status === 401) {
      clearStoredTokens();
      throw new OAuthNotConnected(config.id);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `${config.id}_${res.status}: ${text.slice(0, 120)}`
      );
    }
    return (await res.json()) as T;
  }

  // ---- status check ----
  type StatusResp = {
    configured: boolean;
    connected: boolean;
    account?: ProviderAccount;
    error?: string;
  };
  async function checkConnection(): Promise<StatusResp> {
    if (!configured()) return { configured: false, connected: false };
    if (!getStoredAccessToken()) return { configured: true, connected: false };
    try {
      const account = await config.fetchProfile(apiFetch);
      return { configured: true, connected: true, account };
    } catch (e) {
      if (e instanceof OAuthNotConnected) {
        return { configured: true, connected: false };
      }
      return {
        configured: true,
        connected: false,
        error: e instanceof Error ? e.message : "unknown",
      };
    }
  }

  // ---- route handlers ----
  const connectHandler = async (req: Request) => {
    if (!configured()) {
      return NextResponse.json(
        {
          error: "not_configured",
          hint: `Set ${envVarName(
            config.id,
            "CLIENT_ID"
          )} and ${envVarName(
            config.id,
            "CLIENT_SECRET"
          )} in .env.local. See the README link in /apps for ${config.label} dashboard setup.`,
        },
        { status: 503 }
      );
    }
    // localhost on the original URL kills the cookie round-trip — bail out
    // with a clear error so the client can bounce to 127.0.0.1 first.
    const host = req.headers.get("host") ?? "";
    if (host.startsWith("localhost")) {
      const redirect = new URL("/apps", req.url);
      redirect.searchParams.set(`${config.id}_error`, "wrong_host_localhost");
      return NextResponse.redirect(redirect);
    }

    const state = newAuthState();
    const params = new URLSearchParams({
      client_id: clientId(config.id) ?? "",
      response_type: "code",
      redirect_uri: redirectUri(config.id),
      scope: config.scopes.join(delim),
      state,
      ...(config.extraAuthorizeParams ?? {}),
    });
    return NextResponse.redirect(`${config.authorizeUrl}?${params.toString()}`);
  };

  const callbackHandler = async (req: Request) => {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const home = new URL(config.successPath ?? "/", req.url);
    if (error) {
      home.searchParams.set(`${config.id}_error`, error);
      return NextResponse.redirect(home);
    }
    if (!code) {
      home.searchParams.set(`${config.id}_error`, "missing_code");
      return NextResponse.redirect(home);
    }
    if (!verifyAuthState(state)) {
      home.searchParams.set(`${config.id}_error`, "state_mismatch");
      return NextResponse.redirect(home);
    }
    try {
      const bundle = await exchangeCode(code);
      storeTokens(bundle);
      home.searchParams.set(config.id, "connected");
      return NextResponse.redirect(home);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "exchange_failed";
      home.searchParams.set(`${config.id}_error`, msg.slice(0, 80));
      return NextResponse.redirect(home);
    }
  };

  const disconnectHandler = async () => {
    clearStoredTokens();
    return NextResponse.json({ ok: true });
  };

  const statusHandler = async () => {
    return NextResponse.json(await checkConnection());
  };

  return {
    config,
    // Plain helpers (for AI context fetchers, dashboards, etc.):
    apiFetch,
    checkConnection,
    storeTokens,
    clearStoredTokens,
    getStoredAccessToken,
    configured,
    redirectUri: () => redirectUri(config.id),
    // Pre-baked route handlers:
    connectHandler,
    callbackHandler,
    disconnectHandler,
    statusHandler,
  };
}
