"use client";

import { useState } from "react";
import useSWR from "swr";
import { Music, ExternalLink, Plug, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Term = "short_term" | "medium_term" | "long_term";

type StatsResp = {
  term?: Term;
  profile?: {
    displayName?: string;
    followers?: number;
    product?: string;
    url?: string;
    avatar?: string;
  };
  topTracks?: Array<{
    id?: string;
    name?: string;
    artists?: string[];
    cover?: string;
    url?: string;
    popularity?: number;
  }>;
  topArtists?: Array<{
    id?: string;
    name?: string;
    genres?: string[];
    image?: string;
    url?: string;
  }>;
  recent?: Array<{
    playedAt?: string;
    track?: { name?: string; artists?: string[]; cover?: string; url?: string };
  }>;
  error?: string;
};

type NowResp = {
  playing?: boolean;
  track?: { name?: string; artists?: string[]; cover?: string; url?: string; album?: string };
};

type StatusResp = {
  configured?: boolean;
  connected?: boolean;
  account?: { displayName?: string; product?: string };
};

const TERMS: Array<{ key: Term; label: string }> = [
  { key: "short_term", label: "4 wks" },
  { key: "medium_term", label: "6 mo" },
  { key: "long_term", label: "All time" },
];

export function SpotifyPanel() {
  const [term, setTerm] = useState<Term>("short_term");

  const { data: status } = useSWR<StatusResp>("/api/spotify/status");
  const connected = !!status?.connected;
  const configured = status?.configured !== false;

  const { data: now } = useSWR<NowResp>(
    connected ? "/api/spotify/now-playing" : null,
    { refreshInterval: 20_000 }
  );
  const { data: stats, isLoading } = useSWR<StatsResp>(
    connected ? `/api/spotify/stats?term=${term}` : null
  );

  // ---- Not configured ----
  if (!configured) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4">
          <Plug className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" strokeWidth={1.7} />
          <div className="text-[11.5px] leading-relaxed text-amber-200/85">
            <div className="text-white">Spotify not configured</div>
            <div>
              Add <code className="text-white">SPOTIFY_CLIENT_ID</code> and{" "}
              <code className="text-white">SPOTIFY_CLIENT_SECRET</code> to{" "}
              <code className="text-white">.env.local</code>. Set the redirect URI in your Spotify Dashboard to{" "}
              <code className="text-white">http://127.0.0.1:3000/api/auth/callback/spotify</code>.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Not connected ----
  if (!connected) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Music className="h-4 w-4 text-emerald-300" strokeWidth={1.7} />
            <div className="text-[13px] tracking-tight text-white">Connect Spotify</div>
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted">
            Connect to show what you're currently listening to in the top bar and pull your top tracks, artists, and recent plays here.
          </p>
          <a
            href="/api/spotify/connect"
            onClick={(e) => {
              // Same client-side localhost → 127.0.0.1 bounce as <ConnectSpotify>.
              // Spotify Dashboard URI is 127.0.0.1-only; cookies don't cross.
              if (
                typeof window !== "undefined" &&
                window.location.hostname === "localhost"
              ) {
                e.preventDefault();
                const next = new URL(window.location.href);
                next.hostname = "127.0.0.1";
                window.location.replace(next.toString());
              }
            }}
          >
            <Button
              variant="primary"
              className="mt-3"
              icon={<Music className="h-3.5 w-3.5" />}
            >
              Connect Spotify
            </Button>
          </a>
        </div>
      </div>
    );
  }

  // ---- Connected ----
  return (
    <div className="space-y-4">
      {/* Profile + disconnect */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.03] p-3">
        <div className="flex min-w-0 items-center gap-3">
          {stats?.profile?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stats.profile.avatar}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/[0.10]">
              <Music className="h-4 w-4 text-emerald-300" strokeWidth={1.7} />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-[13px] tracking-tight text-white">
              {stats?.profile?.displayName ?? status?.account?.displayName ?? "Connected"}
            </div>
            <div className="text-[10.5px] text-muted">
              {stats?.profile?.followers != null && (
                <>{stats.profile.followers.toLocaleString()} followers · </>
              )}
              {stats?.profile?.product?.toUpperCase() ?? status?.account?.product?.toUpperCase()}
            </div>
          </div>
        </div>
        <button
          onClick={async () => {
            await fetch("/api/spotify/disconnect", { method: "POST" });
            window.location.reload();
          }}
          title="Disconnect Spotify (Google session untouched)"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted hover:border-rose-300/30 hover:text-rose-300"
        >
          <LogOut className="h-3 w-3" strokeWidth={1.7} />
        </button>
      </div>

      {/* Now playing */}
      {now?.track?.name && (
        <div className="rounded-xl border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[0.06] to-transparent p-3">
          <div className="mono-tag mb-1.5">
            {now.playing ? "now playing" : "paused"}
          </div>
          <div className="flex items-center gap-3">
            {now.track.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={now.track.cover}
                alt=""
                className="h-12 w-12 shrink-0 rounded-md object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] text-white">{now.track.name}</div>
              <div className="truncate text-[11px] text-muted">
                {now.track.artists?.join(", ")}
                {now.track.album && (
                  <span className="text-muted-soft"> · {now.track.album}</span>
                )}
              </div>
            </div>
            {now.track.url && (
              <a href={now.track.url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5 text-muted hover:text-white" strokeWidth={1.7} />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Term selector */}
      <div className="flex gap-1.5">
        {TERMS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTerm(t.key)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[10.5px] tracking-wider uppercase transition-colors",
              term === t.key
                ? "border-accent/30 bg-accent/[0.08] text-white"
                : "border-white/[0.05] bg-white/[0.015] text-muted hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Top tracks */}
      <div>
        <div className="mono-tag mb-2">top tracks</div>
        {isLoading ? (
          <div className="text-[11.5px] text-muted">Loading…</div>
        ) : !stats?.topTracks?.length ? (
          <div className="text-[11.5px] text-muted">No data for this window.</div>
        ) : (
          <ul className="space-y-1.5">
            {stats.topTracks.slice(0, 8).map((t, i) => (
              <li
                key={t.id ?? i}
                className="group flex items-center gap-2.5 rounded-lg border border-white/[0.04] bg-white/[0.01] px-2 py-1.5"
              >
                <span className="w-5 text-right text-[10px] tabular-nums text-muted-soft">
                  {i + 1}
                </span>
                {t.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.cover}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-white">{t.name}</div>
                  <div className="truncate text-[10px] text-muted">
                    {t.artists?.join(", ")}
                  </div>
                </div>
                {t.url && (
                  <a
                    href={t.url}
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
        )}
      </div>

      {/* Top artists */}
      <div>
        <div className="mono-tag mb-2">top artists</div>
        {!stats?.topArtists?.length ? (
          <div className="text-[11.5px] text-muted">No data for this window.</div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {stats.topArtists.slice(0, 6).map((a, i) => (
              <a
                key={a.id ?? i}
                href={a.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col items-center gap-1.5 rounded-lg border border-white/[0.04] bg-white/[0.01] p-2 hover:border-white/[0.10]"
              >
                {a.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.image}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.02] text-[10px] text-muted">
                    {a.name?.[0] ?? "?"}
                  </div>
                )}
                <div className="line-clamp-1 text-center text-[10.5px] text-white">
                  {a.name}
                </div>
                {a.genres?.[0] && (
                  <div className="line-clamp-1 text-center text-[9px] text-muted-soft">
                    {a.genres[0]}
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Recently played */}
      <div>
        <div className="mono-tag mb-2">recently played</div>
        {!stats?.recent?.length ? (
          <div className="text-[11.5px] text-muted">Nothing recent.</div>
        ) : (
          <ul className="space-y-1">
            {stats.recent.slice(0, 6).map((r, i) => (
              <li
                key={i}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1"
              >
                {r.track?.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.track.cover}
                    alt=""
                    className="h-6 w-6 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11.5px] text-white">
                    {r.track?.name}
                  </div>
                  <div className="truncate text-[10px] text-muted">
                    {r.track?.artists?.join(", ")}
                  </div>
                </div>
                {r.playedAt && (
                  <div className="shrink-0 text-[9.5px] tabular-nums text-muted-soft">
                    {new Date(r.playedAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
