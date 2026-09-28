import { spotifyFetch, SpotifyNotConnected } from "@/lib/spotify";

// Compact Spotify context for prompt injection. Pulls the now-playing track
// plus a tiny slice of top tracks/artists so the model can answer "what am I
// listening to" + "what's my taste lately" without exhausting the context
// window. Returns null when Spotify isn't connected — caller surfaces that
// to the user as "connect Spotify first" if their question depended on it.

type NowPlaying = {
  is_playing?: boolean;
  item?: {
    name?: string;
    artists?: Array<{ name?: string }>;
    album?: { name?: string };
  };
};
type TopItems<T> = { items?: T[] };
type TopTrack = {
  name?: string;
  artists?: Array<{ name?: string }>;
};
type TopArtist = { name?: string; genres?: string[] };

export async function fetchSpotifyContext(): Promise<string | null> {
  try {
    const [np, tracks, artists] = await Promise.all([
      spotifyFetch<NowPlaying>("/me/player/currently-playing"),
      spotifyFetch<TopItems<TopTrack>>("/me/top/tracks?limit=5&time_range=short_term"),
      spotifyFetch<TopItems<TopArtist>>(
        "/me/top/artists?limit=5&time_range=short_term"
      ),
    ]);

    const lines: string[] = [];
    if (np?.item) {
      const artistList = (np.item.artists ?? [])
        .map((a) => a.name)
        .filter(Boolean)
        .join(", ");
      lines.push(
        `now_playing: ${np.is_playing ? "PLAYING" : "PAUSED"} — ${np.item.name}${
          artistList ? ` by ${artistList}` : ""
        }${np.item.album?.name ? ` (${np.item.album.name})` : ""}`
      );
    } else {
      lines.push("now_playing: nothing currently playing");
    }
    if (tracks?.items?.length) {
      lines.push(
        `top_tracks_4wks: ${tracks.items
          .map((t) => `${t.name} — ${t.artists?.[0]?.name ?? "?"}`)
          .join(" | ")}`
      );
    }
    if (artists?.items?.length) {
      lines.push(
        `top_artists_4wks: ${artists.items
          .map(
            (a) => `${a.name}${a.genres?.[0] ? ` [${a.genres[0]}]` : ""}`
          )
          .join(" | ")}`
      );
    }
    return `<SPOTIFY_CONTEXT>\n${lines.join("\n")}\n</SPOTIFY_CONTEXT>`;
  } catch (e) {
    if (e instanceof SpotifyNotConnected) return null;
    // Network error etc — don't block the whole prompt over this.
    return null;
  }
}
