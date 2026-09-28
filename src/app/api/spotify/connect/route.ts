import { NextResponse } from "next/server";
import {
  spotifyConfigured,
  spotifyRedirectUri,
  newAuthState,
  SPOTIFY_SCOPES,
} from "@/lib/spotify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Localhost vs 127.0.0.1 detection lives on the CLIENT now (in ConnectSpotify
// + SpotifyPanel) — Next.js's Node runtime can report req.url's hostname
// inconsistently in dev, which caused an infinite redirect loop here on a
// previous version of this route. By the time the request reaches us we
// trust the user is on the right host.
export async function GET(req: Request) {
  if (!spotifyConfigured()) {
    return NextResponse.json(
      {
        error: "not_configured",
        hint: "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local",
      },
      { status: 503 }
    );
  }

  // Defensive sanity check using the actual Host header (which IS reliable).
  // If we somehow get hit on localhost, bail with a clear error rather than
  // start an OAuth dance whose state cookie won't survive the callback.
  const host = req.headers.get("host") ?? "";
  if (host.startsWith("localhost")) {
    const redirect = new URL("/settings", req.url);
    redirect.searchParams.set("spotify_error", "wrong_host_localhost");
    return NextResponse.redirect(redirect);
  }

  const state = newAuthState();
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: spotifyRedirectUri(),
    scope: SPOTIFY_SCOPES,
    state,
    show_dialog: "false",
  });
  return NextResponse.redirect(
    `https://accounts.spotify.com/authorize?${params.toString()}`
  );
}
