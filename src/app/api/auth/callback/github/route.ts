import { NextResponse } from "next/server";
import { exchangeCode, storeTokens, verifyAuthState } from "@/lib/github";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Same precedence note as the Spotify callback: this file-system route beats
// NextAuth's catch-all at /api/auth/[...nextauth], which is what lets us own
// /api/auth/callback/github without going through NextAuth's JWT strategy
// (which would wipe the Google session).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const home = new URL("/", req.url);

  if (error) {
    home.searchParams.set("github_error", error);
    return NextResponse.redirect(home);
  }
  if (!code) {
    home.searchParams.set("github_error", "missing_code");
    return NextResponse.redirect(home);
  }
  if (!verifyAuthState(state)) {
    home.searchParams.set("github_error", "state_mismatch");
    return NextResponse.redirect(home);
  }
  try {
    const bundle = await exchangeCode(code);
    storeTokens(bundle);
    home.searchParams.set("github", "connected");
    return NextResponse.redirect(home);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "exchange_failed";
    home.searchParams.set("github_error", msg.slice(0, 60));
    return NextResponse.redirect(home);
  }
}
