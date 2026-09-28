import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listAccounts, getValidAccessToken } from "@/lib/account-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Aggregate YouTube data for the side panel. Token-resolution order:
//   1) NextAuth primary Google session (Core Account) if it has YouTube
//      access — calling /me succeeds when the scope was granted.
//   2) First multi-account-flow connected account whose stored scopes
//      include youtube.readonly.
// We try #1 first so users who only have the primary Core Account
// connected immediately see their YouTube data after reconnecting.

type YouTubeChannel = {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    thumbnails?: { default?: { url?: string }; medium?: { url?: string } };
  };
  statistics?: { subscriberCount?: string; videoCount?: string };
};

type SubscriptionItem = {
  snippet?: {
    title?: string;
    description?: string;
    resourceId?: { channelId?: string };
    thumbnails?: { default?: { url?: string } };
  };
};

type ActivityItem = {
  snippet?: {
    title?: string;
    publishedAt?: string;
    channelTitle?: string;
    thumbnails?: { default?: { url?: string }; medium?: { url?: string } };
    type?: string;
  };
  contentDetails?: {
    upload?: { videoId?: string };
    playlistItem?: { resourceId?: { videoId?: string } };
  };
};

async function resolveAccessToken(): Promise<{
  accessToken: string;
  source: { email?: string; displayName?: string; picture?: string };
} | null> {
  // Try primary NextAuth Google first.
  const session = await getServerSession(authOptions);
  const sess = session as
    | {
        googleAccessToken?: string;
        user?: { email?: string; name?: string | null; image?: string | null };
      }
    | null;
  if (sess?.googleAccessToken) {
    // Probe with /channels?mine=true. A 403 means the token was issued
    // without youtube.readonly — fall through to the multi-account list.
    const probe = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
      { headers: { Authorization: `Bearer ${sess.googleAccessToken}` } }
    );
    if (probe.ok) {
      return {
        accessToken: sess.googleAccessToken,
        source: {
          email: sess.user?.email ?? undefined,
          displayName: sess.user?.name ?? undefined,
          picture: sess.user?.image ?? undefined,
        },
      };
    }
  }

  // Fall back to a multi-account-flow account that has YouTube scope.
  const accounts = await listAccounts();
  const yt = accounts.find((a) =>
    a.scopes.some((s) => s.includes("youtube"))
  );
  if (!yt) return null;
  const accessToken = await getValidAccessToken(yt.id);
  return {
    accessToken,
    source: {
      email: yt.email,
      displayName: yt.displayName,
      picture: yt.picture,
    },
  };
}

export async function GET() {
  const resolved = await resolveAccessToken();
  if (!resolved) {
    return NextResponse.json(
      { error: "youtube_not_connected" },
      { status: 424 }
    );
  }
  try {
    const base = "https://www.googleapis.com/youtube/v3";
    const auth = { Authorization: `Bearer ${resolved.accessToken}` };

    const [channelsRes, subsRes, activitiesRes] = await Promise.all([
      fetch(`${base}/channels?part=snippet,statistics&mine=true`, { headers: auth }),
      fetch(
        `${base}/subscriptions?part=snippet&mine=true&maxResults=12&order=relevance`,
        { headers: auth }
      ),
      fetch(
        `${base}/activities?part=snippet,contentDetails&mine=true&maxResults=10`,
        { headers: auth }
      ),
    ]);

    if (!channelsRes.ok) {
      // Most likely the token lacks the scope. Surface needsReauth so the
      // UI can prompt re-sign-in (which now requests youtube.readonly).
      const body = await channelsRes.text().catch(() => "");
      return NextResponse.json(
        {
          error: `youtube_${channelsRes.status}`,
          needsReauth: channelsRes.status === 403 || channelsRes.status === 401,
          detail: body.slice(0, 200),
        },
        { status: channelsRes.status }
      );
    }
    const channelsJson = (await channelsRes.json()) as { items?: YouTubeChannel[] };
    const subsJson = subsRes.ok
      ? ((await subsRes.json()) as { items?: SubscriptionItem[] })
      : { items: [] };
    const activitiesJson = activitiesRes.ok
      ? ((await activitiesRes.json()) as { items?: ActivityItem[] })
      : { items: [] };

    const channel = channelsJson.items?.[0];
    return NextResponse.json({
      account: resolved.source,
      channel: channel
        ? {
            id: channel.id,
            title: channel.snippet?.title,
            description: channel.snippet?.description,
            thumbnail:
              channel.snippet?.thumbnails?.medium?.url ??
              channel.snippet?.thumbnails?.default?.url,
            subscribers: channel.statistics?.subscriberCount,
            videoCount: channel.statistics?.videoCount,
          }
        : null,
      subscriptions:
        subsJson.items?.map((s) => ({
          channelId: s.snippet?.resourceId?.channelId,
          title: s.snippet?.title,
          thumbnail: s.snippet?.thumbnails?.default?.url,
        })) ?? [],
      recentActivity:
        activitiesJson.items?.map((a) => {
          const videoId =
            a.contentDetails?.upload?.videoId ??
            a.contentDetails?.playlistItem?.resourceId?.videoId;
          return {
            title: a.snippet?.title,
            channelTitle: a.snippet?.channelTitle,
            publishedAt: a.snippet?.publishedAt,
            type: a.snippet?.type,
            thumbnail:
              a.snippet?.thumbnails?.medium?.url ??
              a.snippet?.thumbnails?.default?.url,
            videoUrl: videoId
              ? `https://www.youtube.com/watch?v=${videoId}`
              : undefined,
          };
        }) ?? [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
