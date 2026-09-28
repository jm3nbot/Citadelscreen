export type NodeCategory = "core" | "ai" | "work" | "personal" | "automation" | "communication";

export type CitadelNodeKind =
  | "core"
  | "app"
  | "automation"
  | "reminder"
  | "calendar"
  | "email"
  | "ai";

export type CitadelNode = {
  id: string;
  label: string;
  kind: CitadelNodeKind;
  category: NodeCategory;
  icon: string; // lucide icon name
  description?: string;
  connected?: boolean;
  position: { x: number; y: number };
  accent?: string;
};

export type CitadelEdge = {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
};

export type Email = {
  id: string;
  from: string;
  // Bare email address for avatar lookups (parsed from the From header).
  fromEmail?: string;
  fromInitials: string;
  subject: string;
  preview: string;
  receivedAt: string;
  unread: boolean;
  starred: boolean;
  priority: "high" | "normal" | "low";
  needsReply: boolean;
  tags?: string[];
};

export type CalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  attendees?: string[];
  location?: string;
  meetingLink?: string;
  prepNotes?: string[];
};

export type Reminder = {
  id: string;
  title: string;
  description?: string;
  dueAt?: string;
  priority: "high" | "medium" | "low";
  complete: boolean;
  linkedAppId?: string;
};

export type Automation = {
  id: string;
  name: string;
  description: string;
  category: "ai" | "email" | "reports" | "files" | "calendar" | "tasks";
  webhookUrl?: string;
  connectedAppIds: string[];
  lastRunAt?: string;
  runs?: number;
};

export type Quote = {
  id: string;
  text: string;
  author?: string;
  addedAt: string;
};

// Persistent record of a checked-off to-do item. Lives independently of the
// originating sticker so the entry survives if the user later deletes the
// to-do panel from the network. The `stickerId` is a best-effort backlink —
// `sourceRemoved` flips to true when the parent panel is gone.
export type ResolvedTodo = {
  id: string;
  // Original item id inside the source sticker (lets us un-resolve in place).
  itemId: string;
  text: string;
  listTitle: string;
  // Set when the entire panel was archived as a unit (instead of one item).
  panelArchived?: boolean;
  resolvedAt: string;
  stickerId?: string;
  sourceRemoved?: boolean;
};

export type StickerBase = {
  id: string;
  // Canvas coordinates (React Flow coord space — same units as node positions).
  position: { x: number; y: number };
  // Optional explicit size. If absent the sticker auto-sizes from content.
  width?: number;
  height?: number;
};

export type TextSticker = StickerBase & {
  kind: "text";
  text: string;
  // Optional accent for the border / glow — keyed to the prefs accent if missing.
  color?: "accent" | "amber" | "rose" | "emerald" | "violet";
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  // When true, drop the bordered card chrome and render as plain text on the
  // canvas. Sticker is still draggable; just no node-like backdrop.
  bare?: boolean;
};

export type ImageSticker = StickerBase & {
  kind: "image";
  // ID of the blob in IndexedDB (same store the Documents local-files use).
  localFileId: string;
  mimeType: string;
  alt?: string;
  // When true, drop the bordered card chrome and render the raw image.
  bare?: boolean;
};

// Classic post-it style. Different color set + paper-ish styling.
// "paper" is the white-with-red-left-rule notepad look (legal-pad style).
export type StickyNoteColor =
  | "yellow"
  | "pink"
  | "blue"
  | "green"
  | "purple"
  | "paper";

export type StickyNoteSticker = StickerBase & {
  kind: "sticky";
  text: string;
  color: StickyNoteColor;
  fontSize?: number;
};

export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
  // When the item flipped to done (ISO). Drives the "Resolved to-do" section
  // in /reminders so we can sort by recency.
  resolvedAt?: string;
  // Where the parent todo-sticker lives + its title, snapshotted at the time
  // the item was resolved so the reminders view still works if the sticker
  // is later deleted.
  // (Stored on parent sticker, not item — see TodoSticker.)
};

export type TodoSticker = StickerBase & {
  kind: "todo";
  title?: string;
  items: TodoItem[];
};

export type Sticker = TextSticker | ImageSticker | StickyNoteSticker | TodoSticker;

export type PinnedDocKind = "doc" | "sheet" | "slides" | "pdf" | "file";

export type PinnedDoc = {
  id: string;
  title: string;
  kind: PinnedDocKind;
  // For remote docs (Google/web) this is the URL. For local uploads it's "" —
  // open via `localFileId` instead.
  url: string;
  // Optional preview snippet shown on the card
  description?: string;
  // ISO date for sort/recency display
  addedAt: string;
  // Optional Drive file id so we can refresh metadata in future
  driveId?: string;
  // If present, this doc is a local upload stored in IndexedDB. Open by
  // hydrating the blob via `getLocalFileUrl(localFileId)`.
  localFileId?: string;
  // MIME type for local uploads — drives how the viewer renders them.
  mimeType?: string;
  // Bytes — surfaced on the card for local files.
  size?: number;
};

export type AppConnection = {
  id: string;
  name: string;
  icon: string;
  status: "connected" | "not_connected" | "coming_soon";
  category: NodeCategory;
  description: string;
};
