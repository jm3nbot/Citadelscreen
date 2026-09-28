import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listAccounts,
  getValidAccessToken,
  updateLastSynced,
} from "@/lib/account-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type UnifiedMail = {
  id: string;
  threadId?: string;
  from: string;
  fromEmail?: string;
  fromInitials: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  unread: boolean;
  starred: boolean;
  // accountId is "primary" for the NextAuth-signed-in account, or the
  // ConnectedAccount id for any account added via the multi-account flow.
  // Star/Trash mutations are currently only supported for "primary".
  source: {
    accountId: string;
    email: string;
    displayName?: string;
    picture?: string;
    isPrimary: boolean;
  };
};

export type UnifiedAccount = {
  id: string;
  email: string;
  displayName?: string;
  picture?: string;
  isPrimary: boolean;
  lastSyncedAt?: string;
};

export type AccountFetchError = {
  accountId: string;
  email: string;
  error: string;
};

function headerValue(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string
): string {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ??
    ""
  );
}

function initialsFrom(from: string): string {
  const m = from.match(/"?([^"<]+?)"?\s*<.*?>/);
  const name = (m?.[1] ?? from).trim();
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return (
    parts.map((p) => p[0]?.toUpperCase() ?? "").join("") ||
    name.slice(0, 2).toUpperCase()
  );
}

function displayName(from: string): string {
  const m = from.match(/"?([^"<]+?)"?\s*<(.*?)>/);
  return (m?.[1] ?? from).trim() || from;
}

function emailAddress(from: string): string | undefined {
  const m = from.match(/<([^>]+)>/);
  if (m?.[1]) return m[1].trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from.trim())) {
    return from.trim().toLowerCase();
  }
  return undefined;
}

async function fetchForAccount(account: {
  id: string;
  email: string;
  displayName?: string;
  picture?: string;
  isPrimary: boolean;
  accessToken: string;
}): Promise<{ messages: UnifiedMail[]; error?: string }> {
  try {
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: account.accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: 25,
      q: "in:inbox -from:me",
    });
    const ids = list.data.messages?.map((m) => m.id!).filter(Boolean) ?? [];
    if (ids.length === 0) {
      if (!account.isPrimary) await updateLastSynced(account.id);
      return { messages: [] };
    }

    // Fan out the per-message gets — Gmail rate-limits at hundreds/sec for
    // a single user so 25 in parallel is well within bounds.
    const fetched = await Promise.all(
      ids.map((id) =>
        gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        })
      )
    );

    const messages: UnifiedMail[] = fetched.map((res) => {
      const m = res.data;
      const fromRaw = headerValue(m.payload?.headers ?? undefined, "From");
      const subject = headerValue(m.payload?.headers ?? undefined, "Subject");
      const date = headerValue(m.payload?.headers ?? undefined, "Date");
      const unread = m.labelIds?.includes("UNREAD") ?? false;
      const starred = m.labelIds?.includes("STARRED") ?? false;
      return {
        id: m.id!,
        threadId: m.threadId ?? undefined,
        from: displayName(fromRaw),
        fromEmail: emailAddress(fromRaw),
        fromInitials: initialsFrom(fromRaw),
        subject: subject || "(no subject)",
        snippet: m.snippet ?? "",
        receivedAt: date
          ? new Date(date).toISOString()
          : new Date().toISOString(),
        unread,
        starred,
        source: {
          accountId: account.id,
          email: account.email,
          displayName: account.displayName,
          picture: account.picture,
          isPrimary: account.isPrimary,
        },
      };
    });

    if (!account.isPrimary) await updateLastSynced(account.id);
    return { messages };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { messages: [], error: msg };
  }
}

export async function GET() {
  // 1) Pull the NextAuth-managed primary account out of the session (if any).
  //    We pretend it's "another" account in the unified list so the UI can
  //    treat all sources uniformly.
  const session = await getServerSession(authOptions);
  const primaryToken = (session as { googleAccessToken?: string } | null)
    ?.googleAccessToken;
  const primaryUser = (session as {
    user?: { name?: string | null; email?: string | null; image?: string | null };
  } | null)?.user;

  // 2) Pull all multi-account-flow connected accounts.
  const connected = await listAccounts();

  // Materialise the merged account list. `primary` always lists FIRST so the
  // UI's account strip can render it as the lead chip.
  const accounts: UnifiedAccount[] = [];
  if (primaryToken && primaryUser?.email) {
    accounts.push({
      id: "primary",
      email: primaryUser.email,
      displayName: primaryUser.name ?? undefined,
      picture: primaryUser.image ?? undefined,
      isPrimary: true,
      lastSyncedAt: undefined,
    });
  }
  for (const a of connected) {
    accounts.push({
      id: a.id,
      email: a.email,
      displayName: a.displayName,
      picture: a.picture,
      isPrimary: false,
      lastSyncedAt: a.lastSyncedAt,
    });
  }

  if (accounts.length === 0) {
    return NextResponse.json({
      emails: [],
      errors: [],
      accounts: [],
      empty: true,
    });
  }

  // 3) Fan out across all accounts in parallel. One failure doesn't tank
  //    the others — each error surfaces alongside successful mail.
  const results = await Promise.all(
    accounts.map(async (a) => {
      let accessToken: string | null = null;
      try {
        accessToken = a.isPrimary
          ? primaryToken!
          : await getValidAccessToken(a.id);
      } catch (e) {
        return {
          accountId: a.id,
          email: a.email,
          messages: [] as UnifiedMail[],
          error: e instanceof Error ? e.message : "token_resolve_failed",
        };
      }
      const r = await fetchForAccount({
        id: a.id,
        email: a.email,
        displayName: a.displayName,
        picture: a.picture,
        isPrimary: a.isPrimary,
        accessToken,
      });
      return { ...r, accountId: a.id, email: a.email };
    })
  );

  const emails = results
    .flatMap((r) => r.messages)
    .sort(
      (a, b) =>
        new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );

  const errors: AccountFetchError[] = results
    .filter((r) => r.error)
    .map((r) => ({ accountId: r.accountId, email: r.email, error: r.error! }));

  return NextResponse.json({
    emails,
    errors,
    accounts,
    empty: false,
  });
}
