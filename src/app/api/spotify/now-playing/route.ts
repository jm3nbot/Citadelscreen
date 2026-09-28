import { NextResponse } from "next/server";
import { spotifyFetch, SpotifyNotConnected } from "@/lib/spotify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CurrentlyPlaying = {
  is_playing?: boolean;
  progress_ms?: number;
  item?: {
    id?: string;
    name?: string;
    duration_ms?: number;
    external_urls?: { spotify?: string };
    artists?: Array<{ name?: string }>;
    album?: {
      name?: string;
      images?: Array<{ url?: string; width?: number; height?: number }>;
    };
  };
};

export async function GET() {
  try {
    const j = await spotifyFetch<CurrentlyPlaying>(
      "/me/player/currently-playing"
    );
    // Nothing playing (204 → null) — return an explicit shape so the UI can
    // render the "not playing" state without ambiguity vs not-connected.
    if (!j || !j.item) {
      return NextResponse.json({ playing: false });
    }
    const item = j.item;
    return NextResponse.json({
      playing: !!j.is_playing,
      progressMs: j.progress_ms,
      durationMs: item.duration_ms,
      track: {
        id: item.id,
        name: item.name,
        url: item.external_urls?.spotify,
        artists: item.artists?.map((a) => a.name).filter(Boolean) ?? [],
        album: item.album?.name,
        // Pick the medium image (usually index 1 — 300x300) for the chip.
        cover: item.album?.images?.[1]?.url ?? item.album?.images?.[0]?.url,
      },
    });
  } catch (e) {
    if (e instanceof SpotifyNotConnected) {
      return NextResponse.json({ error: "not_connected" }, { status: 424 });
    }
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
