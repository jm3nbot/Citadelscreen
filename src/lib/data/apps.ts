import type { AppConnection } from "@/lib/types";

export const sampleApps: AppConnection[] = [
  { id: "gmail", name: "Gmail", icon: "gmail", status: "connected", category: "communication", description: "Inbox & priority threads." },
  { id: "calendar", name: "Google Calendar", icon: "calendar", status: "connected", category: "work", description: "Schedule & meetings." },
  { id: "drive", name: "Google Drive", icon: "drive", status: "connected", category: "work", description: "File storage & sharing." },
  { id: "docs", name: "Google Docs", icon: "docs", status: "connected", category: "work", description: "Long-form documents." },
  { id: "sheets", name: "Google Sheets", icon: "sheets", status: "connected", category: "work", description: "Spreadsheets & models." },
  // Honest defaults — these have no real integration yet, so we don't claim "connected".
  // Tasks/Reminders below stay "connected" because their data lives in the local Citadel store.
  { id: "notion", name: "Notion", icon: "notion", status: "not_connected", category: "work", description: "Docs & knowledge base." },
  { id: "claude", name: "Claude", icon: "claude", status: "not_connected", category: "ai", description: "Long-context AI assistant." },
  { id: "chatgpt", name: "ChatGPT", icon: "chatgpt", status: "not_connected", category: "ai", description: "Conversational reasoning." },
  { id: "gemini", name: "Gemini", icon: "gemini", status: "not_connected", category: "ai", description: "Multimodal Google AI." },
  { id: "n8n", name: "n8n", icon: "n8n", status: "not_connected", category: "automation", description: "Workflows & webhooks." },
  { id: "tasks", name: "Tasks", icon: "CheckSquare", status: "connected", category: "personal", description: "Daily tasks & checklists." },
  { id: "reminders", name: "Reminders", icon: "Bell", status: "connected", category: "personal", description: "Follow-ups & nudges." },
  { id: "github", name: "GitHub", icon: "github", status: "not_connected", category: "work", description: "Source control & PRs." },
  { id: "slack", name: "Slack", icon: "slack", status: "not_connected", category: "communication", description: "Team conversations." },
  { id: "vercel", name: "Vercel", icon: "vercel", status: "not_connected", category: "work", description: "Hosting & deployments." },
  { id: "vapi", name: "Vapi", icon: "vapi", status: "not_connected", category: "ai", description: "Voice AI agents." },
  { id: "linear", name: "Linear", icon: "linear", status: "not_connected", category: "work", description: "Issue tracking & roadmaps." },
  { id: "figma", name: "Figma", icon: "figma", status: "not_connected", category: "work", description: "Design files & libraries." },
  { id: "discord", name: "Discord", icon: "discord", status: "not_connected", category: "communication", description: "Servers, DMs, communities." },
  { id: "raycast", name: "Raycast", icon: "Command", status: "coming_soon", category: "personal", description: "Local launcher integration." },
  { id: "spotify", name: "Spotify", icon: "spotify", status: "not_connected", category: "personal", description: "Currently playing & listening profile." },
  { id: "youtube", name: "YouTube", icon: "youtube", status: "not_connected", category: "personal", description: "Subscriptions & recent activity." },
];
