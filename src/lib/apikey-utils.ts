import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { encrypt, decrypt } from "@/lib/crypto";

// Per-user BYOK (Bring Your Own Key) provider factory. Sister of
// src/lib/oauth-utils.ts. Used by providers that don't offer OAuth — they
// hand out API keys and expect those to live on the user's machine
// (Anthropic, OpenAI, Vercel, n8n, Vapi, etc.).
//
// Storage: AES-256-GCM encrypted httpOnly cookie keyed by provider id. We
// intentionally do NOT mirror the HMAC-signed-but-readable format the OAuth
// helpers use, because API keys are long-lived bearer credentials that the
// user can't remotely revoke without manually rotating at the provider's
// dashboard. Encrypt at rest, decrypt only at fetch time.
//
// Each provider declares:
//   - how to call the test endpoint that proves the key works
//   - how to extract an `account` block from that response
//   - whether it also needs a baseUrl (self-hosted: n8n)

export type ApiKeyAccount = {
  id?: string | number;
  login?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  extra?: Record<string, string | number | boolean | undefined>;
};

export type ApiKeyProviderConfig = {
  id: string;
  label: string;
  // Whether the provider needs a base URL alongside the key (n8n: yes).
  needsBaseUrl?: boolean;
  // Default base URL when needsBaseUrl is false. Used by apiFetch when the
  // caller passes a relative path.
  defaultBaseUrl?: string;
  // How to attach the key to outbound requests.
  //   bearer    → Authorization: Bearer <key>
  //   x-api-key → x-api-key: <key>  (Anthropic)
  //   x-goog    → x-goog-api-key: <key>  (Google AI Studio)
  //   custom    → uses customHeaderName below
  authStyle: "bearer" | "x-api-key" | "x-goog" | "custom";
  // Required when authStyle === "custom". The header name to send the key in
  // (e.g. n8n uses "X-N8N-API-KEY").
  customHeaderName?: string;
  // Extra headers applied to every request (e.g. anthropic-version).
  extraHeaders?: Record<string, string>;
  // Pings a known endpoint to prove the key works + pulls an account block.
  // Receives an authenticated fetch bound to the saved key + baseUrl.
  validate: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>
  ) => Promise<ApiKeyAccount | undefined>;
};

type Stored = {
  apiKey: string;
  baseUrl?: string;
  storedAt: number;
};

export class ApiKeyNotConfigured extends Error {
  constructor(public provider: string) {
    super(`${provider}_not_configured`);
  }
}

