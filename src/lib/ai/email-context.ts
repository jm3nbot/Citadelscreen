import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listAccounts, getValidAccessToken } from "@/lib/account-store";

// Server-only helper that mirrors what /api/unified-mail does, but returns
// data shaped to fit inside an LLM prompt — short, plain, no React-Flow-
// specific fields. The AI assistant route imports this and threads the
// result into the system prompt before calling Gemini.
//
// IMPORTANT: nothing here returns the access tokens themselves. Only the
// resulting email metadata leaves this module.

export type EmailContext = {
  id: string;
  subject: string;
  from: string;
  fromEmail?: string;
  date: string; // ISO
  snippet: string;
  sourceAccountEmail: string;
  unread: boolean;
  starred: boolean;
};

function header(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string
): string {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ??
    ""
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

type AccountSource = { email: string; accessToken: string };

async function resolveAccountTokens(): Promise<AccountSource[]> {
  const sources: AccountSource[] = [];
  // 1) NextAuth primary, if present.
  const session = await getServerSession(authOptions);
  const sess = session as
    | { googleAccessToken?: string; user?: { email?: string } }
    | null;
  if (sess?.googleAccessToken && sess?.user?.email) {
    sources.push({
      email: sess.user.email,
      accessToken: sess.googleAccessToken,
    });
  }
  // 2) Every multi-account flow account.
  const accounts = await listAccounts();
  for (const a of accounts) {
    try {
      const accessToken = await getValidAccessToken(a.id);
      sources.push({ email: a.email, accessToken });
    } catch {
      // Skip accounts whose refresh failed — they'll show up as errors in
      // the unified-mail UI separately. Don't fail the whole AI request
      // just because one stored account went stale.
    }
  }
  return sources;
}

async function fetchFromAccount(
  source: AccountSource,
  maxResults: number
): Promise<EmailContext[]> {
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: source.accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q: "in:inbox -from:me",
  });
  const ids = list.data.messages?.map((m) => m.id!).filter(Boolean) ?? [];
  if (ids.length === 0) return [];

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

  return fetched.map((r) => {
    const m = r.data;
    const fromRaw = header(m.payload?.headers ?? undefined, "From");
    const subject = header(m.payload?.headers ?? undefined, "Subject");
    const date = header(m.payload?.headers ?? undefined, "Date");
    return {
      id: m.id!,
      subject: subject || "(no subject)",
      from: displayName(fromRaw),
      fromEmail: emailAddress(fromRaw),
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      snippet: m.snippet ?? "",
      sourceAccountEmail: source.email,
      unread: m.labelIds?.includes("UNREAD") ?? false,
      starred: m.labelIds?.includes("STARRED") ?? false,
    };
  });
}

// Cap how many emails ever reach the LLM so a noisy inbox can't blow our
// token budget. The cap covers ALL accounts combined.
const MAX_EMAILS_TOTAL = 20;
const PER_ACCOUNT_FETCH = 12;

export async function fetchRecentEmailContext(): Promise<{
  emails: EmailContext[];
  accountCount: number;
}> {
  const sources = await resolveAccountTokens();
  if (sources.length === 0) {
    return { emails: [], accountCount: 0 };
  }
  const perAccount = await Promise.all(
    sources.map((s) => fetchFromAccount(s, PER_ACCOUNT_FETCH).catch(() => []))
  );
  const merged = perAccount
    .flat()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, MAX_EMAILS_TOTAL);
  return { emails: merged, accountCount: sources.length };
}

// Format the email batch as a compact plain-text block suitable for
// injection into a Gemini prompt. Bracket-style delimiters help the model
// treat it as data, not instructions.
export function formatEmailContextForPrompt(emails: EmailContext[]): string {
  if (emails.length === 0) return "";
  const lines = emails.map((e, i) => {
    const flags = [
      e.unread ? "UNREAD" : null,
      e.starred ? "STARRED" : null,
    ]
      .filter(Boolean)
      .join(",");
    return [
      `[${i + 1}]`,
      `to:${e.sourceAccountEmail}`,
      `from:${e.from}${e.fromEmail ? ` <${e.fromEmail}>` : ""}`,
      `date:${e.date}`,
      `subject:${e.subject}`,
      flags ? `flags:${flags}` : null,
      `snippet:${e.snippet.slice(0, 240)}`,
    ]
      .filter(Boolean)
      .join(" | ");
  });
  return `<EMAIL_CONTEXT count=${emails.length}>\n${lines.join("\n")}\n</EMAIL_CONTEXT>`;
}
