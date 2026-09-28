import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "citadel-google-multi-state";

// Scopes for additional connected Google accounts. Read-only Gmail is the
// minimum for the unified inbox; the rest mirror what NextAuth's main flow
// requests so the connected account is feature-parity with the primary.
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  // YouTube read-only — surfaces subscriptions, recent activity, channel info.
  // Reuses the same connected-Google account so users don't need to OAuth twice.
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

function redirectUri(): string {
  const base = process.env.NEXTAUTH_URL ?? "http://127.0.0.1:3000";
  return `${base.replace(/\/$/, "")}/api/google-accounts/callback`;
}

export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "google_not_configured" },
      { status: 503 }
    );
  }
  const state = randomBytes(16).toString("hex");
  cookies().set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    state,
    // `offline` gets us a refresh_token so we can fetch mail without the
    // user re-consenting every hour.
    access_type: "offline",
    // `select_account` lets the user choose which Google account to add —
    // otherwise Google auto-picks the last signed-in one, defeating the
    // whole point of "add a different account".
    prompt: "select_account consent",
    include_granted_scopes: "true",
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}

