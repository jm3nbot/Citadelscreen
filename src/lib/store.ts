"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Reminder,
  Automation,
  PinnedDoc,
  Quote,
  Sticker,
  TextSticker,
  ImageSticker,
  StickyNoteSticker,
  TodoSticker,
  TodoItem,
  ResolvedTodo,
} from "@/lib/types";
// Sample data deliberately NOT imported — store starts empty so every page
// shows real (or empty-state) data, never seeded demo placeholders.
import { uid } from "@/lib/utils";

export type ViewMode = "node" | "dashboard";

export type FeatureFlags = {
  inbox: boolean;
  calendar: boolean;
  reminders: boolean;
  automations: boolean;
  aiTools: boolean;
  drive: boolean;
  tasks: boolean;
  network: boolean;
};

export type AccentKey = "cyan" | "ice" | "violet" | "lime" | "amber" | "red";
export type GridIntensity = "off" | "veryLight" | "normal" | "bold";

export type CitadelPrefs = {
  viewMode: ViewMode;
  accent: AccentKey;
  // When set, overrides the predefined accent palette. Hex string ("#rrggbb")
  // picked from the color-wheel input on /settings. ThemeBridge applies it
  // by converting to space-separated RGB and overwriting --accent-rgb.
  customAccent?: string;
  gridIntensity: GridIntensity;
  showMinimap: boolean;
  animateEdges: boolean;
  minimalNodes: boolean; // when true, nodes show only the logo (no labels)
  // When true, sidebar shows only icons (Claude-style collapsible nav).
  sidebarCollapsed: boolean;
  features: FeatureFlags;
  // Captured on first launch via the WelcomeModal. Used to address the user
  // (top bar greeting, daily briefings, etc.). Undefined = first run.
  operatorName?: string;
  // AI Assistant configuration. Provider + display name only — never an
  // API key, that lives encrypted server-side if/when BYOK is wired up.
  assistant?: {
    name: string;
    provider: "gemini" | "openai" | "claude";
  };
  // Easter-egg "/rainbow" mode. When set, ThemeBridge runs an HSL cycle
  // on --accent-rgb until this timestamp passes. Capped at 3 minutes.
  // `rainbowSpeed === "super"` cycles at 3s instead of 6s and boosts
  // saturation+lightness ~30% for an extra-bright glow.
  rainbowUntil?: number;
  rainbowSpeed?: "normal" | "super";
};

