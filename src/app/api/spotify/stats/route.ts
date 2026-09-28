import { NextResponse } from "next/server";
import { spotifyFetch, SpotifyNotConnected } from "@/lib/spotify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TrackObj = {
  id?: string;
  name?: string;
  artists?: Array<{ name?: string }>;
  album?: { name?: string; images?: Array<{ url?: string }> };
  external_urls?: { spotify?: string };
  popularity?: number;
};

type ArtistObj = {
  id?: string;
  name?: string;
  genres?: string[];
  images?: Array<{ url?: string }>;
  external_urls?: { spotify?: string };
};

type RecentObj = {
  track?: TrackObj;
  played_at?: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  // Spotify "term" param: short_term ≈ last 4 weeks, medium_term ≈ 6 months,
  // long_term ≈ several years.
  const term = url.searchParams.get("term") ?? "short_term";
  try {
    const [topTracks, topArtists, recent, profile] = await Promise.all([
      spotifyFetch<{ items?: TrackObj[] }>(
        `/me/top/tracks?limit=10&time_range=${term}`
      ),
      spotifyFetch<{ items?: ArtistObj[] }>(
        `/me/top/artists?limit=10&time_range=${term}`
      ),
      spotifyFetch<{ items?: RecentObj[] }>(
        `/me/player/recently-played?limit=10`
      ),
      spotifyFetch<{
        display_name?: string;
        followers?: { total?: number };
        product?: string;
        external_urls?: { spotify?: string };
        images?: Array<{ url?: string }>;
      }>("/me"),
    ]);

    return NextResponse.json({
      term,
      profile: {
        displayName: profile?.display_name,
        followers: profile?.followers?.total,
        product: profile?.product,
        url: profile?.external_urls?.spotify,
        avatar: profile?.images?.[0]?.url,
      },
      topTracks:
        topTracks?.items?.map((t) => ({
          id: t.id,
          name: t.name,
          artists: t.artists?.map((a) => a.name).filter(Boolean) ?? [],
          album: t.album?.name,
          cover: t.album?.images?.[1]?.url ?? t.album?.images?.[0]?.url,
          url: t.external_urls?.spotify,
          popularity: t.popularity,
        })) ?? [],
      topArtists:
        topArtists?.items?.map((a) => ({
          id: a.id,
          name: a.name,
          genres: a.genres ?? [],
          image: a.images?.[0]?.url,
          url: a.external_urls?.spotify,
        })) ?? [],
      recent:
        recent?.items?.map((r) => ({
          playedAt: r.played_at,
          track: r.track && {
            id: r.track.id,
            name: r.track.name,
            artists: r.track.artists?.map((a) => a.name).filter(Boolean) ?? [],
            cover: r.track.album?.images?.[1]?.url,
            url: r.track.external_urls?.spotify,
          },
        })) ?? [],
    });
  } catch (e) {
    if (e instanceof SpotifyNotConnected) {
      return NextResponse.json({ error: "not_connected" }, { status: 424 });
    }
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
