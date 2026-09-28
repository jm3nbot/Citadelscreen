"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mail,
  Calendar,
  Bell,
  Workflow,
  Sparkles,
  AppWindow,
  Sun,
  Zap,
  ArrowUpRight,
  Clock,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { sampleApps } from "@/lib/data/apps";
import { useCitadel } from "@/lib/store";
import { useGmail, useCalendar } from "@/lib/hooks";
import { formatRelativeTime, formatTime } from "@/lib/utils";
import { NodeVisibilityMenu } from "./NodeVisibilityMenu";
import { AiAssistantCard } from "./AiAssistantCard";
import { PinnedAppBlock } from "./PinnedAppBlock";
import { brandChip } from "@/lib/brand";
import { cn } from "@/lib/utils";

function isToday(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

export function DashboardMode() {
  const reminders = useCitadel((s) => s.reminders);
  const automations = useCitadel((s) => s.automations);
  const features = useCitadel((s) => s.prefs.features);
  const setSelectedNodeId = useCitadel((s) => s.setSelectedNodeId);
  const triggerAutomationRaw = useCitadel((s) => s.triggerAutomation);
  const triggerAutomation = (id?: string) => id && triggerAutomationRaw(id);

  const { emails } = useGmail();
  const { events } = useCalendar();
  const hiddenNodes = useCitadel((s) => s.hiddenNodes);
  const pinnedApps = useCitadel((s) => s.pinnedApps);

  const today = events.filter((e) => isToday(e.startsAt));
  const next = events.find((e) => new Date(e.startsAt).getTime() > Date.now()) ?? events[0];
  const openReminders = reminders.filter((r) => !r.complete);
  const connectedApps = sampleApps
    .filter((a) => a.status === "connected" && !hiddenNodes[a.id])
    .slice(0, 10);

  const inboxSummary = {
    total: emails.length,
    unread: emails.filter((e) => e.unread).length,
    needsReply: emails.filter((e) => e.needsReply).length,
    highPriority: emails.filter((e) => e.priority === "high").length,
  };

  // Personalised greeting. Time-of-day picked from local hour to feel less
  // robotic than always "Good morning."
  const operatorName = useCitadel((s) => s.prefs.operatorName);
  const hour = new Date().getHours();
  const greeting =
    hour < 5
      ? "Still up"
      : hour < 12
      ? "Good morning"
      : hour < 17
      ? "Good afternoon"
      : hour < 21
      ? "Good evening"
      : "Good night";

  return (
    <div className="relative h-full overflow-auto bg-dot-grid">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-[1500px] px-6 py-7"
      >
        <motion.div variants={fadeUp} className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="mono-tag">citadel · dashboard</div>
            <h1 className="mt-1 text-[28px] font-medium tracking-tight text-white">
              {greeting}, Operator{operatorName ? ` ${operatorName}` : ""}.
            </h1>
            <p className="mt-1 text-[13px] text-muted">
              One screen for everything you run. Today: {today.length} event{today.length === 1 ? "" : "s"},{" "}
              {inboxSummary.needsReply} thread{inboxSummary.needsReply === 1 ? "" : "s"} to reply, {openReminders.length} reminder{openReminders.length === 1 ? "" : "s"} open.
            </p>
          </div>
          <NodeVisibilityMenu />
        </motion.div>

        {/* AI Assistant — full-width hero strip above the rest of the
            dashboard. Black panel + animated core, sets the "command module"
            tone for the page. */}
        <motion.div variants={fadeUp} className="mb-4">
          <AiAssistantCard />
        </motion.div>

        <div className="grid grid-cols-12 gap-4">
          {/* Daily Brief — span 8 */}
          <motion.div variants={fadeUp} className="col-span-12 lg:col-span-8">
            <Card className="overflow-hidden">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mono-tag mb-1">daily brief</div>
                  <h2 className="text-[18px] font-medium tracking-tight text-white">
                    Your day, distilled.
                  </h2>
                  <p className="mt-1 text-[12.5px] text-muted">
                    Generated 12 minutes ago · synced from Gmail, Calendar, n8n.
                  </p>
                </div>
                <Button variant="primary" icon={<Sparkles className="h-3.5 w-3.5" />}>
                  Regenerate
                </Button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <BriefStat
                  label="next event"
                  value={next?.title ?? "Nothing scheduled"}
                  sub={next ? formatTime(next.startsAt) : "—"}
                  icon={<Calendar className="h-3.5 w-3.5 text-sky-200" />}
                />
                <BriefStat
                  label="priority threads"
                  value={`${inboxSummary.highPriority}`}
                  sub={`${inboxSummary.needsReply} need a reply`}
                  icon={<Mail className="h-3.5 w-3.5 text-amber-200" />}
                />
                <BriefStat
                  label="reminders due"
                  value={`${openReminders.length}`}
                  sub="next: 2h"
                  icon={<Bell className="h-3.5 w-3.5 text-rose-200" />}
                />
              </div>

              {/* Brief bullets pulled live from inbox + reminders + calendar.
                  No hardcoded sample lines — empty state instructs the user
                  to wire up data sources. */}
              <ul className="mt-5 space-y-2 border-t border-white/[0.04] pt-4">
                {emails.slice(0, 3).map((e) => (
                  <BriefBullet key={`email-${e.id}`}>
                    <span className="text-white">{e.from}:</span>{" "}
                    <span className="text-muted">{e.subject}</span>
                  </BriefBullet>
                ))}
                {today.slice(0, 2).map((ev) => (
                  <BriefBullet key={`cal-${ev.id}`}>
                    <span className="text-white">{ev.title}</span>{" "}
                    <span className="text-muted">at {formatTime(ev.startsAt)}</span>
                  </BriefBullet>
                ))}
                {openReminders.slice(0, 2).map((r) => (
                  <BriefBullet key={`rem-${r.id}`}>
                    <span className="text-white">{r.title}</span>
                    {r.description ? (
                      <span className="text-muted"> — {r.description}</span>
                    ) : null}
                  </BriefBullet>
                ))}
                {emails.length === 0 &&
                  today.length === 0 &&
                  openReminders.length === 0 && (
                    <li className="text-[12px] text-muted">
                      Nothing on the wire. Connect Google in Settings to pull
                      mail + calendar into the brief.
                    </li>
                  )}
              </ul>
            </Card>
          </motion.div>

          {/* Right rail of row 1 — Quick Actions stacked above AI Tools.
              Together they fill the full height of the Daily Brief card on
              the left so there's no awkward empty space below either one. */}
          <motion.div variants={fadeUp} className="col-span-12 flex flex-col gap-4 lg:col-span-4">
            <Card>
              <div className="mono-tag mb-1">quick actions</div>
              <h2 className="text-[15px] font-medium tracking-tight text-white">
                One-tap commands
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <QuickAction icon={<Zap className="h-3.5 w-3.5" />} label="Trigger daily brief" onClick={() => triggerAutomation(automations[1]?.id)} />
                <QuickAction icon={<Mail className="h-3.5 w-3.5" />} label="Summarize inbox" onClick={() => triggerAutomation(automations[0]?.id)} />
                <QuickAction icon={<Calendar className="h-3.5 w-3.5" />} label="Prep next meeting" onClick={() => triggerAutomation(automations[5]?.id)} />
                <QuickAction icon={<Workflow className="h-3.5 w-3.5" />} label="Weekly report" onClick={() => triggerAutomation(automations[2]?.id)} />
              </div>
            </Card>

            {/* AI Tools — moved up from row 3. Keeps the right rail dense. */}
            {features.aiTools && (
              <Card className="flex-1">
                <div className="mono-tag mb-1">ai tools</div>
                <h3 className="text-[14px] font-medium tracking-tight text-white">
                  Connected models
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <AiTile
                    icon={<Sparkles className="h-3.5 w-3.5 text-fuchsia-200" />}
                    name="ChatGPT"
                    sub="Conversational"
                    onClick={() => setSelectedNodeId("chatgpt")}
                  />
                  <AiTile
                    icon={<Sparkles className="h-3.5 w-3.5 text-accent" />}
                    name="Claude"
                    sub="Long-context"
                    onClick={() => setSelectedNodeId("claude")}
                  />
                  <AiTile
                    icon={<Workflow className="h-3.5 w-3.5 text-emerald-200" />}
                    name="n8n"
                    sub="6 workflows"
                    onClick={() => setSelectedNodeId("n8n")}
                  />
                  <AiTile
                    icon={<Sun className="h-3.5 w-3.5 text-amber-200" />}
                    name="Daily Brief"
                    sub="auto · 8:00am"
                    onClick={() => triggerAutomation(automations[1]?.id)}
                  />
                </div>
              </Card>
            )}
          </motion.div>

          {/* Recent Gmail */}
          {features.inbox && (
            <motion.div variants={fadeUp} className="col-span-12 lg:col-span-6">
              <Card>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="mono-tag mb-1">recent · gmail</div>
                    <h3 className="text-[14px] font-medium tracking-tight text-white">
                      Latest threads
                    </h3>
                  </div>
                  <Link href="/inbox" className="text-[11px] text-muted hover:text-accent">
                    open inbox →
                  </Link>
                </div>
                <ul className="space-y-1">
                  {emails.slice(0, 4).map((em) => (
                    <li
                      key={em.id}
                      className="group flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-white/[0.06] hover:bg-white/[0.02]"
                      onClick={() => setSelectedNodeId("gmail")}
                    >
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
                        <div className="mt-0.5 truncate text-[11.5px] text-muted">
                          {em.from} · {em.preview}
                        </div>
                      </div>
                      <div className="shrink-0 text-[10px] text-muted-soft">
                        {formatRelativeTime(em.receivedAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          )}

          {/* Upcoming Calendar */}
          {features.calendar && (
            <motion.div variants={fadeUp} className="col-span-12 lg:col-span-6">
              <Card>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="mono-tag mb-1">calendar · today</div>
                    <h3 className="text-[14px] font-medium tracking-tight text-white">
                      Upcoming events
                    </h3>
                  </div>
                  <Link href="/calendar" className="text-[11px] text-muted hover:text-accent">
                    open calendar →
                  </Link>
                </div>
                <ul className="space-y-1.5">
                  {today.slice(0, 4).map((ev) => (
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
                        <div className="mt-0.5 truncate text-[11px] text-muted">
                          {ev.location}{ev.attendees ? ` · ${ev.attendees.length} attendees` : ""}
                        </div>
                      </div>
                      <Clock className="h-3.5 w-3.5 text-muted-soft" />
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          )}

          {/* Reminders */}
          {features.reminders && (
            <motion.div variants={fadeUp} className="col-span-12 lg:col-span-6">
              <Card>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="mono-tag mb-1">reminders</div>
                    <h3 className="text-[14px] font-medium tracking-tight text-white">
                      Follow-ups
                    </h3>
                  </div>
                  <Link href="/reminders" className="text-[11px] text-muted hover:text-accent">
                    view all →
                  </Link>
                </div>
                <ul className="space-y-1.5">
                  {openReminders.slice(0, 4).map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start gap-2.5 rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2"
                    >
                      <span
                        className={
                          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full " +
                          (r.priority === "high"
                            ? "bg-rose-300"
                            : r.priority === "medium"
                            ? "bg-amber-300"
                            : "bg-muted")
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] tracking-tight text-white">
                          {r.title}
                        </div>
                        {r.description && (
                          <div className="mt-0.5 truncate text-[11px] text-muted">
                            {r.description}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          )}

          {/* n8n Automations */}
          {features.automations && (
            <motion.div variants={fadeUp} className="col-span-12 lg:col-span-6">
              <Card>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="mono-tag mb-1">automations</div>
                    <h3 className="text-[14px] font-medium tracking-tight text-white">
                      n8n workflows
                    </h3>
                  </div>
                  <Link href="/automations" className="text-[11px] text-muted hover:text-accent">
                    manage →
                  </Link>
                </div>
                <ul className="space-y-1.5">
                  {automations.slice(0, 4).map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] tracking-tight text-white">
                          {a.name}
                        </div>
                        <div className="mt-0.5 text-[10.5px] text-muted">
                          {a.runs} runs · last {formatRelativeTime(a.lastRunAt ?? "")}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="subtle"
                        onClick={() => triggerAutomation(a.id)}
                        icon={<Zap className="h-3 w-3" />}
                      >
                        Run
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          )}

          {/* Pinned apps — each becomes its own block. The row lays them out
              in a responsive grid; user controls what shows up via the Apps
              page (pin/unpin). */}
          {pinnedApps.length > 0 && (
            <motion.div variants={fadeUp} className="col-span-12">
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <div className="mono-tag mb-1">pinned</div>
                  <h3 className="text-[14px] font-medium tracking-tight text-white">
                    Live from your apps
                  </h3>
                </div>
                <Link href="/apps" className="text-[11px] text-muted hover:text-accent">
                  pin more →
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {pinnedApps.map((id) => (
                  <PinnedAppBlock key={id} appId={id} />
                ))}
              </div>
            </motion.div>
          )}

          {/* App shortcuts — full width */}
          <motion.div variants={fadeUp} className="col-span-12">
            <Card>
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="mono-tag mb-1">apps</div>
                  <h3 className="text-[14px] font-medium tracking-tight text-white">
                    Your connected tools
                  </h3>
                </div>
                <Link href="/apps" className="text-[11px] text-muted hover:text-accent">
                  manage →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                {connectedApps.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => setSelectedNodeId(app.id)}
                    className="group flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2.5 text-left transition-all hover:border-accent/30 hover:bg-accent/[0.04]"
                  >
                    {/* Use the shared brandChip backdrop so dark-silhouette
                        logos (GitHub, OpenAI, Notion, etc.) read on the dark
                        UI. Falls back to a generic chip for brands without
                        a registered backdrop. */}
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md border p-1",
                        brandChip[app.icon.toLowerCase()] ??
                          "border-white/[0.06] bg-white/[0.02]"
                      )}
                    >
                      <Icon name={app.icon} className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[12px] tracking-tight text-white">
                        {app.name}
                      </div>
                      <div className="text-[10px] text-muted-soft">
                        connected
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function BriefStat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3">
      <div className="mono-tag flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="mt-1.5 truncate text-[14px] font-medium tracking-tight text-white">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-muted">{sub}</div>
    </div>
  );
}

function BriefBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[12.5px] tracking-tight text-white/85">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent shadow-glow-sm" />
      <span>{children}</span>
    </li>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] p-3 text-left transition-all hover:border-accent/30 hover:bg-accent/[0.04] hover:shadow-glow-sm"
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-accent">
        {icon}
      </div>
      <div className="flex w-full items-center justify-between">
        <span className="text-[12px] tracking-tight text-white">{label}</span>
        <ArrowUpRight className="h-3 w-3 text-muted-soft opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </button>
  );
}

function AiTile({
  icon,
  name,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  name: string;
  sub: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2.5 text-left transition-all hover:border-accent/30 hover:bg-accent/[0.04]"
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02]">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[12px] tracking-tight text-white">{name}</div>
        <div className="text-[10px] text-muted-soft">{sub}</div>
      </div>
    </button>
  );
}
