import { NextResponse } from "next/server";
import { google } from "googleapis";
import { authedClient, getAccessTokenOrThrow, NotAuthenticated } from "@/lib/google";
import type { Email } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function header(headers: { name?: string | null; value?: string | null }[] | undefined, name: string) {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ""
  );
}

function initials(from: string) {
  const m = from.match(/"?([^"<]+?)"?\s*<.*?>/);
  const name = (m?.[1] ?? from).trim();
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || name.slice(0, 2).toUpperCase();
}

function displayName(from: string) {
  const m = from.match(/"?([^"<]+?)"?\s*<(.*?)>/);
  return (m?.[1] ?? from).trim() || from;
}

// Strip the email portion out of a `Name <addr@host>` header value.
function emailAddress(from: string): string | undefined {
  const m = from.match(/<([^>]+)>/);
  if (m?.[1]) return m[1].trim().toLowerCase();
  // Some senders just include a bare address with no angle brackets.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from.trim())) return from.trim().toLowerCase();
  return undefined;
}

export async function GET(req: Request) {
  try {
    const token = await getAccessTokenOrThrow();
    const auth = authedClient(token);
    const gmail = google.gmail({ version: "v1", auth });

    // Allow override via ?q=... for debugging.
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "in:inbox";

    // Pull a broader slice of the inbox. We sort unread first below so "New"
    // messages are prominent. Note: do NOT add `-from:me` — Gmail can treat
    // "me" oddly in combination with `in:inbox` and silently zero out results
    // when the account uses aliases.
    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: 30,
      q,
    });
    const ids = list.data.messages?.map((m) => m.id!).filter(Boolean) ?? [];

    if (ids.length === 0) {
      // Probe the profile so callers can see whether the token is valid even
      // when the inbox is empty (helps distinguish "no mail" from "no scope").
      let profileEmail: string | undefined;
      try {
        const profile = await gmail.users.getProfile({ userId: "me" });
        profileEmail = profile.data.emailAddress ?? undefined;
      } catch {}
      return NextResponse.json({
        emails: [],
        meta: { profileEmail, query: q, resultSizeEstimate: list.data.resultSizeEstimate ?? 0 },
      });
    }

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

    const emails: Email[] = fetched.map((res) => {
      const m = res.data;
      const fromRaw = header(m.payload?.headers ?? undefined, "From");
      const subject = header(m.payload?.headers ?? undefined, "Subject");
      const date = header(m.payload?.headers ?? undefined, "Date");
      const unread = m.labelIds?.includes("UNREAD") ?? false;
      const important = m.labelIds?.includes("IMPORTANT") ?? false;
      const starred = m.labelIds?.includes("STARRED") ?? false;
      return {
        id: m.id!,
        from: displayName(fromRaw),
        fromEmail: emailAddress(fromRaw),
        fromInitials: initials(fromRaw),
        subject: subject || "(no subject)",
        preview: m.snippet ?? "",
        receivedAt: date ? new Date(date).toISOString() : new Date().toISOString(),
        unread,
        starred,
        priority: starred || important ? "high" : "normal",
        needsReply: unread && (important || starred),
        tags: [],
      };
    });

    // Unread first (newest within each group)
    emails.sort((a, b) => {
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    });
    return NextResponse.json({ emails });
  } catch (e) {
    if (e instanceof NotAuthenticated) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }
    // Surface real Google API errors so the UI can show something actionable.
    const err = e as {
      message?: string;
      code?: number;
      errors?: Array<{ message?: string; reason?: string }>;
    };
    const code = err.code;
    const reason = err.errors?.[0]?.reason;
    const msg =
      err.errors?.[0]?.message ?? err.message ?? "unknown_error";
    console.error("[/api/gmail] failure:", { code, reason, msg, raw: e });

    // Classify the failure so the UI can show the right remedy. The two common
    // 403s look identical at first glance but have *opposite* fixes:
    //   - accessNotConfigured / SERVICE_DISABLED → Gmail API is disabled in
    //     the Google Cloud project. Fix is in Console, NOT re-auth.
    //   - insufficientPermissions / forbidden scope → token doesn't have
    //     gmail.readonly. Fix is sign-out + sign-in.
    const apiDisabled =
      reason === "accessNotConfigured" ||
      reason === "SERVICE_DISABLED" ||
      /has not been used in project/i.test(msg);
    const needsReauth =
      !apiDisabled && (reason === "insufficientPermissions" || code === 401);

    // Try to extract the Cloud project number from Google's message — they
    // include it like: "...project 123456789012 before..."
    const projectMatch = msg.match(/project\s+(\d{6,})/i);
    const projectId = projectMatch?.[1];

    return NextResponse.json(
      { error: msg, code, reason, needsReauth, apiDisabled, projectId },
      { status: code ?? 500 }
    );
  }
}
