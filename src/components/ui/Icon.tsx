"use client";

import {
  Hexagon,
  Sparkles,
  BrainCircuit,
  Mail,
  MessageSquare,
  Calendar,
  BookOpen,
  HardDrive,
  GitBranch,
  Bell,
  CheckSquare,
  Workflow,
  Inbox,
  Frame,
  Command,
  FileText,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const lucideMap: Record<string, LucideIcon> = {
  Hexagon,
  Sparkles,
  BrainCircuit,
  Mail,
  MessageSquare,
  Calendar,
  BookOpen,
  HardDrive,
  GitBranch,
  Bell,
  CheckSquare,
  Workflow,
  Inbox,
  Frame,
  Command,
  FileText,
  Table2,
  // Provider fallbacks for brands without SVGs in /public/logos. The brandTints
  // map below tints them brand-appropriate so they don't look like generic
  // grey icons.
  linear: Inbox,
  figma: Frame,
  discord: MessageSquare,
};

// Brand logos served from /public/logos/<slug>.svg — full-color SVGs.
// Entries listed here render as <img>; everything else falls through to Lucide.
const brandLogos: Record<string, string> = {
  gmail: "/logos/gmail.svg",
  calendar: "/logos/google-calendar.svg",
  drive: "/logos/google-drive.svg",
  google: "/logos/google.svg",
  notion: "/logos/notion.svg",
  claude: "/logos/claude.svg",
  chatgpt: "/logos/openai.svg",
  openai: "/logos/openai.svg",
  gemini: "/logos/gemini.svg",
  n8n: "/logos/n8n.svg",
  github: "/logos/github.svg",
  slack: "/logos/slack.svg",
  vercel: "/logos/vercel.svg",
  vapi: "/logos/vapi.svg",
  spotify: "/logos/spotify.svg",
  youtube: "/logos/youtube.svg",
  // Real official Google product icons (PNG @ 96×96 — gstatic CDN cached
  // assets). Replaces the previous Lucide FileText / Table2 placeholders.
  "google-docs": "/logos/google-docs.png",
  docs: "/logos/google-docs.png",
  "google-sheets": "/logos/google-sheets.png",
  sheets: "/logos/google-sheets.png",
};

// For Lucide-rendered "fake brand" icons we want a specific tint that reads as the brand.
const lucideTints: Record<string, string> = {
  FileText: "text-sky-300", // Google Docs
  Table2: "text-emerald-300", // Google Sheets
  linear: "text-violet-300", // Linear's signature purple
  figma: "text-rose-300", // Figma's mixed warm palette → rose reads as Figma-ish
  discord: "text-indigo-300", // Discord's blurple
};

export function Icon({
  name,
  className,
  strokeWidth = 1.6,
}: {
  name: string;
  className?: string;
  strokeWidth?: number;
}) {
  // 1) Brand logo override (full-color SVG via <img>)
  const key = name.toLowerCase();
  const brandSrc = brandLogos[key];
  if (brandSrc) {
    return (
      <img
        src={brandSrc}
        alt=""
        draggable={false}
        className={cn("object-contain select-none", className)}
        style={{ filter: "saturate(1.05)" }}
      />
    );
  }
  // 2) Lucide fallback
  const Cmp = lucideMap[name] ?? Hexagon;
  return (
    <Cmp
      className={cn(className, lucideTints[name])}
      strokeWidth={strokeWidth}
    />
  );
}