export function createApiKeyProvider(config: ApiKeyProviderConfig) {
  const cookieName = `citadel-${config.id}-key`;

  function getStored(): Stored | null {
    const raw = cookies().get(cookieName)?.value;
    if (!raw) return null;
    try {
      return JSON.parse(decrypt(raw)) as Stored;
    } catch {
      // Corrupted / wrong key / stale — treat as not connected.
      return null;
    }
  }

  function storeKey(apiKey: string, baseUrl?: string): void {
    const payload: Stored = {
      apiKey,
      baseUrl: config.needsBaseUrl ? baseUrl : undefined,
      storedAt: Date.now(),
    };
    cookies().set(cookieName, encrypt(JSON.stringify(payload)), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      // 1 year. Manual rotation only — no expiry on most provider keys.
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  function clearKey(): void {
    cookies().delete(cookieName);
  }

  // ---- authenticated fetch ----
  function buildHeaders(
    key: string,
    extra: Record<string, string> = {}
  ): Record<string, string> {
    const base: Record<string, string> = {
      Accept: "application/json",
      ...(config.extraHeaders ?? {}),
      ...extra,
    };
    if (config.authStyle === "bearer") {
      base.Authorization = `Bearer ${key}`;
    } else if (config.authStyle === "x-api-key") {
      base["x-api-key"] = key;
    } else if (config.authStyle === "x-goog") {
      base["x-goog-api-key"] = key;
    } else if (config.authStyle === "custom" && config.customHeaderName) {
      base[config.customHeaderName] = key;
    }
    return base;
  }

  function resolveUrl(path: string, baseUrl?: string): string {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }
    const root =
      baseUrl ?? config.defaultBaseUrl ?? "";
    if (!root) return path;
    return `${root.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  }

  async function apiFetch<T>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> {
    const stored = getStored();
    if (!stored) throw new ApiKeyNotConfigured(config.id);
    const url = resolveUrl(path, stored.baseUrl);
    const res = await fetch(url, {
      ...init,
      headers: {
        ...buildHeaders(
          stored.apiKey,
          (init.headers as Record<string, string>) ?? {}
        ),
        ...(init.body && !(init.headers as Record<string, string>)?.["Content-Type"]
          ? { "Content-Type": "application/json" }
          : {}),
      },
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      // Key revoked/invalid — drop it so the UI shows "not connected".
      clearKey();
      throw new ApiKeyNotConfigured(config.id);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `${config.id}_${res.status}: ${body.slice(0, 120)}`
      );
    }
    return (await res.json()) as T;
  }

  // ---- validation: used both at connect-time and by checkConnection ----
  async function validate(
    apiKey: string,
    baseUrl?: string
  ): Promise<ApiKeyAccount | undefined> {
    // Build a one-shot apiFetch bound to the candidate key/baseUrl WITHOUT
    // persisting it first. This way a bad key doesn't get saved and then
    // immediately cleared by the 401 path.
    async function trial<T>(
      path: string,
      init: RequestInit = {}
    ): Promise<T> {
      const url = resolveUrl(path, baseUrl);
      const res = await fetch(url, {
        ...init,
        headers: {
          ...buildHeaders(
            apiKey,
            (init.headers as Record<string, string>) ?? {}
          ),
          ...(init.body && !(init.headers as Record<string, string>)?.["Content-Type"]
            ? { "Content-Type": "application/json" }
            : {}),
        },
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error(`${config.id}_unauthorized`);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `${config.id}_${res.status}: ${body.slice(0, 120)}`
        );
      }
      return (await res.json()) as T;
    }
    return await config.validate(trial);
  }

  // ---- status check ----
  type StatusResp = {
    configured: boolean; // always true for BYOK — no app-level config required
    connected: boolean;
    account?: ApiKeyAccount;
    needsBaseUrl?: boolean;
    error?: string;
  };
  async function checkConnection(): Promise<StatusResp> {
    const stored = getStored();
    if (!stored) {
      return {
        configured: true,
        connected: false,
        needsBaseUrl: config.needsBaseUrl,
      };
    }
    try {
      const account = await validate(stored.apiKey, stored.baseUrl);
      return {
        configured: true,
        connected: true,
        account,
        needsBaseUrl: config.needsBaseUrl,
      };
    } catch (e) {
      // Key is stale/revoked. Drop it.
      clearKey();
      return {
        configured: true,
        connected: false,
        needsBaseUrl: config.needsBaseUrl,
        error: e instanceof Error ? e.message : "unknown",
      };
    }
  }

  // ---- route handlers ----
  const connectHandler = async (req: Request) => {
    let body: { apiKey?: string; baseUrl?: string };
    try {
      body = (await req.json()) as { apiKey?: string; baseUrl?: string };
    } catch {
      return NextResponse.json({ error: "bad_json" }, { status: 400 });
    }
    const apiKey = body.apiKey?.trim();
    const baseUrl = body.baseUrl?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "missing_api_key" },
        { status: 400 }
      );
    }
    if (config.needsBaseUrl && !baseUrl) {
      return NextResponse.json(
        { error: "missing_base_url" },
        { status: 400 }
      );
    }
    try {
      const account = await validate(apiKey, baseUrl);
      storeKey(apiKey, baseUrl);
      return NextResponse.json({ ok: true, account });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "validation_failed";
      // 422 — request was well-formed but the key didn't work
      return NextResponse.json(
        { error: "invalid_credentials", detail: msg.slice(0, 200) },
        { status: 422 }
      );
    }
  };

  const disconnectHandler = async () => {
    clearKey();
    return NextResponse.json({ ok: true });
  };

  const statusHandler = async () => {
    return NextResponse.json(await checkConnection());
  };

  return {
    config,
    apiFetch,
    checkConnection,
    storeKey,
    clearKey,
    getStoredKey: () => getStored()?.apiKey ?? null,
    getStoredBaseUrl: () => getStored()?.baseUrl ?? null,
    connectHandler,
    disconnectHandler,
    statusHandler,
  };
}
