import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listAccounts, getValidAccessToken } from "@/lib/account-store";

// Compact YouTube context. Source-resolution mirrors the /api/youtube/overview
// route: try the NextAuth Core Account first (it has youtube.readonly after
// the recent scope bump), fall back to multi-account-flow accounts whose
// stored scopes include youtube. Returns null when no source works so the
// AI route can omit the section cleanly.

type Channel = {
  snippet?: { title?: string };
  statistics?: { subscriberCount?: string; videoCount?: string };
};
type SubscriptionItem = { snippet?: { title?: string } };
type ActivityItem = {
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    type?: string;
  };
};

async function resolveToken(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const sess = session as { googleAccessToken?: string } | null;
  if (sess?.googleAccessToken) {
    // Probe — if the primary token has youtube scope, prefer it.
    const probe = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
      { headers: { Authorization: `Bearer ${sess.googleAccessToken}` } }
    );
    if (probe.ok) return sess.googleAccessToken;
  }
  const accounts = await listAccounts();
  const yt = accounts.find((a) =>
    a.scopes.some((s) => s.includes("youtube"))
  );
  if (!yt) return null;
  try {
    return await getValidAccessToken(yt.id);
  } catch {
    return null;
  }
}

export async function fetchYouTubeContext(): Promise<string | null> {
  const token = await resolveToken();
  if (!token) return null;
  const base = "https://www.googleapis.com/youtube/v3";
  const auth = { Authorization: `Bearer ${token}` };

  try {
    const [channelsRes, subsRes, activitiesRes] = await Promise.all([
      fetch(`${base}/channels?part=snippet,statistics&mine=true`, { headers: auth }),
      fetch(`${base}/subscriptions?part=snippet&mine=true&maxResults=8&order=relevance`, {
        headers: auth,
      }),
      fetch(`${base}/activities?part=snippet&mine=true&maxResults=8`, {
        headers: auth,
      }),
    ]);
    if (!channelsRes.ok) return null;
    const ch = (await channelsRes.json()) as { items?: Channel[] };
    const subs = subsRes.ok
      ? ((await subsRes.json()) as { items?: SubscriptionItem[] })
      : { items: [] };
    const acts = activitiesRes.ok
      ? ((await activitiesRes.json()) as { items?: ActivityItem[] })
      : { items: [] };

    const lines: string[] = [];
    const me = ch.items?.[0];
    if (me) {
      lines.push(
        `channel: ${me.snippet?.title ?? "?"} | subs:${me.statistics?.subscriberCount ?? "?"} | videos:${me.statistics?.videoCount ?? "?"}`
      );
    }
    if (subs.items?.length) {
      lines.push(
        `subscriptions: ${subs.items.map((s) => s.snippet?.title).filter(Boolean).join(" | ")}`
      );
    }
    if (acts.items?.length) {
      lines.push(
        `recent_activity: ${acts.items
          .slice(0, 8)
          .map(
            (a) =>
              `${a.snippet?.channelTitle ?? "?"}: ${a.snippet?.title ?? "?"}`
          )
          .join(" || ")}`
      );
    }
    return `<YOUTUBE_CONTEXT>\n${lines.join("\n")}\n</YOUTUBE_CONTEXT>`;
  } catch {
    return null;
  }
}
