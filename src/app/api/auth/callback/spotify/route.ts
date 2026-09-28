import { NextResponse } from "next/server";
import { exchangeCode, storeTokens, verifyAuthState } from "@/lib/spotify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// IMPORTANT: this file-system route at /api/auth/callback/spotify takes
// precedence over NextAuth's catch-all at /api/auth/[...nextauth]. That's
// what lets us own the path the Spotify Dashboard already has registered
// (it had to be the NextAuth-style path because the user already set it up
// there) WITHOUT going through NextAuth — which is critical, because
// NextAuth's JWT strategy would otherwise wipe the Google session.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const home = new URL("/settings", req.url);

  if (error) {
    home.searchParams.set("spotify_error", error);
    return NextResponse.redirect(home);
  }
  if (!code) {
    home.searchParams.set("spotify_error", "missing_code");
    return NextResponse.redirect(home);
  }
  if (!verifyAuthState(state)) {
    home.searchParams.set("spotify_error", "state_mismatch");
    return NextResponse.redirect(home);
  }
  try {
    const bundle = await exchangeCode(code);
    storeTokens(bundle);
    home.searchParams.set("spotify", "connected");
    return NextResponse.redirect(home);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "exchange_failed";
    home.searchParams.set("spotify_error", msg.slice(0, 60));
    return NextResponse.redirect(home);
  }
}
