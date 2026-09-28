import type { PinnedDoc } from "@/lib/types";

// Seed pinned documents — visible until the user removes them or adds their own.
// Once Google is connected, the "Pin from Drive" flow stores items here.
export const samplePinnedDocs: PinnedDoc[] = [
  {
    id: "seed-doc-1",
    title: "Citadel — north star",
    kind: "doc",
    url: "https://docs.google.com/document/u/0/",
    description: "Vision doc, priorities, and quarterly bets.",
    addedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: "seed-sheet-1",
    title: "Finances · 2026",
    kind: "sheet",
    url: "https://docs.google.com/spreadsheets/u/0/",
    description: "Cash, runway, and personal P&L.",
    addedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  {
    id: "seed-doc-2",
    title: "Weekly review template",
    kind: "doc",
    url: "https://docs.google.com/document/u/0/",
    description: "Friday retro prompts and rolling notes.",
    addedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
  },
];
