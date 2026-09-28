import { NextResponse } from "next/server";
import {
  githubConfigured,
  githubRedirectUri,
  newAuthState,
  GITHUB_SCOPES,
} from "@/lib/github";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Kicks off the GitHub OAuth dance. The user lands on github.com, approves,
// and gets redirected to /api/auth/callback/github with a `code` we exchange
// for a token. The `state` cookie is verified on the callback to block CSRF.
export async function GET(req: Request) {
  if (!githubConfigured()) {
    return NextResponse.json(
      {
        error: "not_configured",
        hint: "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env.local. Register an OAuth App at https://github.com/settings/applications/new with callback http://127.0.0.1:3000/api/auth/callback/github",
      },
      { status: 503 }
    );
  }

  // Mirror Spotify's defensive host check: GitHub honours whatever callback
  // URL was registered on the OAuth App. If the user is on localhost while we
  // registered 127.0.0.1, the state cookie won't survive the callback.
  const host = req.headers.get("host") ?? "";
  if (host.startsWith("localhost")) {
    const redirect = new URL("/", req.url);
    redirect.searchParams.set("github_error", "wrong_host_localhost");
    return NextResponse.redirect(redirect);
  }

  const state = newAuthState();
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: githubRedirectUri(),
    scope: GITHUB_SCOPES,
    state,
    allow_signup: "true",
  });
  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`
  );
}
