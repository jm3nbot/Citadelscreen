import { NextResponse } from "next/server";
import { clearStoredTokens } from "@/lib/github";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Drops just the GitHub cookie. Google and Spotify sessions are untouched.
// Users can also revoke the OAuth app server-side at
// github.com/settings/applications — but this is the in-app sign-out path.
export async function POST() {
  clearStoredTokens();
  return NextResponse.json({ ok: true });
}
