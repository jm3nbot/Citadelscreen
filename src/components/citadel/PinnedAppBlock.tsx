"use client";

import useSWR from "swr";
import {
  Music,
  Github,
  ExternalLink,
  GitPullRequest,
  GitCommit,
  Star,
  PinOff,
  Pause,
  Play,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useCitadel } from "@/lib/store";
import { sampleApps } from "@/lib/data/apps";
import { cn } from "@/lib/utils";

// Lightweight per-app dashboard widgets. Pinning an app from the Apps page
// makes one of these show up on the home dashboard. Two flavours so far:
//
//   - Specialised: Spotify (now playing), GitHub (latest push + open PR count)
//   - Generic: any other connected app gets an "open panel" tile
//
// Adding a new flavour = add a case in PinnedAppBlock + an SWR fetch.

export function PinnedAppBlock({ appId }: { appId: string }) {
  const setSelectedNodeId = useCitadel((s) => s.setSelectedNodeId);
  const togglePinApp = useCitadel((s) => s.togglePinApp);

  if (appId === "spotify") return <SpotifyMini onUnpin={() => togglePinApp(appId)} />;
  if (appId === "github") return <GitHubMini onUnpin={() => togglePinApp(appId)} />;

  // Generic — open the side panel.
  const app = sampleApps.find((a) => a.id === appId);
  return (
    <Card>
      <PinnedHeader
        icon={app?.icon ?? "AppWindow"}
        title={app?.name ?? appId}
        sub={app?.description ?? "Connected"}
        onUnpin={() => togglePinApp(appId)}
      />
      <button
        onClick={() => setSelectedNodeId(appId)}
        className="mt-3 w-full rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2 text-left text-[12px] text-muted hover:border-accent/30 hover:bg-accent/[0.04] hover:text-white"
      >
        Open {app?.name ?? appId} panel →
      </button>
    </Card>
  );
}

// ---- Specialised: Spotify ----

type SpotifyNow = {
  playing?: boolean;
  track?: {
    name?: string;
    artists?: string[];
    cover?: string;
    url?: string;
    album?: string;
  };
};

