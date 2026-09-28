import type { Reminder } from "@/lib/types";

const now = Date.now();
const hoursAhead = (n: number) => new Date(now + n * 3_600_000).toISOString();
const daysAhead = (n: number) => new Date(now + n * 86_400_000).toISOString();

export const sampleReminders: Reminder[] = [
  {
    id: "rm_1",
    title: "Reply to project email",
    description: "Daniel's timeline update — confirm Thursday sync.",
    dueAt: hoursAhead(3),
    priority: "high",
    complete: false,
    linkedAppId: "gmail",
  },
  {
    id: "rm_2",
    title: "Review automation workflow",
    description: "n8n: weekly status report — failing on Friday runs.",
    dueAt: hoursAhead(20),
    priority: "medium",
    complete: false,
    linkedAppId: "n8n",
  },
  {
    id: "rm_3",
    title: "Prepare for design review",
    description: "Pull latest tokens, compare A/B click paths.",
    dueAt: hoursAhead(6),
    priority: "high",
    complete: false,
    linkedAppId: "calendar",
  },
  {
    id: "rm_4",
    title: "Send weekly update",
    description: "Investor digest — retention notes and roadmap.",
    dueAt: daysAhead(1),
    priority: "medium",
    complete: false,
    linkedAppId: "gmail",
  },
  {
    id: "rm_5",
    title: "Reply to investor email",
    description: "Aaron's note on the retention slide.",
    dueAt: hoursAhead(2),
    priority: "high",
    complete: false,
    linkedAppId: "gmail",
  },
  {
    id: "rm_6",
    title: "Audit Drive folder permissions",
    dueAt: daysAhead(3),
    priority: "low",
    complete: true,
    linkedAppId: "drive",
  },
];
