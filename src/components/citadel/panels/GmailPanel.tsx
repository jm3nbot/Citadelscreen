"use client";

import { Button } from "@/components/ui/Button";
import { useCitadel } from "@/lib/store";
import { useGmail } from "@/lib/hooks";
import { formatRelativeTime } from "@/lib/utils";
import { BellPlus, Sparkles, RefreshCw } from "lucide-react";
import type { Email } from "@/lib/types";

export function GmailPanel() {
  const addReminder = useCitadel((s) => s.addReminder);
  const { emails, live, loading, refresh } = useGmail();
  const inboxSummary = {
    total: emails.length,
    unread: emails.filter((e) => e.unread).length,
    needsReply: emails.filter((e) => e.needsReply).length,
    highPriority: emails.filter((e) => e.priority === "high").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="mono-tag">{live ? "live · gmail" : "sample · gmail"}</span>
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
      <div className="grid grid-cols-3 gap-2">
        <Stat label="unread" value={inboxSummary.unread} />
        <Stat label="needs reply" value={inboxSummary.needsReply} />
        <Stat label="priority" value={inboxSummary.highPriority} />
      </div>

      <div className="flex gap-2">
        <Button variant="primary" icon={<Sparkles className="h-3.5 w-3.5" />}>
          Summarize inbox
        </Button>
        {emails[0] && (
          <Button
            variant="default"
            icon={<BellPlus className="h-3.5 w-3.5" />}
            onClick={() =>
              addReminder({
                title: `Reply to: ${emails[0].subject}`,
                description: `From ${emails[0].from}`,
                priority: "high",
                linkedAppId: "gmail",
                dueAt: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
              })
            }
          >
            Remind me · top email
          </Button>
        )}
      </div>

      {emails.some((e) => e.needsReply) && (
        <Section title="Needs reply">
          <ul className="space-y-1">
            {emails.filter((e) => e.needsReply).slice(0, 6).map((em) => (
              <EmailItem key={em.id} em={em} />
            ))}
          </ul>
        </Section>
      )}

      <Section title="Latest">
        {loading && emails.length === 0 ? (
          <div className="py-2 text-[11.5px] text-muted">Loading…</div>
        ) : (
          <ul className="space-y-1">
            {emails.slice(0, 6).map((em) => (
              <EmailItem key={em.id} em={em} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2.5">
      <div className="mono-tag">{label}</div>
      <div className="mt-0.5 text-[18px] font-medium tracking-tight text-white">
        {value}
      </div>
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

function EmailItem({ em }: { em: Email }) {
  return (
    <li className="group flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-white/[0.06] hover:bg-white/[0.02]">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-[10px] font-medium text-white/80">
        {em.fromInitials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[12.5px] tracking-tight text-white">
            {em.subject}
          </span>
          {em.priority === "high" && (
            <span className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-1.5 py-px text-[9px] tracking-wider text-amber-200">
              HIGH
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-muted">
          {em.from} · {em.preview}
        </div>
      </div>
      <div className="shrink-0 text-[10px] text-muted-soft">
        {formatRelativeTime(em.receivedAt)}
      </div>
    </li>
  );
}
