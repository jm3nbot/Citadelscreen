"use client";

import useSWR from "swr";
import { signIn, signOut } from "next-auth/react";
import { Play, ExternalLink, Plug, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatRelativeTime } from "@/lib/utils";

type OverviewResp = {
  account?: { email?: string; displayName?: string; picture?: string };
  channel?: {
    id?: string;
    title?: string;
    description?: string;
    thumbnail?: string;
    subscribers?: string;
    videoCount?: string;
  } | null;
  subscriptions?: Array<{
    channelId?: string;
    title?: string;
    thumbnail?: string;
  }>;
  recentActivity?: Array<{
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    type?: string;
    thumbnail?: string;
    videoUrl?: string;
  }>;
  error?: string;
};

export function YouTubePanel() {
  const { data, error, isLoading } = useSWR<OverviewResp>(
    "/api/youtube/overview"
  );

  const errBody = (error as { body?: { error?: string; needsReauth?: boolean } } | undefined)
    ?.body;
  // 424 = not connected at all.
  const notConnected =
    data?.error === "youtube_not_connected" ||
    errBody?.error === "youtube_not_connected";
  // 403 = connected, but the existing token doesn't have youtube.readonly.
  // This is the case the user hit: they signed in BEFORE we added the YouTube
  // scope, so their token doesn't include it. The fix is to re-sign-in.
  const needsReauth = errBody?.needsReauth === true;

  if (needsReauth) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.04] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Icon name="youtube" className="h-5 w-5" />
            <div className="text-[13px] tracking-tight text-white">
              YouTube scope missing
            </div>
          </div>
          <p className="text-[11.5px] leading-relaxed text-amber-200/85">
            Your Core Account is connected but the token was issued before
            YouTube access was requested. Re-sign-in once and Google will
            include the new scope.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="primary"
              icon={<LogOut className="h-3.5 w-3.5" />}
              onClick={async () => {
                await signOut({ redirect: false });
                signIn("google", { callbackUrl: "/network" });
              }}
            >
              Re-authenticate
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (notConnected) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Icon name="youtube" className="h-5 w-5" />
            <div className="text-[13px] tracking-tight text-white">
              Connect YouTube
            </div>
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted">
            YouTube reuses your connected Google account — go to{" "}
            <span className="text-white">Settings → Connected Accounts</span>{" "}
            and connect (or reconnect) a Google account to grant YouTube read access.
          </p>
          <a href="/settings">
            <Button
              variant="primary"
              className="mt-3"
              icon={<Plug className="h-3.5 w-3.5" />}
            >
              Manage accounts
            </Button>
          </a>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return <div className="py-6 text-[12px] text-muted">Loading YouTube…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Profile + counts */}
      {data.channel && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-3">
          {data.channel.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.channel.thumbnail}
              alt=""
              referrerPolicy="no-referrer"
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] tracking-tight text-white">
              {data.channel.title ?? data.account?.displayName}
            </div>
            <div className="text-[10.5px] text-muted">
              {data.channel.subscribers != null && (
                <>{Number(data.channel.subscribers).toLocaleString()} subscribers</>
              )}
              {data.channel.videoCount != null && (
                <> · {Number(data.channel.videoCount).toLocaleString()} videos</>
              )}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-soft">
              {data.account?.email}
            </div>
          </div>
          {data.channel.id && (
            <a
              href={`https://www.youtube.com/channel/${data.channel.id}`}
              target="_blank"
              rel="noreferrer"
              title="Open on YouTube"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-soft hover:text-white" />
            </a>
          )}
        </div>
      )}

      {/* Recent activity from your subscriptions */}
      <div>
        <div className="mono-tag mb-2">recent activity</div>
        {data.recentActivity && data.recentActivity.length > 0 ? (
          <ul className="space-y-1.5">
            {data.recentActivity.slice(0, 8).map((a, i) => (
              <li
                key={i}
                className="group flex items-start gap-2.5 rounded-lg border border-white/[0.04] bg-white/[0.01] p-2"
              >
                <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded">
                  {a.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.thumbnail}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-white/[0.04]" />
                  )}
                  {a.videoUrl && (
                    <Play
                      className="absolute right-1 bottom-1 h-2.5 w-2.5 text-white drop-shadow"
                      strokeWidth={2}
                      fill="white"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-[11.5px] leading-snug text-white">
                    {a.title}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted">
                    {a.channelTitle}
                    {a.publishedAt && (
                      <> · {formatRelativeTime(a.publishedAt)}</>
                    )}
                  </div>
                </div>
                {a.videoUrl && (
                  <a
                    href={a.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <ExternalLink className="h-3 w-3 text-muted hover:text-white" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-[11.5px] text-muted">
            No recent activity. Subscribe to channels to see new uploads here.
          </div>
        )}
      </div>

      {/* Subscriptions strip */}
      <div>
        <div className="mono-tag mb-2">subscriptions</div>
        {data.subscriptions && data.subscriptions.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {data.subscriptions.slice(0, 12).map((s, i) => (
              <a
                key={i}
                href={`https://www.youtube.com/channel/${s.channelId}`}
                target="_blank"
                rel="noreferrer"
                title={s.title}
                className="group flex w-[72px] shrink-0 flex-col items-center gap-1"
              >
                {s.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.thumbnail}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-full object-cover ring-1 ring-white/[0.06] group-hover:ring-rose-300/40"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-white/[0.04]" />
                )}
                <div className="line-clamp-1 w-full text-center text-[10px] leading-tight text-muted">
                  {s.title}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-[11.5px] text-muted">No subscriptions visible.</div>
        )}
      </div>
    </div>
  );
}
