"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatTime, cn } from "@/lib/utils";
import { Sparkles, Clock, MapPin, Users, RefreshCw, ExternalLink } from "lucide-react";
import { useCitadel } from "@/lib/store";
import { useCalendar } from "@/lib/hooks";
import { ConnectGoogle } from "@/components/citadel/ConnectGoogle";
import type { CalendarEvent } from "@/lib/types";

function isToday(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

export default function CalendarPage() {
  const { events, live, loading, refresh } = useCalendar();
  const automations = useCitadel((s) => s.automations);
  const triggerAutomation = useCitadel((s) => s.triggerAutomation);
  const dailyBrief = automations.find((a) => a.name.toLowerCase().includes("daily brief"));
  const meetingPrep = automations.find((a) => a.name.toLowerCase().includes("meeting"));

  const today = useMemo(() => events.filter((e) => isToday(e.startsAt)), [events]);
  const next = useMemo(
    () => events.find((e) => new Date(e.startsAt).getTime() > Date.now()) ?? events[0],
    [events]
  );
  const upcoming = useMemo(
    () => events.filter((e) => new Date(e.startsAt).getTime() > Date.now()),
    [events]
  );

  return (
    <div className="h-full overflow-auto bg-dot-grid">
      <div className="mx-auto max-w-[1400px] px-6 py-7">
        <PageHeader
          tag={live ? "calendar · live" : "calendar · sample"}
          title="Your week, in focus."
          subtitle={
            live
              ? "Live Google Calendar — primary calendar, next 14 days."
              : "Sample calendar. Connect Google to load your real events."
          }
          right={
            <div className="flex items-center gap-2">
              <ConnectGoogle compact />
              {live && (
                <Button
                  size="sm"
                  variant="subtle"
                  icon={<RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />}
                  onClick={() => refresh()}
                >
                  Refresh
                </Button>
              )}
              <Button
                size="sm"
                variant="primary"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => dailyBrief && triggerAutomation(dailyBrief.id)}
              >
                Daily brief
              </Button>
            </div>
          }
        />

        {loading && (
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3 text-[12px] text-muted">
            Loading events…
          </div>
        )}

        <div className="grid grid-cols-12 gap-3">
          <Card className="col-span-12 lg:col-span-7">
            <div className="mono-tag mb-1">today</div>
            <h2 className="text-[15px] font-medium tracking-tight text-white">
              {today.length} event{today.length === 1 ? "" : "s"}
            </h2>
            {today.length === 0 && (
              <div className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-6 text-center text-[12px] text-muted">
                Nothing on the books today.
              </div>
            )}
            <ul className="mt-4 space-y-2">
              {today.map((ev) => (
                <EventRow key={ev.id} ev={ev} />
              ))}
            </ul>
          </Card>

          <div className="col-span-12 space-y-3 lg:col-span-5">
            {next && (
              <Card>
                <div className="mono-tag">next event</div>
                <h3 className="mt-1 text-[15px] font-medium tracking-tight text-white">
                  {next.title}
                </h3>
                <div className="mt-1 text-[12px] text-muted">
                  {formatTime(next.startsAt)} – {formatTime(next.endsAt)}
                  {next.location && ` · ${next.location}`}
                </div>
                <Button
                  variant="primary"
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  className="mt-3"
                  onClick={() => meetingPrep && triggerAutomation(meetingPrep.id)}
                >
                  Prepare meeting notes
                </Button>
              </Card>
            )}

            <Card>
              <div className="mono-tag mb-2">upcoming · 14 days</div>
              {upcoming.length === 0 && (
                <div className="text-[12px] text-muted">Nothing upcoming.</div>
              )}
              <ul className="space-y-1.5">
                {upcoming.slice(0, 8).map((ev) => {
                  const d = new Date(ev.startsAt);
                  return (
                    <li
                      key={ev.id}
                      className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2"
                    >
                      <div className="w-14 shrink-0 text-[11px] tracking-tight text-muted">
                        {d.toLocaleDateString([], { month: "short", day: "numeric" })}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] tracking-tight text-white">
                          {ev.title}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-muted">
                          {formatTime(ev.startsAt)}
                          {ev.location && ` · ${ev.location}`}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventRow({ ev }: { ev: CalendarEvent }) {
  return (
    <li className="flex items-start gap-4 rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3">
      <div className="w-16 shrink-0 text-[12px] tracking-tight text-accent">
        {formatTime(ev.startsAt)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-[13px] tracking-tight text-white">
            {ev.title}
          </div>
          {ev.meetingLink && (
            <a
              href={ev.meetingLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-accent/20 bg-accent/[0.06] px-1.5 py-px text-[10px] text-accent hover:bg-accent/[0.12]"
            >
              <ExternalLink className="h-2.5 w-2.5" /> join
            </a>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {formatTime(ev.startsAt)} – {formatTime(ev.endsAt)}
          </span>
          {ev.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {ev.location}
            </span>
          )}
          {ev.attendees && ev.attendees.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {ev.attendees.length}
            </span>
          )}
        </div>
        {ev.prepNotes && ev.prepNotes.length > 0 && (
          <ul className="mt-2 space-y-1">
            {ev.prepNotes.map((n, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] text-white/80">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-accent" />
                <span className="truncate">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