function SpotifyMini({ onUnpin }: { onUnpin: () => void }) {
  const setSelectedNodeId = useCitadel((s) => s.setSelectedNodeId);
  const { data } = useSWR<SpotifyNow>("/api/spotify/now-playing", {
    refreshInterval: 20_000,
  });

  return (
    <Card className="overflow-hidden">
      <PinnedHeader
        icon="spotify"
        title="Spotify"
        sub={data?.playing ? "Playing now" : "Paused"}
        onUnpin={onUnpin}
        accent="emerald"
        onClick={() => setSelectedNodeId("spotify")}
      />
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[0.05] to-transparent p-3">
        {data?.track?.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.track.cover}
            alt=""
            className="h-12 w-12 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-emerald-300/20 bg-emerald-300/[0.06]">
            <Music className="h-4 w-4 text-emerald-300" strokeWidth={1.7} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {data?.track?.name ? (
            <>
              <div className="flex items-center gap-1.5">
                {data.playing ? (
                  <Play className="h-2.5 w-2.5 text-emerald-300" strokeWidth={2.5} />
                ) : (
                  <Pause className="h-2.5 w-2.5 text-muted" strokeWidth={2.5} />
                )}
                <span className="truncate text-[13px] text-white">{data.track.name}</span>
              </div>
              <div className="truncate text-[11px] text-muted">
                {data.track.artists?.join(", ")}
                {data.track.album && (
                  <span className="text-muted-soft"> · {data.track.album}</span>
                )}
              </div>
            </>
          ) : (
            <div className="text-[12px] text-muted">Nothing playing right now.</div>
          )}
        </div>
        {data?.track?.url && (
          <a
            href={data.track.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-muted-soft hover:text-white"
            title="Open in Spotify"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </Card>
  );
}

// ---- Specialised: GitHub ----

type GhActivity = {
  login?: string;
  headline?: {
    kind: string;
    title: string;
    detail?: string;
    url?: string;
    at?: string;
  } | null;
};

type GhStats = {
  profile?: { login: string; name: string; avatar?: string };
  counts?: { openPrs: number; reviewRequests: number; openIssues: number };
  topRepos?: Array<{
    id: number;
    name: string;
    language: string | null;
    stars: number;
    url: string;
  }>;
};

function GitHubMini({ onUnpin }: { onUnpin: () => void }) {
  const setSelectedNodeId = useCitadel((s) => s.setSelectedNodeId);
  const { data: activity } = useSWR<GhActivity>("/api/github/activity", {
    refreshInterval: 60_000,
  });
  // Use long-term so we always have something to show on the mini even if
  // the user hasn't pushed in the last 4 weeks.
  const { data: stats } = useSWR<GhStats>("/api/github/stats?term=long_term");

  const headline = activity?.headline;
  const topRepo = stats?.topRepos?.[0];

  return (
    <Card className="overflow-hidden">
      <PinnedHeader
        icon="github"
        title="GitHub"
        sub={
          stats?.profile
            ? `@${stats.profile.login}`
            : activity?.login
            ? `@${activity.login}`
            : "Connected"
        }
        onUnpin={onUnpin}
        accent="violet"
        onClick={() => setSelectedNodeId("github")}
      />

      {/* Counts strip */}
      {stats?.counts && (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <Mini label="open PRs" value={stats.counts.openPrs} icon={<GitPullRequest className="h-2.5 w-2.5" />} />
          <Mini label="reviews" value={stats.counts.reviewRequests} icon={<GitPullRequest className="h-2.5 w-2.5" />} />
          <Mini label="issues" value={stats.counts.openIssues} icon={<GitCommit className="h-2.5 w-2.5" />} />
        </div>
      )}

      {/* Most recent push */}
      {headline && (
        <a
          href={headline.url ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block rounded-xl border border-violet-300/15 bg-gradient-to-br from-violet-300/[0.05] to-transparent p-3 hover:border-violet-300/30"
        >
          <div className="mono-tag mb-1 flex items-center gap-1.5">
            <GitCommit className="h-2.5 w-2.5" strokeWidth={2} />
            latest push
          </div>
          <div className="truncate text-[12.5px] text-white">{headline.title}</div>
          {headline.detail && (
            <div className="truncate text-[10.5px] text-muted">{headline.detail}</div>
          )}
        </a>
      )}

      {/* Top repo fallback if no headline */}
      {!headline && topRepo && (
        <a
          href={topRepo.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block rounded-xl border border-violet-300/15 bg-gradient-to-br from-violet-300/[0.05] to-transparent p-3 hover:border-violet-300/30"
        >
          <div className="mono-tag mb-1">top repo</div>
          <div className="truncate text-[12.5px] text-white">{topRepo.name}</div>
          <div className="flex items-center gap-2 text-[10.5px] text-muted">
            {topRepo.language && <span>{topRepo.language}</span>}
            <span className="flex items-center gap-0.5">
              <Star className="h-2.5 w-2.5" strokeWidth={2} />
              {topRepo.stars}
            </span>
          </div>
        </a>
      )}
    </Card>
  );
}

// ---- Shared pieces ----

function PinnedHeader({
  icon,
  title,
  sub,
  onUnpin,
  accent = "accent",
  onClick,
}: {
  icon: string;
  title: string;
  sub: string;
  onUnpin: () => void;
  accent?: "accent" | "emerald" | "violet";
  onClick?: () => void;
}) {
  const accentBorder =
    accent === "emerald"
      ? "border-emerald-300/20 bg-emerald-300/[0.04]"
      : accent === "violet"
      ? "border-violet-300/20 bg-violet-300/[0.04]"
      : "border-accent/20 bg-accent/[0.04]";
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 -m-1.5 text-left transition-colors",
          onClick && "hover:bg-white/[0.02]"
        )}
      >
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border",
            accentBorder
          )}
        >
          {icon === "spotify" ? (
            <Music className="h-3.5 w-3.5 text-emerald-200" strokeWidth={1.7} />
          ) : icon === "github" ? (
            <Github className="h-3.5 w-3.5 text-violet-200" strokeWidth={1.7} />
          ) : (
            <Icon name={icon} className="h-3.5 w-3.5 text-white/80" />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium tracking-tight text-white">
            {title}
          </div>
          <div className="truncate text-[10.5px] text-muted">{sub}</div>
        </div>
      </button>
      <button
        onClick={onUnpin}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.05] bg-white/[0.02] text-muted-soft hover:border-rose-300/30 hover:text-rose-300"
        title="Unpin from dashboard"
        aria-label="Unpin from dashboard"
      >
        <PinOff className="h-3 w-3" strokeWidth={1.7} />
      </button>
    </div>
  );
}

function Mini({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-white/[0.05] bg-white/[0.015] p-1.5">
      <div className="flex items-center gap-1 text-[8.5px] uppercase tracking-wider text-muted-soft">
        {icon}
        {label}
      </div>
      <div className="text-[14px] tabular-nums text-white">{value}</div>
    </div>
  );
}
