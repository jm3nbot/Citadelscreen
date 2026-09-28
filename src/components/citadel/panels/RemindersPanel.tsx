"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useCitadel } from "@/lib/store";
import { formatRelativeTime } from "@/lib/utils";
import { Plus, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function RemindersPanel() {
  const reminders = useCitadel((s) => s.reminders);
  const addReminder = useCitadel((s) => s.addReminder);
  const toggleReminder = useCitadel((s) => s.toggleReminder);
  const deleteReminder = useCitadel((s) => s.deleteReminder);

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");

  const open = reminders.filter((r) => !r.complete);
  const done = reminders.filter((r) => r.complete);

  function submit() {
    if (!title.trim()) return;
    addReminder({ title: title.trim(), priority });
    setTitle("");
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Add a reminder…"
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
      </div>

      <Section title={`Open · ${open.length}`}>
        <ul className="space-y-1.5">
          {open.map((r) => (
            <li
              key={r.id}
              className="group flex items-start gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2"
            >
              <button
                onClick={() => toggleReminder(r.id)}
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-white/[0.15] bg-white/[0.02] hover:border-accent/50"
                aria-label="Mark complete"
              >
                <Check className="h-2.5 w-2.5 text-accent opacity-0 group-hover:opacity-50" strokeWidth={2.5} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[12.5px] tracking-tight text-white">
                    {r.title}
                  </span>
                  <PrioTag p={r.priority} />
                </div>
                {r.description && (
                  <div className="mt-0.5 truncate text-[11px] text-muted">{r.description}</div>
                )}
                <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-muted-soft">
                  {r.dueAt && <span>due {formatRelativeTime(r.dueAt)}</span>}
                  {r.linkedAppId && <span>· {r.linkedAppId}</span>}
                </div>
              </div>
              <button
                onClick={() => deleteReminder(r.id)}
                className="text-muted-soft opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
              </button>
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
    </div>
  );
}

function PrioTag({ p }: { p: "high" | "medium" | "low" }) {
  const color = p === "high"
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mono-tag mb-2">{title}</div>
      {children}
    </div>
  );
}
