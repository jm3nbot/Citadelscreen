import { NextResponse } from "next/server";
import { clearStoredTokens } from "@/lib/spotify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Drops just the Spotify cookie. Google session is untouched.
export async function POST() {
  clearStoredTokens();
  return NextResponse.json({ ok: true });
}