type State = {
  // UI
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  // Preferences (persisted)
  prefs: CitadelPrefs;
  setViewMode: (m: ViewMode) => void;
  toggleViewMode: () => void;
  setAccent: (a: AccentKey) => void;
  setGridIntensity: (g: GridIntensity) => void;
  setShowMinimap: (v: boolean) => void;
  setAnimateEdges: (v: boolean) => void;
  setMinimalNodes: (v: boolean) => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setFeature: (key: keyof FeatureFlags, value: boolean) => void;
  setCustomAccent: (hex: string | undefined) => void;
  setOperatorName: (name: string) => void;
  setAssistant: (cfg: Partial<NonNullable<CitadelPrefs["assistant"]>>) => void;
  // Triggers the rainbow accent-cycling overlay for `durationMs` ms. Pass 0
  // (or call clearRainbow) to stop immediately. Capped server-side at 3min.
  // `mode === "super"` runs the faster brighter variant (3s cycle + boost).
  setRainbow: (durationMs: number, mode?: "normal" | "super") => void;
  clearRainbow: () => void;

  // Pinned documents (persisted)
  pinnedDocs: PinnedDoc[];
  addPinnedDoc: (doc: Omit<PinnedDoc, "id" | "addedAt">) => void;
  removePinnedDoc: (id: string) => void;
  updatePinnedDoc: (id: string, patch: Partial<Omit<PinnedDoc, "id">>) => void;

  // Reminders (persisted)
  reminders: Reminder[];
  addReminder: (r: Omit<Reminder, "id" | "complete">) => void;
  toggleReminder: (id: string) => void;
  deleteReminder: (id: string) => void;

  // Automations (persisted)
  automations: Automation[];
  addAutomation: (a: Omit<Automation, "id" | "runs" | "lastRunAt">) => void;
  updateAutomation: (id: string, patch: Partial<Automation>) => void;
  deleteAutomation: (id: string) => void;
  triggerAutomation: (id: string) => void;

  // Node positions (persisted) — keyed by node id
  nodePositions: Record<string, { x: number; y: number }>;
  setNodePosition: (id: string, pos: { x: number; y: number }) => void;
  resetNodePositions: () => void;

  // Per-node visibility (persisted). A node id present here means "hidden".
  hiddenNodes: Record<string, boolean>;
  toggleNodeVisibility: (id: string) => void;
  setNodeVisible: (id: string, visible: boolean) => void;
  showAllNodes: () => void;

  // Apps the user has pinned to the home dashboard. Each pinned app gets a
  // dedicated block in DashboardMode (Spotify mini-player, GitHub activity,
  // generic fallback). Ordering reflects pin order.
  pinnedApps: string[];
  pinApp: (id: string) => void;
  unpinApp: (id: string) => void;
  togglePinApp: (id: string) => void;

  // Free-floating annotations on the network canvas.
  stickers: Sticker[];
  addTextSticker: (s: Omit<TextSticker, "id" | "kind">) => string;
  addImageSticker: (s: Omit<ImageSticker, "id" | "kind">) => string;
  addStickyNote: (s: Omit<StickyNoteSticker, "id" | "kind">) => string;
  addTodoSticker: (s: Omit<TodoSticker, "id" | "kind">) => string;
  updateSticker: (id: string, patch: Partial<Sticker>) => void;
  moveSticker: (id: string, position: { x: number; y: number }) => void;
  removeSticker: (id: string) => void;

  // Granular operations on todo-sticker items so the UI doesn't have to
  // splice the items array manually (and so resolvedAt is stamped centrally).
  addTodoItem: (stickerId: string, text: string) => void;
  toggleTodoItem: (stickerId: string, itemId: string) => void;
  updateTodoItem: (stickerId: string, itemId: string, patch: Partial<TodoItem>) => void;
  removeTodoItem: (stickerId: string, itemId: string) => void;

  // Quote book (persisted)
  quotes: Quote[];
  addQuote: (q: Omit<Quote, "id" | "addedAt">) => void;
  updateQuote: (id: string, patch: Partial<Omit<Quote, "id">>) => void;
  removeQuote: (id: string) => void;

  // Persistent archive of resolved to-do items. Outlives the source sticker.
  resolvedTodos: ResolvedTodo[];
  archiveTodoPanel: (stickerId: string) => void;
  unresolveTodo: (id: string) => void;
  removeResolvedTodo: (id: string) => void;
  clearResolvedTodos: () => void;

  // AI chat history — persisted exchanges from the dashboard assistant.
  // Capped at MAX_CHAT_HISTORY entries to keep localStorage manageable.
  chatHistory: ChatExchange[];
  addChatExchange: (e: Omit<ChatExchange, "id" | "at">) => void;
  removeChatExchange: (id: string) => void;
  clearChatHistory: () => void;
};

export type ChatExchange = {
  id: string;
  at: number;
  user: string;
  reply: string;
  provider?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  contextsUsed?: {
    email?: boolean;
    spotify?: boolean;
    youtube?: boolean;
    github?: boolean;
    reminders?: boolean;
    stickers?: boolean;
    settings?: boolean;
  };
};

const MAX_CHAT_HISTORY = 100;

const defaultFeatures: FeatureFlags = {
  inbox: true,
  calendar: true,
  reminders: true,
  automations: true,
  aiTools: true,
  drive: true,
  tasks: true,
  network: true,
};

