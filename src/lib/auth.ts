import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// NextAuth manages ONLY Google now. Spotify lives in its own cookie-based
// flow (src/lib/spotify.ts + /api/auth/callback/spotify) because NextAuth's
// JWT strategy without a database adapter cannot link two providers — a
// second sign-in resets the JWT and wipes the first provider's tokens.
// Keeping the two flows independent means they never trample each other.

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  // gmail.modify covers read + label mutations + trash (needed for Star/Bin).
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  // YouTube read-only: subscriptions, recent uploads, channel info. Added
  // here so the primary Core Account is feature-parity with the multi-
  // account flow — no need to "Add Account" yourself just to enable YT.
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

// ---- Refresh helpers ---------------------------------------------------

async function refreshGoogleAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "google_refresh_failed");
  return {
    accessToken: data.access_token as string,
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in as number),
    refreshToken: (data.refresh_token as string | undefined) ?? refreshToken,
  };
}

// JWT shape — Google-only. Spotify state lives in a separate cookie.
type CitadelJwt = {
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleExpiresAt?: number;
  googleError?: string;
  [key: string]: unknown;
};

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      const t = token as CitadelJwt;
      if (account?.provider === "google") {
        t.googleAccessToken = account.access_token;
        t.googleRefreshToken =
          account.refresh_token ?? t.googleRefreshToken;
        t.googleExpiresAt =
          account.expires_at ?? Math.floor(Date.now() / 1000) + 3600;
        t.googleError = undefined;
        return t;
      }
      // Refresh Google when near expiry.
      if (t.googleAccessToken && t.googleExpiresAt) {
        if (Date.now() / 1000 >= t.googleExpiresAt - 60) {
          if (!t.googleRefreshToken) {
            t.googleError = "NoRefreshToken";
          } else {
            try {
              const r = await refreshGoogleAccessToken(t.googleRefreshToken);
              t.googleAccessToken = r.accessToken;
              t.googleExpiresAt = r.expiresAt;
              t.googleRefreshToken = r.refreshToken;
              t.googleError = undefined;
            } catch {
              t.googleError = "RefreshAccessTokenError";
            }
          }
        }
      }
      return t;
    },
    async session({ session, token }) {
      const t = token as CitadelJwt;
      const s = session as typeof session & {
        googleAccessToken?: string;
        googleConnected?: boolean;
        googleError?: string;
        accessToken?: string;
        error?: string;
      };
      s.googleAccessToken = t.googleAccessToken;
      s.googleConnected = Boolean(t.googleAccessToken);
      s.googleError = t.googleError;
      // Back-compat aliases.
      s.accessToken = t.googleAccessToken;
      s.error = t.googleError;
      return s;
    },
  },
};
