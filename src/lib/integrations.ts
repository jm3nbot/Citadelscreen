// Server-side helpers for third-party integrations beyond Google. Each one
// checks its credential and returns a typed client or null. The companion
// status route hits these and exposes a single { connected, account? } shape
// per provider so the UI never has to claim something is connected when it
// isn't.

const GITHUB_API = "https://api.github.com";
const VERCEL_API = "https://api.vercel.com";
const TELEGRAM_API = "https://api.telegram.org";
const META_GRAPH_API = "https://graph.facebook.com/v20.0";

export type GithubStatus = {
  connected: boolean;
  account?: { login: string; name?: string; avatarUrl?: string };
  error?: string;
};

export type VercelStatus = {
  connected: boolean;
  account?: { username?: string; email?: string };
  teamId?: string;
  error?: string;
};

export type TelegramStatus = {
  connected: boolean;
  // Bot identity from getMe — distinct from the human owner. We make this
  // explicit so the UI doesn't mislead the user into thinking we have access
  // to their personal Telegram account (we don't — Bot API only).
  bot?: {
    id: number;
    username?: string;
    firstName: string;
    canReadAllGroupMessages?: boolean;
  };
  error?: string;
};

export type WhatsappStatus = {
  connected: boolean;
  phone?: {
    displayPhoneNumber?: string;
    verifiedName?: string;
    qualityRating?: string;
    id?: string;
  };
  error?: string;
};

export async function checkGithub(): Promise<GithubStatus> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { connected: false };
  try {
    const res = await fetch(`${GITHUB_API}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return { connected: false, error: `github_${res.status}` };
    }
    const u = (await res.json()) as {
      login: string;
      name?: string;
      avatar_url?: string;
    };
    return {
      connected: true,
      account: { login: u.login, name: u.name, avatarUrl: u.avatar_url },
    };
  } catch (e) {
    return { connected: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function checkVercel(): Promise<VercelStatus> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return { connected: false };
  const teamId = process.env.VERCEL_TEAM_ID;
  try {
    const url = new URL(`${VERCEL_API}/v2/user`);
    if (teamId) url.searchParams.set("teamId", teamId);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return { connected: false, error: `vercel_${res.status}` };
    }
    const j = (await res.json()) as {
      user?: { username?: string; email?: string };
    };
    return {
      connected: true,
      teamId,
      account: { username: j.user?.username, email: j.user?.email },
    };
  } catch (e) {
    return { connected: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function checkTelegram(): Promise<TelegramStatus> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { connected: false };
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/getMe`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return { connected: false, error: `telegram_${res.status}` };
    }
    const j = (await res.json()) as {
      ok?: boolean;
      result?: {
        id: number;
        is_bot: boolean;
        username?: string;
        first_name: string;
        can_read_all_group_messages?: boolean;
      };
      description?: string;
    };
    if (!j.ok || !j.result) {
      return { connected: false, error: j.description ?? "telegram_bad_response" };
    }
    return {
      connected: true,
      bot: {
        id: j.result.id,
        username: j.result.username,
        firstName: j.result.first_name,
        canReadAllGroupMessages: j.result.can_read_all_group_messages,
      },
    };
  } catch (e) {
    return { connected: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function checkWhatsApp(): Promise<WhatsappStatus> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { connected: false };
  try {
    // Fetch the business phone number metadata — proves the token has access
    // to this specific phone number ID, not just any WhatsApp Business asset.
    const url = `${META_GRAPH_API}/${phoneId}?fields=display_phone_number,verified_name,quality_rating,id`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      const body = await res.text();
      return { connected: false, error: `whatsapp_${res.status}: ${body.slice(0, 80)}` };
    }
    const j = (await res.json()) as {
      id?: string;
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
    };
    return {
      connected: true,
      phone: {
        id: j.id,
        displayPhoneNumber: j.display_phone_number,
        verifiedName: j.verified_name,
        qualityRating: j.quality_rating,
      },
    };
  } catch (e) {
    return { connected: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

// Authenticated wrappers used by feature routes. Throw `NotConnected` so the
// route can return a clean 401/424 instead of leaking the underlying failure.
export class NotConnected extends Error {
  constructor(public provider: string) {
    super(`${provider}_not_connected`);
  }
}

export function githubToken(): string {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new NotConnected("github");
  return t;
}

export function vercelToken(): { token: string; teamId?: string } {
  const t = process.env.VERCEL_TOKEN;
  if (!t) throw new NotConnected("vercel");
  return { token: t, teamId: process.env.VERCEL_TEAM_ID };
}

export async function ghFetch<T>(path: string, revalidate = 30): Promise<T> {
  const token = githubToken();
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`github_${res.status}`);
  return (await res.json()) as T;
}

// GraphQL helper — used for the contribution heatmap, which REST does not
// expose. Returns `data` (the inner GraphQL payload) and throws on transport
// or GraphQL-level errors so callers get a single failure mode.
export async function ghGraphql<T>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const token = githubToken();
  const res = await fetch(`${GITHUB_API}/graphql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    // Heatmap is expensive — cache 5 min. Callers can pass shorter TTLs by
    // wrapping with their own fetch if they need fresher data.
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`github_graphql_${res.status}`);
  const j = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (j.errors?.length) {
    throw new Error(`github_graphql: ${j.errors.map((e) => e.message).join("; ")}`);
  }
  if (!j.data) throw new Error("github_graphql_empty");
  return j.data;
}

export async function vercelFetch<T>(path: string): Promise<T> {
  const { token, teamId } = vercelToken();
  const url = new URL(`${VERCEL_API}${path}`);
  if (teamId && !url.searchParams.has("teamId")) url.searchParams.set("teamId", teamId);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`vercel_${res.status}`);
  return (await res.json()) as T;
}
