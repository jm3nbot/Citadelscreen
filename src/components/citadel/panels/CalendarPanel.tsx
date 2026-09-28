"use client";

import { Button } from "@/components/ui/Button";
import { useCitadel } from "@/lib/store";
import { useCalendar } from "@/lib/hooks";
import { formatTime } from "@/lib/utils";
import { CalendarClock, Sparkles, RefreshCw } from "lucide-react";

function isToday(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

export function CalendarPanel() {
  const { events, live, loading, refresh } = useCalendar();
  const today = events.filter((e) => isToday(e.startsAt));
  const next = events.find((e) => new Date(e.startsAt).getTime() > Date.now()) ?? events[0];
  const upcoming = events.filter((e) => new Date(e.startsAt).getTime() > Date.now());

  const triggerAutomation = useCitadel((s) => s.triggerAutomation);
  const automations = useCitadel((s) => s.automations);
  const dailyBrief = automations.find((a) => a.name.toLowerCase().includes("daily brief"));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="mono-tag">{live ? "live · calendar" : "sample · calendar"}</span>
        {live && (
          <button
            onClick={() => refresh()}
            className="text-muted-soft hover:text-white"
            title="Refresh"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {next && (
        <div className="rounded-xl border border-accent/15 bg-accent/[0.04] p-4">
          <div className="mono-tag flex items-center gap-1.5">
            <CalendarClock className="h-3 w-3" /> next event
          </div>
          <div className="mt-1 text-[16px] font-medium tracking-tight text-white">
            {next.title}
          </div>
          <div className="mt-0.5 text-[12px] text-muted">
            {formatTime(next.startsAt)} – {formatTime(next.endsAt)}
            {next.location && ` · ${next.location}`}
          </div>
          {next.prepNotes && next.prepNotes.length > 0 && (
            <ul className="mt-3 space-y-1">
              {next.prepNotes.map((n, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-white/85">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  <span className="truncate">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Button
        variant="primary"
        icon={<Sparkles className="h-3.5 w-3.5" />}
        onClick={() => dailyBrief && triggerAutomation(dailyBrief.id)}
      >
        Create daily brief
      </Button>

      <Section title="Today">
        {today.length === 0 && (
          <div className="text-[11.5px] text-muted">Nothing today.</div>
        )}
        <ul className="space-y-1.5">
          {today.map((ev) => (
            <li
              key={ev.id}
              className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2"
            >
              <div className="w-14 shrink-0 text-[11px] tracking-tight text-accent">
                {formatTime(ev.startsAt)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] tracking-tight text-white">
                  {ev.title}
                </div>
                {ev.location && (
                  <div className="mt-0.5 truncate text-[11px] text-muted">
                    {ev.location}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Upcoming · 14 days">
        <ul className="space-y-1.5">
          {upcoming.slice(0, 6).map((ev) => {
            const d = new Date(ev.startsAt);
            return (
              <li
                key={ev.id}
                className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2"
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
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mono-tag mb-2">{title}</div>
      {children}
    </div>
  );
}
