import type { CalendarEvent } from "@/lib/types";

const today = new Date();
today.setHours(0, 0, 0, 0);

function at(hour: number, minute = 0, daysAhead = 0): string {
  const d = new Date(today);
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const sampleEvents: CalendarEvent[] = [
  {
    id: "ev_1",
    title: "Product Sync",
    startsAt: at(10, 30),
    endsAt: at(11, 0),
    attendees: ["Daniel O.", "Mira A.", "Jules R."],
    location: "Meet · /citadel-product",
    prepNotes: [
      "Review the v2 spec — feedback from Helena",
      "Decision needed: rollout cohort for week 32",
    ],
  },
  {
    id: "ev_2",
    title: "Investor Call — Aaron W.",
    startsAt: at(13, 0),
    endsAt: at(13, 45),
    attendees: ["Aaron W."],
    location: "Zoom",
    prepNotes: [
      "Walk through Q2 retention deltas",
      "Send revised deck before the call",
    ],
  },
  {
    id: "ev_3",
    title: "Design Review",
    startsAt: at(16, 0),
    endsAt: at(17, 0),
    attendees: ["Mira A.", "Tomás P.", "Reza K."],
    location: "Figma room",
    prepNotes: [
      "Pull latest tokens from design system",
      "Compare A/B variant click paths",
    ],
  },
  {
    id: "ev_4",
    title: "Strategy Offsite Prep",
    startsAt: at(11, 0, 1),
    endsAt: at(12, 0, 1),
    attendees: ["Helena C.", "Daniel O."],
    location: "Office · room 3B",
  },
  {
    id: "ev_5",
    title: "1:1 with Helena",
    startsAt: at(9, 0, 2),
    endsAt: at(9, 30, 2),
    attendees: ["Helena C."],
    location: "Meet",
  },
  {
    id: "ev_6",
    title: "Quarterly Review",
    startsAt: at(14, 0, 4),
    endsAt: at(15, 30, 4),
    attendees: ["Board"],
    location: "Boardroom",
  },
];

export function getNextEvent(events: CalendarEvent[] = sampleEvents) {
  const now = Date.now();
  return events.find((e) => new Date(e.startsAt).getTime() > now) ?? events[0];
}

export function getTodayEvents(events: CalendarEvent[] = sampleEvents) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return events.filter((e) => {
    const t = new Date(e.startsAt).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
}