export const useCitadel = create<State>()(
  persist(
    (set) => ({
      selectedNodeId: null,
      setSelectedNodeId: (id) => set({ selectedNodeId: id }),

      prefs: {
        viewMode: "node",
        accent: "cyan",
        gridIntensity: "normal",
        showMinimap: false,
        animateEdges: true,
        minimalNodes: false,
        sidebarCollapsed: false,
        features: defaultFeatures,
      },
      setViewMode: (m) =>
        set((s) => ({ prefs: { ...s.prefs, viewMode: m } })),
      toggleViewMode: () =>
        set((s) => ({
          prefs: {
            ...s.prefs,
            viewMode: s.prefs.viewMode === "node" ? "dashboard" : "node",
          },
        })),
      setAccent: (a) => set((s) => ({ prefs: { ...s.prefs, accent: a } })),
      setGridIntensity: (g) =>
        set((s) => ({ prefs: { ...s.prefs, gridIntensity: g } })),
      setShowMinimap: (v) =>
        set((s) => ({ prefs: { ...s.prefs, showMinimap: v } })),
      setAnimateEdges: (v) =>
        set((s) => ({ prefs: { ...s.prefs, animateEdges: v } })),
      setMinimalNodes: (v) =>
        set((s) => ({ prefs: { ...s.prefs, minimalNodes: v } })),
      setCustomAccent: (hex) =>
        set((s) => ({ prefs: { ...s.prefs, customAccent: hex } })),
      setOperatorName: (name) =>
        set((s) => ({ prefs: { ...s.prefs, operatorName: name } })),
      setRainbow: (durationMs, mode = "normal") =>
        set((s) => ({
          prefs: {
            ...s.prefs,
            // Clamp to [0, 3min] so a maliciously-large input can't trap
            // the user in flashing colors.
            rainbowUntil:
              durationMs <= 0
                ? undefined
                : Date.now() + Math.min(durationMs, 3 * 60 * 1000),
            rainbowSpeed: durationMs <= 0 ? undefined : mode,
          },
        })),
      clearRainbow: () =>
        set((s) => ({
          prefs: {
            ...s.prefs,
            rainbowUntil: undefined,
            rainbowSpeed: undefined,
          },
        })),
      setAssistant: (cfg) =>
        set((s) => {
          // Merge patch so callers can update just the name OR just the
          // provider without clobbering the other field. Defaults applied
          // when assistant has never been initialized.
          const base = s.prefs.assistant ?? {
            name: "Sentinel",
            provider: "gemini" as const,
          };
          return { prefs: { ...s.prefs, assistant: { ...base, ...cfg } } };
        }),
      setSidebarCollapsed: (v) =>
        set((s) => ({ prefs: { ...s.prefs, sidebarCollapsed: v } })),
      toggleSidebar: () =>
        set((s) => ({
          prefs: { ...s.prefs, sidebarCollapsed: !s.prefs.sidebarCollapsed },
        })),
      setFeature: (key, value) =>
        set((s) => ({
          prefs: {
            ...s.prefs,
            features: { ...s.prefs.features, [key]: value },
          },
        })),

      reminders: [],
      addReminder: (r) =>
        set((s) => ({
          reminders: [
            { ...r, id: uid("rm"), complete: false },
            ...s.reminders,
          ],
        })),
      toggleReminder: (id) =>
        set((s) => ({
          reminders: s.reminders.map((r) =>
            r.id === id ? { ...r, complete: !r.complete } : r
          ),
        })),
      deleteReminder: (id) =>
        set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) })),

      automations: [],
      addAutomation: (a) =>
        set((s) => ({
          automations: [
            { ...a, id: uid("auto"), runs: 0 },
            ...s.automations,
          ],
        })),
      updateAutomation: (id, patch) =>
        set((s) => ({
          automations: s.automations.map((a) =>
            a.id === id ? { ...a, ...patch } : a
          ),
        })),
      deleteAutomation: (id) =>
        set((s) => ({
          automations: s.automations.filter((a) => a.id !== id),
        })),
      triggerAutomation: (id) =>
        set((s) => ({
          automations: s.automations.map((a) =>
            a.id === id
              ? {
                  ...a,
                  lastRunAt: new Date().toISOString(),
                  runs: (a.runs ?? 0) + 1,
                }
              : a
          ),
        })),

      nodePositions: {},
      setNodePosition: (id, pos) =>
        set((s) => ({ nodePositions: { ...s.nodePositions, [id]: pos } })),
      resetNodePositions: () => set({ nodePositions: {} }),

      pinnedDocs: [],
      addPinnedDoc: (doc) =>
        set((s) => ({
          pinnedDocs: [
            { ...doc, id: uid("doc"), addedAt: new Date().toISOString() },
            ...s.pinnedDocs,
          ],
        })),
      removePinnedDoc: (id) =>
        set((s) => {
          const target = s.pinnedDocs.find((d) => d.id === id);
          // Best-effort blob cleanup for local uploads. Runs async; failures
          // are non-fatal (the IndexedDB record just lingers harmlessly).
          if (target?.localFileId && typeof window !== "undefined") {
            import("@/lib/local-files")
              .then((m) => m.deleteLocalFile(target.localFileId!))
              .catch(() => {});
          }
          return { pinnedDocs: s.pinnedDocs.filter((d) => d.id !== id) };
        }),
      updatePinnedDoc: (id, patch) =>
        set((s) => ({
          pinnedDocs: s.pinnedDocs.map((d) =>
            d.id === id ? { ...d, ...patch } : d
          ),
        })),

      hiddenNodes: {},
      toggleNodeVisibility: (id) =>
        set((s) => {
          const next = { ...s.hiddenNodes };
          if (next[id]) delete next[id];
          else next[id] = true;
          return { hiddenNodes: next };
        }),
      setNodeVisible: (id, visible) =>
        set((s) => {
          const next = { ...s.hiddenNodes };
          if (visible) delete next[id];
          else next[id] = true;
          return { hiddenNodes: next };
        }),
      showAllNodes: () => set({ hiddenNodes: {} }),

      pinnedApps: [],
      pinApp: (id) =>
        set((s) =>
          s.pinnedApps.includes(id)
            ? s
            : { pinnedApps: [...s.pinnedApps, id] }
        ),
      unpinApp: (id) =>
        set((s) => ({ pinnedApps: s.pinnedApps.filter((a) => a !== id) })),
      togglePinApp: (id) =>
        set((s) =>
          s.pinnedApps.includes(id)
            ? { pinnedApps: s.pinnedApps.filter((a) => a !== id) }
            : { pinnedApps: [...s.pinnedApps, id] }
        ),

      stickers: [],
      addTextSticker: (s) => {
        const id = uid("sticker");
        set((st) => ({
          stickers: [...st.stickers, { ...s, id, kind: "text" } as TextSticker],
        }));
        return id;
      },
      addImageSticker: (s) => {
        const id = uid("sticker");
        set((st) => ({
          stickers: [...st.stickers, { ...s, id, kind: "image" } as ImageSticker],
        }));
        return id;
      },
      addStickyNote: (s) => {
        const id = uid("sticker");
        set((st) => ({
          stickers: [
            ...st.stickers,
            { ...s, id, kind: "sticky" } as StickyNoteSticker,
          ],
        }));
        return id;
      },
      addTodoSticker: (s) => {
        const id = uid("sticker");
        set((st) => ({
          stickers: [
            ...st.stickers,
            // Caller may omit items; default to empty list.
            { ...s, items: s.items ?? [], id, kind: "todo" } as TodoSticker,
          ],
        }));
        return id;
      },
      addTodoItem: (stickerId, text) =>
        set((st) => ({
          stickers: st.stickers.map((sk) => {
            if (sk.id !== stickerId || sk.kind !== "todo") return sk;
            return {
              ...sk,
              items: [
                ...sk.items,
                { id: uid("todo"), text, done: false },
              ],
            };
          }),
        })),
      toggleTodoItem: (stickerId, itemId) =>
        set((st) => {
          const target = st.stickers.find((s) => s.id === stickerId);
          if (!target || target.kind !== "todo") return st;
          const item = target.items.find((i) => i.id === itemId);
          if (!item) return st;
          const flippingToDone = !item.done;
          const now = new Date().toISOString();
          // Update the sticker in place.
          const stickers = st.stickers.map((sk) => {
            if (sk.id !== stickerId || sk.kind !== "todo") return sk;
            return {
              ...sk,
              items: sk.items.map((it) =>
                it.id !== itemId
                  ? it
                  : {
                      ...it,
                      done: flippingToDone,
                      resolvedAt: flippingToDone ? now : undefined,
                    }
              ),
            };
          });
          // Mirror into the persistent archive.
          let resolvedTodos = st.resolvedTodos;
          if (flippingToDone) {
            // Append (deduped by itemId so re-resolving doesn't double-count).
            const without = resolvedTodos.filter((r) => r.itemId !== itemId);
            resolvedTodos = [
              {
                id: uid("res"),
                itemId,
                text: item.text,
                listTitle: target.title || "To-do list",
                stickerId,
                resolvedAt: now,
              },
              ...without,
            ];
          } else {
            // Un-resolved: remove from archive too.
            resolvedTodos = resolvedTodos.filter((r) => r.itemId !== itemId);
          }
          return { stickers, resolvedTodos };
        }),
      updateTodoItem: (stickerId, itemId, patch) =>
        set((st) => ({
          stickers: st.stickers.map((sk) => {
            if (sk.id !== stickerId || sk.kind !== "todo") return sk;
            return {
              ...sk,
              items: sk.items.map((it) =>
                it.id === itemId ? { ...it, ...patch } : it
              ),
            };
          }),
        })),
      removeTodoItem: (stickerId, itemId) =>
        set((st) => ({
          stickers: st.stickers.map((sk) => {
            if (sk.id !== stickerId || sk.kind !== "todo") return sk;
            return { ...sk, items: sk.items.filter((it) => it.id !== itemId) };
          }),
        })),
      updateSticker: (id, patch) =>
        set((st) => ({
          stickers: st.stickers.map((sk) =>
            sk.id === id ? ({ ...sk, ...patch } as Sticker) : sk
          ),
        })),
      moveSticker: (id, position) =>
        set((st) => ({
          stickers: st.stickers.map((sk) =>
            sk.id === id ? { ...sk, position } : sk
          ),
        })),
      removeSticker: (id) =>
        set((st) => {
          const target = st.stickers.find((sk) => sk.id === id);
          // Best-effort blob cleanup for image stickers.
          if (
            target?.kind === "image" &&
            target.localFileId &&
            typeof window !== "undefined"
          ) {
            import("@/lib/local-files")
              .then((m) => m.deleteLocalFile(target.localFileId))
              .catch(() => {});
          }
          // Mark any archived resolutions for this sticker as orphan so the
          // reminders view can show them as "source removed".
          const resolvedTodos = st.resolvedTodos.map((r) =>
            r.stickerId === id ? { ...r, sourceRemoved: true } : r
          );
          return {
            stickers: st.stickers.filter((sk) => sk.id !== id),
            resolvedTodos,
          };
        }),

      resolvedTodos: [],
      // Archive an entire to-do panel: snapshot all current items into the
      // resolved archive (marking the not-yet-done ones as panel-archived so
      // they're distinguishable in reminders), then remove the sticker.
      archiveTodoPanel: (stickerId) =>
        set((st) => {
          const target = st.stickers.find((s) => s.id === stickerId);
          if (!target || target.kind !== "todo") return st;
          const now = new Date().toISOString();
          const newArchives: ResolvedTodo[] = target.items.map((it) => ({
            id: uid("res"),
            itemId: it.id,
            text: it.text,
            listTitle: target.title || "To-do list",
            stickerId,
            sourceRemoved: true,
            panelArchived: true,
            resolvedAt: it.resolvedAt ?? now,
          }));
          // Drop prior archive entries from this sticker so the panel-archive
          // record is the authoritative one going forward.
          const otherArchives = st.resolvedTodos.filter(
            (r) => r.stickerId !== stickerId
          );
          return {
            stickers: st.stickers.filter((s) => s.id !== stickerId),
            resolvedTodos: [...newArchives, ...otherArchives],
          };
        }),
      unresolveTodo: (id) =>
        set((st) => {
          const r = st.resolvedTodos.find((x) => x.id === id);
          if (!r) return st;
          // If the source sticker is still around, flip the item back to open.
          const stickers = st.stickers.map((sk) => {
            if (sk.id !== r.stickerId || sk.kind !== "todo") return sk;
            return {
              ...sk,
              items: sk.items.map((it) =>
                it.id !== r.itemId
                  ? it
                  : { ...it, done: false, resolvedAt: undefined }
              ),
            };
          });
          return {
            stickers,
            resolvedTodos: st.resolvedTodos.filter((x) => x.id !== id),
          };
        }),
      removeResolvedTodo: (id) =>
        set((st) => ({
          resolvedTodos: st.resolvedTodos.filter((x) => x.id !== id),
        })),
      clearResolvedTodos: () => set({ resolvedTodos: [] }),

      quotes: [],
      addQuote: (q) =>
        set((st) => ({
          quotes: [
            { ...q, id: uid("quote"), addedAt: new Date().toISOString() },
            ...st.quotes,
          ],
        })),
      updateQuote: (id, patch) =>
        set((st) => ({
          quotes: st.quotes.map((q) => (q.id === id ? { ...q, ...patch } : q)),
        })),
      removeQuote: (id) =>
        set((st) => ({ quotes: st.quotes.filter((q) => q.id !== id) })),

      chatHistory: [],
      addChatExchange: (e) =>
        set((st) => {
          const next: ChatExchange = {
            ...e,
            id: uid("chat"),
            at: Date.now(),
          };
          // Newest first; trim past the cap so localStorage doesn't grow unbounded.
          const trimmed = [next, ...st.chatHistory].slice(0, MAX_CHAT_HISTORY);
          return { chatHistory: trimmed };
        }),
      removeChatExchange: (id) =>
        set((st) => ({
          chatHistory: st.chatHistory.filter((c) => c.id !== id),
        })),
      clearChatHistory: () => set({ chatHistory: [] }),
    }),
    {
      name: "citadel-store",
      version: 2,
      partialize: (s) => ({
        prefs: s.prefs,
        reminders: s.reminders,
        automations: s.automations,
        nodePositions: s.nodePositions,
        hiddenNodes: s.hiddenNodes,
        pinnedApps: s.pinnedApps,
        chatHistory: s.chatHistory,
        pinnedDocs: s.pinnedDocs,
        stickers: s.stickers,
        quotes: s.quotes,
        resolvedTodos: s.resolvedTodos,
      }),
      migrate: (persisted: unknown, fromVersion: number) => {
        if (!persisted || typeof persisted !== "object") return persisted;
        const p = persisted as { prefs?: Record<string, unknown> };
        if (fromVersion < 2 && p.prefs) {
          const old = p.prefs as Record<string, unknown> & { showGrid?: boolean };
          p.prefs = {
            ...old,
            gridIntensity: old.gridIntensity ?? (old.showGrid === false ? "off" : "normal"),
            minimalNodes: old.minimalNodes ?? false,
            accent: old.accent ?? "cyan",
          };
          delete (p.prefs as Record<string, unknown>).showGrid;
        }
        return persisted;
      },
    }
  )
);
