"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useCitadel } from "@/lib/store";
import { useCalendar } from "@/lib/hooks";
import { ConnectGoogle } from "@/components/citadel/ConnectGoogle";
import { formatRelativeTime, formatTime, cn } from "@/lib/utils";
import { Plus, Check, Trash2, Calendar as CalendarIcon, Bell, Quote as QuoteIcon, CheckSquare, RotateCcw, Archive } from "lucide-react";
import type { Reminder } from "@/lib/types";
import { QuoteBookModal } from "@/components/citadel/QuoteBookModal";

type Source = "personal" | "calendar";

type CombinedReminder = Reminder & { source: Source; sourceData?: { eventId?: string } };

export default function RemindersPage() {
  const reminders = useCitadel((s) => s.reminders);
  const addReminder = useCitadel((s) => s.addReminder);
  const toggleReminder = useCitadel((s) => s.toggleReminder);
  const deleteReminder = useCitadel((s) => s.deleteReminder);
  const { events, live } = useCalendar();

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [tab, setTab] = useState<"all" | "personal" | "calendar">("all");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const quotes = useCitadel((s) => s.quotes);
  const resolvedTodos = useCitadel((s) => s.resolvedTodos);
  const unresolveTodo = useCitadel((s) => s.unresolveTodo);
  const removeResolvedTodo = useCitadel((s) => s.removeResolvedTodo);
  const clearResolvedTodos = useCitadel((s) => s.clearResolvedTodos);
  // Group archived items by their list title so panel-archived lists show as
  // a single grouped block (matches the user's "panel" mental model) while
  // ad-hoc per-item resolutions show flat by recency.
  const groupedArchive = (() => {
    const sorted = [...resolvedTodos].sort(
      (a, b) =>
        new Date(b.resolvedAt).getTime() - new Date(a.resolvedAt).getTime()
    );
    const panelGroups = new Map<string, typeof sorted>();
    const loose: typeof sorted = [];
    for (const r of sorted) {
      if (r.panelArchived && r.stickerId) {
        const arr = panelGroups.get(r.stickerId) ?? [];
        arr.push(r);
        panelGroups.set(r.stickerId, arr);
      } else {
        loose.push(r);
      }
    }
    return { panelGroups, loose };
  })();

  // Hide-state for calendar-derived reminders persists in localStorage
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem("citadel-hidden-cal-reminders");
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  });
  const hide = (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        window.localStorage.setItem("citadel-hidden-cal-reminders", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  function submit() {
    if (!title.trim()) return;
    addReminder({ title: title.trim(), priority });
    setTitle("");
  }

  // Calendar-derived reminders: upcoming events within next 24h
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const calReminders: CombinedReminder[] = events
    .filter((e) => {
      const t = new Date(e.startsAt).getTime();
      return t > now && t < now + day;
    })
    .filter((e) => !hiddenIds.has(`cal-${e.id}`))
    .map((e) => ({
      id: `cal-${e.id}`,
      title: e.title,
      description: e.location
        ? `${formatTime(e.startsAt)} · ${e.location}`
        : `${formatTime(e.startsAt)}`,
      dueAt: e.startsAt,
      priority: "medium",
      complete: false,
      linkedAppId: "calendar",
      source: "calendar",
      sourceData: { eventId: e.id },
    }));

  const personal: CombinedReminder[] = reminders.map((r) => ({ ...r, source: "personal" }));

  const combined: CombinedReminder[] = [...calReminders, ...personal];
  const filtered = combined.filter((r) => tab === "all" || r.source === tab);

  const open = filtered.filter((r) => !r.complete);
  const done = filtered.filter((r) => r.complete);

  return (
    <div className="h-full overflow-auto bg-dot-grid">
      <div className="mx-auto max-w-[1100px] px-6 py-7">
        <PageHeader
          tag="reminders"
          title="Follow-ups, kept honest."
          subtitle={
            live
              ? `${calReminders.length} from Calendar today, ${personal.length} personal. Mix and match.`
              : "Personal reminders plus calendar reminders once you connect Google."
          }
          right={<ConnectGoogle compact />}
        />

        <div className="mb-5 grid grid-cols-4 gap-3">
          <Stat label="open" value={open.length} />
          <Stat label="from calendar" value={calReminders.length} />
          <Stat label="personal" value={personal.filter((r) => !r.complete).length} />
          <Stat label="done" value={done.length} />
        </div>

        {/* Resolved to-do archive — persistent. Survives sticker deletion via
            the store's `resolvedTodos` collection. Loose items vs whole
            archived panels render in distinct groups. */}
        {resolvedTodos.length > 0 && (
          <Card className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-3.5 w-3.5 text-accent" strokeWidth={1.7} />
                <span className="mono-tag">resolved to-do · archive</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10.5px] text-muted">
                  {resolvedTodos.length} item
                  {resolvedTodos.length === 1 ? "" : "s"}
                </span>
                <button
                  onClick={() => {
                    if (confirm("Clear the entire archive? This can't be undone.")) {
                      clearResolvedTodos();
                    }
                  }}
                  className="text-[10px] text-muted-soft underline-offset-4 hover:text-rose-300 hover:underline"
                >
                  Clear all
                </button>
              </div>
            </div>

            {/* Loose (per-item resolutions) */}
            {groupedArchive.loose.length > 0 && (
              <ul className="space-y-1">
                {groupedArchive.loose.slice(0, 20).map((it) => (
                  <li
                    key={it.id}
                    className="group flex items-center gap-2.5 rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2"
                  >
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-accent/40 bg-accent/[0.12]">
                      <Check className="h-2.5 w-2.5 text-accent" strokeWidth={2.8} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] text-muted line-through">
                        {it.text}
                      </div>
                      <div className="text-[10px] text-muted-soft">
                        {it.listTitle}
                        {it.sourceRemoved && (
                          <span className="ml-1 text-rose-300/70">· source removed</span>
                        )}
                        <> · resolved {formatRelativeTime(it.resolvedAt)}</>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {!it.sourceRemoved && (
                        <button
                          onClick={() => unresolveTodo(it.id)}
                          title="Re-open in source panel"
                          className="text-muted-soft hover:text-white"
                        >
                          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.7} />
                        </button>
                      )}
                      <button
                        onClick={() => removeResolvedTodo(it.id)}
                        title="Remove from archive"
                        className="text-muted-soft hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Panel-archived lists */}
            {[...groupedArchive.panelGroups.entries()].map(([stickerId, items]) => (
              <div
                key={stickerId}
                className="mt-3 rounded-lg border border-accent/15 bg-accent/[0.02] p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11.5px] text-white">
                    <Archive className="h-3 w-3 text-accent" strokeWidth={1.8} />
                    {items[0].listTitle}
                    <span className="text-[10px] text-muted">
                      · archived {formatRelativeTime(items[0].resolvedAt)}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      items.forEach((i) => removeResolvedTodo(i.id));
                    }}
                    className="text-[10px] text-muted-soft hover:text-rose-300"
                    title="Remove archived panel"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.7} />
                  </button>
                </div>
                <ul className="space-y-0.5">
                  {items.map((it) => (
                    <li
                      key={it.id}
                      className="flex items-center gap-2 text-[11.5px] text-muted line-through"
                    >
                      <Check className="h-3 w-3 text-accent" strokeWidth={2.4} />
                      {it.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Card>
        )}

        {/* Quote book entry point — opens the modal that manages the ticker. */}
        <button
          onClick={() => setQuoteOpen(true)}
          className="group mb-5 flex w-full items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4 py-3 text-left transition-all hover:border-accent/25 hover:bg-accent/[0.04] hover:shadow-glow-sm"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/[0.08] text-accent transition-colors group-hover:border-accent/45">
            <QuoteIcon className="h-4 w-4" strokeWidth={1.7} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-medium tracking-tight text-white">
                Quote book
              </span>
              <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-px text-[10px] tracking-wider text-muted">
                {quotes.length} SAVED
              </span>
            </div>
            <p className="mt-0.5 text-[11.5px] leading-snug text-muted">
              {quotes.length === 0
                ? "Add quotes you want to keep in your peripheral vision — they'll scroll along the top bar."
                : "Your quotes scroll across the top bar. Click to add, edit, or remove."}
            </p>
          </div>
          <span className="self-center text-[10px] uppercase tracking-wider text-muted-soft transition-colors group-hover:text-accent">
            Open →
          </span>
        </button>

        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              {(["all", "personal", "calendar"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[11px] tracking-tight transition-all capitalize",
                    tab === t
                      ? "border-accent/30 bg-accent/[0.06] text-white shadow-glow-sm"
                      : "border-white/[0.05] bg-white/[0.015] text-muted hover:text-white"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4 flex gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] p-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Add a personal reminder…"
              className="flex-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-white placeholder:text-muted-soft focus:border-accent/40 focus:outline-none"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as "high" | "medium" | "low")}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-[11.5px] text-white focus:border-accent/40 focus:outline-none"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <Button onClick={submit} variant="primary" icon={<Plus className="h-3.5 w-3.5" />}>
              Add
            </Button>
          </div>

          <Section title={`Open · ${open.length}`}>
            {open.length === 0 && (
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-6 text-center text-[12px] text-muted">
                Inbox zero. Nothing pending.
              </div>
            )}
            <ul className="space-y-1.5">
              {open.map((r) => (
                <li
                  key={r.id}
                  className="group flex items-start gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2"
                >
                  {r.source === "personal" ? (
                    <button
                      onClick={() => toggleReminder(r.id)}
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-white/[0.15] bg-white/[0.02] hover:border-accent/50"
                      aria-label="Mark complete"
                    >
                      <Check className="h-2.5 w-2.5 text-accent opacity-0 group-hover:opacity-50" strokeWidth={2.5} />
                    </button>
                  ) : (
                    <span
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-sky-300/30 bg-sky-300/[0.06] text-sky-300"
                      title="From Calendar"
                    >
                      <CalendarIcon className="h-2.5 w-2.5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12.5px] tracking-tight text-white">
                        {r.title}
                      </span>
                      <SourceTag source={r.source} />
                      <PrioTag p={r.priority} />
                    </div>
                    {r.description && (
                      <div className="mt-0.5 truncate text-[11px] text-muted">
                        {r.description}
                      </div>
                    )}
                    <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-muted-soft">
                      {r.dueAt && <span>due {formatRelativeTime(r.dueAt)}</span>}
                      {r.linkedAppId && <span>· {r.linkedAppId}</span>}
                    </div>
                  </div>
                  {r.source === "personal" ? (
                    <button
                      onClick={() => deleteReminder(r.id)}
                      className="text-muted-soft opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                    </button>
                  ) : (
                    <button
                      onClick={() => hide(r.id)}
                      className="text-muted-soft opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                      aria-label="Hide"
                      title="Hide this calendar reminder"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          {done.length > 0 && (
            <Section title={`Done · ${done.length}`}>
              <ul className="space-y-1">
                {done.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start gap-2.5 rounded-lg border border-white/[0.03] bg-white/[0.005] px-3 py-2 text-muted line-through"
                  >
                    <button
                      onClick={() => toggleReminder(r.id)}
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-accent/40 bg-accent/[0.12]"
                      aria-label="Reopen"
                    >
                      <Check className="h-2.5 w-2.5 text-accent" strokeWidth={2.5} />
                    </button>
                    <span className="truncate text-[12px]">{r.title}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </Card>
      </div>

      <QuoteBookModal open={quoteOpen} onClose={() => setQuoteOpen(false)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3">
      <div className="mono-tag">{label}</div>
      <div className="mt-0.5 text-[20px] font-medium tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}

function PrioTag({ p }: { p: "high" | "medium" | "low" }) {
  const color =
    p === "high"
      ? "border-rose-300/20 bg-rose-300/[0.06] text-rose-200"
      : p === "medium"
      ? "border-amber-300/20 bg-amber-300/[0.06] text-amber-200"
      : "border-white/[0.06] bg-white/[0.02] text-muted";
  return (
    <span className={cn("rounded-md border px-1.5 py-px text-[9px] tracking-wider", color)}>
      {p.toUpperCase()}
    </span>
  );
}

function SourceTag({ source }: { source: Source }) {
  if (source === "calendar")
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-sky-300/20 bg-sky-300/[0.06] px-1.5 py-px text-[9px] tracking-wider text-sky-200">
        <CalendarIcon className="h-2 w-2" /> CAL
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-px text-[9px] tracking-wider text-muted">
      <Bell className="h-2 w-2" /> ME
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mono-tag mb-2">{title}</div>
      {children}
    </div>
  );
}
