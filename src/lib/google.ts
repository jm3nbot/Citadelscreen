import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export class NotAuthenticated extends Error {
  constructor() {
    super("not_authenticated");
  }
}

export async function getAccessTokenOrThrow(): Promise<string> {
  const session = await getServerSession(authOptions);
  // Multi-provider session: read the Google-specific access token. We keep
  // the legacy `accessToken` alias as a fallback for any older code path.
  const s = session as {
    googleAccessToken?: string;
    accessToken?: string;
  } | null;
  const token = s?.googleAccessToken ?? s?.accessToken;
  if (!token) throw new NotAuthenticated();
  return token;
}

export function authedClient(accessToken: string) {
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: accessToken });
  return oauth2;
}

export function isConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.NEXTAUTH_SECRET
  );
}
