import { NextResponse } from "next/server";
import { google } from "googleapis";
import { authedClient, getAccessTokenOrThrow, NotAuthenticated } from "@/lib/google";
import type { CalendarEvent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const token = await getAccessTokenOrThrow();
    const auth = authedClient(token);
    const calendar = google.calendar({ version: "v3", auth });

    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 14);

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    });

    const events: CalendarEvent[] = (res.data.items ?? [])
      .filter((e) => e.start && (e.start.dateTime || e.start.date))
      .map((e) => ({
        id: e.id!,
        title: e.summary ?? "(untitled)",
        startsAt: e.start!.dateTime ?? e.start!.date!,
        endsAt: e.end?.dateTime ?? e.end?.date ?? e.start!.dateTime ?? e.start!.date!,
        attendees: e.attendees?.map((a) => a.displayName ?? a.email ?? "").filter(Boolean),
        location: e.hangoutLink ? `Meet · ${e.hangoutLink}` : e.location ?? "",
        meetingLink: e.hangoutLink ?? undefined,
        prepNotes: e.description
          ? e.description
              .split(/\r?\n/)
              .map((s) => s.replace(/^[•\-*]\s*/, "").trim())
              .filter(Boolean)
              .slice(0, 5)
          : undefined,
      }));

    return NextResponse.json({ events });
  } catch (e) {
    if (e instanceof NotAuthenticated) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }
    const msg = e instanceof Error ? e.message : "unknown_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
