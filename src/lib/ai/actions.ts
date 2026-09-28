// Settings-action protocol between the AI and the client.
//
// The model is told (via the system prompt) that it can emit one or more
// action tags inside its reply, formatted like:
//
//   [[ACTION setAccent="red"]]
//   [[ACTION setGridIntensity="bold"]]
//   [[ACTION setCustomAccent="#ff5577"]]
//
// The client parses these out, applies them through the Zustand store, and
// strips them from the visible reply (replaced with a small "Applied: …"
// chip).
//
// We deliberately keep the surface SMALL and COSMETIC. The AI can recolour
// the app and toggle view prefs — it cannot delete data, modify reminders,
// or touch tokens.

export const APPLIABLE_ACTIONS = [
  "setAccent", // cyan|ice|violet|lime|amber|red
  "setCustomAccent", // "#rrggbb"
  "setGridIntensity", // off|veryLight|normal|bold
  "setMinimalNodes", // true|false
  "setAnimateEdges", // true|false
  "setShowMinimap", // true|false
  "setViewMode", // node|dashboard
  "toggleSidebar", // (no value)
  "triggerRainbow", // (no value) — same as /rainbow
  "triggerRainbowSuper", // (no value) — same as /rainbowsuper
] as const;

export type AppliableAction = (typeof APPLIABLE_ACTIONS)[number];

export type ParsedAction = {
  action: AppliableAction;
  value?: string;
};

// Regex matches: [[ACTION setAccent="red"]] or [[ACTION toggleSidebar]]
// — value is optional, supports both quoted and unquoted single-word values.
const ACTION_RE =
  /\[\[ACTION\s+([a-zA-Z]+)(?:=(?:"([^"]*)"|([A-Za-z0-9_\-#]+)))?\s*\]\]/g;

// Walks a model reply, extracts every action tag, and returns:
//   - actions: a clean list of (name, value)
//   - cleaned: the reply with all action tags removed
export function parseActions(reply: string): {
  actions: ParsedAction[];
  cleaned: string;
} {
  const actions: ParsedAction[] = [];
  const cleaned = reply.replace(ACTION_RE, (_match, name, quoted, bare) => {
    const action = name as AppliableAction;
    if (!(APPLIABLE_ACTIONS as readonly string[]).includes(action)) {
      // Unknown action — leave the tag visible so the user sees the model
      // tried something we don't support, rather than silently dropping it.
      return _match;
    }
    actions.push({ action, value: quoted ?? bare });
    return "";
  });
  return { actions, cleaned: cleaned.replace(/\n{3,}/g, "\n\n").trim() };
}

// Human-readable summary of an action for the "Applied: …" chip.
export function describeAction(a: ParsedAction): string {
  switch (a.action) {
    case "setAccent":
      return `Accent → ${a.value}`;
    case "setCustomAccent":
      return `Accent (custom) → ${a.value}`;
    case "setGridIntensity":
      return `Grid → ${a.value}`;
    case "setMinimalNodes":
      return `Minimal nodes → ${a.value}`;
    case "setAnimateEdges":
      return `Animated edges → ${a.value}`;
    case "setShowMinimap":
      return `Minimap → ${a.value}`;
    case "setViewMode":
      return `View mode → ${a.value}`;
    case "toggleSidebar":
      return `Sidebar toggled`;
    case "triggerRainbow":
      return `Rainbow mode (3 min)`;
    case "triggerRainbowSuper":
      return `Rainbow SUPER (3 min, brighter + faster)`;
  }
}

// Builds the "available actions" instructions block we inject into the AI's
// system prompt. Keeps the catalogue + valid values in ONE place.
export function buildActionInstructions(): string {
  return [
    "<ACTION_PROTOCOL>",
    "When the user asks to change a Citadel setting, emit one or more tags using this EXACT syntax inside your reply:",
    '  [[ACTION setAccent="red"]]',
    '  [[ACTION setCustomAccent="#ff5577"]]',
    "  [[ACTION toggleSidebar]]",
    "",
    "Available actions and valid values:",
    '  - setAccent="cyan" | "ice" | "violet" | "lime" | "amber" | "red"',
    '  - setCustomAccent="#rrggbb" (any 6-digit hex)',
    '  - setGridIntensity="off" | "veryLight" | "normal" | "bold"',
    '  - setMinimalNodes="true" | "false"',
    '  - setAnimateEdges="true" | "false"',
    '  - setShowMinimap="true" | "false"',
    '  - setViewMode="node" | "dashboard"',
    "  - toggleSidebar (no value)",
    "  - triggerRainbow (no value) — same as the /rainbow slash command",
    "  - triggerRainbowSuper (no value) — same as the /rainbowsuper slash command (3s cycle, 30% brighter)",
    "",
    "Confirm the change in plain English alongside the tag(s). Example:",
    '  User: make the app red',
    '  You: Switching the accent to red. [[ACTION setAccent="red"]]',
    "",
    "Only emit action tags when the user clearly asked for a settings change. Never invent settings; only use the names listed above.",
    "</ACTION_PROTOCOL>",
  ].join("\n");
}
