import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { upsertAccount } from "@/lib/account-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "citadel-google-multi-state";

function redirectUri(): string {
  const base = process.env.NEXTAUTH_URL ?? "http://127.0.0.1:3000";
  return `${base.replace(/\/$/, "")}/api/google-accounts/callback`;
}

// Step 2 of the OAuth dance: Google redirected here with ?code=<...>. We
// exchange the code for tokens, fetch the user's profile to know which
// account this is, then store everything encrypted on disk.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  // Always land the user on /settings — we put the connected-accounts UI in
  // a card there, and any error gets surfaced as a banner.
  const settingsUrl = new URL("/settings", req.url);

  if (errorParam) {
    settingsUrl.searchParams.set("google_account_error", errorParam);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code) {
    settingsUrl.searchParams.set("google_account_error", "missing_code");
    return NextResponse.redirect(settingsUrl);
  }

  // CSRF guard via the state cookie we set in /connect.
  const expectedState = cookies().get(STATE_COOKIE)?.value;
  cookies().delete(STATE_COOKIE);
  if (!state || !expectedState || state !== expectedState) {
    settingsUrl.searchParams.set("google_account_error", "state_mismatch");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    // 1) Exchange code → tokens.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri(),
      }),
    });
    const tokens = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenRes.ok || !tokens.access_token) {
      settingsUrl.searchParams.set(
        "google_account_error",
        `token_exchange_${tokenRes.status}_${tokens.error ?? "unknown"}`
      );
      return NextResponse.redirect(settingsUrl);
    }
    if (!tokens.refresh_token) {
      // Without offline access we can't keep this account alive past 1
      // hour. Bail with a clear error instead of silently storing a
      // doomed-to-expire account.
      settingsUrl.searchParams.set(
        "google_account_error",
        "no_refresh_token_revoke_and_retry"
      );
      return NextResponse.redirect(settingsUrl);
    }

    // 2) Fetch profile so we know which Google account this code came from.
    const profileRes = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    if (!profileRes.ok) {
      settingsUrl.searchParams.set(
        "google_account_error",
        `userinfo_${profileRes.status}`
      );
      return NextResponse.redirect(settingsUrl);
    }
    const profile = (await profileRes.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!profile.sub || !profile.email) {
      settingsUrl.searchParams.set(
        "google_account_error",
        "profile_missing_email"
      );
      return NextResponse.redirect(settingsUrl);
    }

    // 3) Persist encrypted.
    const expiresAt =
      Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 3600);
    const account = await upsertAccount({
      providerAccountId: profile.sub,
      email: profile.email,
      displayName: profile.name,
      picture: profile.picture,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
    });

    settingsUrl.searchParams.set("google_account_added", account.email);
    return NextResponse.redirect(settingsUrl);
  } catch (e) {
    settingsUrl.searchParams.set(
      "google_account_error",
      e instanceof Error ? e.message.slice(0, 80) : "exchange_failed"
    );
    return NextResponse.redirect(settingsUrl);
  }
}
