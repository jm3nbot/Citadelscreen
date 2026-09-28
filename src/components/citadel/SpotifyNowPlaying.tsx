"use client";

import useSWR from "swr";
import { Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCitadel } from "@/lib/store";

type NowPlayingResp = {
  playing?: boolean;
  progressMs?: number;
  durationMs?: number;
  track?: {
    id?: string;
    name?: string;
    artists?: string[];
    album?: string;
    cover?: string;
    url?: string;
  };
  error?: string;
};

// Mini equalizer — three bars bobbing on infinite-loop CSS animations. Tiny
// touch of "playing" feedback that costs nothing in JS.
function EqBars({ playing }: { playing: boolean }) {
  return (
    <div className="flex h-3 items-end gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "w-[2px] rounded-sm bg-emerald-300",
            playing && `eq-bar-${i}`
          )}
          style={{ height: playing ? undefined : "30%" }}
        />
      ))}
      <style jsx>{`
        @keyframes eq-bounce-0 {
          0%, 100% { height: 30%; }
          50%      { height: 95%; }
        }
        @keyframes eq-bounce-1 {
          0%, 100% { height: 90%; }
          50%      { height: 35%; }
        }
        @keyframes eq-bounce-2 {
          0%, 100% { height: 50%; }
          50%      { height: 80%; }
        }
        .eq-bar-0 { animation: eq-bounce-0 0.95s ease-in-out infinite; }
        .eq-bar-1 { animation: eq-bounce-1 0.7s ease-in-out infinite; }
        .eq-bar-2 { animation: eq-bounce-2 1.1s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

export function SpotifyNowPlaying() {
  // Cheap status check first — avoids polling the now-playing endpoint when
  // Spotify isn't connected. Status revalidates every 5 minutes.
  const { data: status } = useSWR<{ connected?: boolean; configured?: boolean }>(
    "/api/spotify/status",
    { refreshInterval: 300_000 }
  );
  const connected = !!status?.connected;
  const setSelectedNodeId = useCitadel((s) => s.setSelectedNodeId);
  const { data } = useSWR<NowPlayingResp>(
    connected ? "/api/spotify/now-playing" : null,
    // Poll every 20s when connected — Spotify's API rate-limits aggressive
    // polling but 20s is well within bounds.
    { refreshInterval: 20_000 }
  );

  if (!connected) return null;
  // Connected but no current track: stay invisible to keep the topbar tidy.
  if (!data || !data.track || !data.track.name) return null;

  const title = data.track.name;
  const artist = data.track.artists?.[0];
  return (
    <button
      onClick={() => setSelectedNodeId("spotify")}
      title={`${title}${artist ? ` — ${artist}` : ""}${data.track.album ? ` · ${data.track.album}` : ""} · Click for stats`}
      className="hidden items-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/[0.05] px-2 py-1 text-[11px] tracking-tight transition-colors hover:border-emerald-300/40 hover:bg-emerald-300/[0.10] lg:flex"
    >
      {data.track.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.track.cover}
          alt=""
          className="h-4 w-4 shrink-0 rounded-sm object-cover"
        />
      ) : (
        <Music className="h-3 w-3 text-emerald-300" strokeWidth={1.7} />
      )}
      <EqBars playing={!!data.playing} />
      <span className="max-w-[120px] truncate text-white">{title}</span>
      {artist && (
        <>
          <span className="text-muted-soft">·</span>
          <span className="max-w-[80px] truncate text-muted">{artist}</span>
        </>
      )}
    </button>
  );
}
