"use client";

// Shared client-side helper for talking to /api/ai/assistant. Every AI
// surface (Inbox "AI summary", "Draft reply", the side-panel chat, the
// dashboard assistant) routes through this so they all benefit from the
// same context-passing, error handling, action-application, and
// token-usage accounting.

import { useCallback, useState } from "react";
import { useCitadel } from "@/lib/store";
import {
  parseActions,
  describeAction,
  type AppliableAction,
  type ParsedAction,
} from "@/lib/ai/actions";

export type AssistantResponse = {
  reply: string;
  provider: string;
  model?: string;
  usage?: {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
  };
  contextsUsed?: {
    email?: boolean;
    spotify?: boolean;
    youtube?: boolean;
    github?: boolean;
    reminders?: boolean;
    stickers?: boolean;
    settings?: boolean;
  };
  accountCount?: number;
  // Whether Vertex stopped generating because we hit the output-token cap.
  // UI shows a small "TRUNCATED" chip so users know to ask "continue?".
  truncated?: boolean;
  finishReason?: string;
  // Filled in client-side after parsing the reply for action tags.
  appliedActions?: Array<{ description: string; raw: ParsedAction }>;
};

export async function askAssistant(input: {
  message: string;
  assistantName: string;
  provider?: "gemini" | "openai" | "claude";
  clientContext?: Record<string, unknown>;
}): Promise<AssistantResponse> {
  const res = await fetch("/api/ai/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: input.message,
      provider: input.provider ?? "gemini",
      assistantName: input.assistantName,
      clientContext: input.clientContext,
    }),
  });
  const body = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    const msg =
      (body as { message?: string; error?: string }).message ??
      (body as { error?: string }).error ??
      `error_${res.status}`;
    throw new Error(msg);
  }
  return body as AssistantResponse;
}

// React hook wrapping the assistant call. Reads the user's Zustand store to
// build the clientContext payload (reminders + stickers + current prefs)
// AND to apply any settings actions the model returned.
export function useAssistant() {
  const assistant = useCitadel((s) => s.prefs.assistant);
  const name = assistant?.name ?? "Sentinel";
  const provider = assistant?.provider ?? "gemini";
  const operatorName = useCitadel((s) => s.prefs.operatorName);

  // Whole-store snapshot used to build clientContext. Pulling everything
  // lazily inside `ask()` avoids re-rendering this hook on every store change.
  const reminders = useCitadel((s) => s.reminders);
  const stickers = useCitadel((s) => s.stickers);
  const resolvedTodos = useCitadel((s) => s.resolvedTodos);
  const prefs = useCitadel((s) => s.prefs);

  // Setters for every action the model can emit.
  const setAccent = useCitadel((s) => s.setAccent);
  const setCustomAccent = useCitadel((s) => s.setCustomAccent);
  const setGridIntensity = useCitadel((s) => s.setGridIntensity);
  const setMinimalNodes = useCitadel((s) => s.setMinimalNodes);
  const setAnimateEdges = useCitadel((s) => s.setAnimateEdges);
  const setShowMinimap = useCitadel((s) => s.setShowMinimap);
  const setViewMode = useCitadel((s) => s.setViewMode);
  const toggleSidebar = useCitadel((s) => s.toggleSidebar);
  const setRainbow = useCitadel((s) => s.setRainbow);

  const applyAction = useCallback(
    (a: ParsedAction): boolean => {
      const v = a.value;
      switch (a.action as AppliableAction) {
        case "setAccent":
          if (
            v &&
            ["cyan", "ice", "violet", "lime", "amber", "red"].includes(v)
          ) {
            // Clear any custom hex so the preset takes effect (mirrors the
            // Settings page UI behaviour).
            setCustomAccent(undefined);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setAccent(v as any);
            return true;
          }
          return false;
        case "setCustomAccent":
          if (v && /^#?[0-9a-f]{6}$/i.test(v)) {
            setCustomAccent(v.startsWith("#") ? v : `#${v}`);
            return true;
          }
          return false;
        case "setGridIntensity":
          if (v && ["off", "veryLight", "normal", "bold"].includes(v)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setGridIntensity(v as any);
            return true;
          }
          return false;
        case "setMinimalNodes":
          if (v === "true" || v === "false") {
            setMinimalNodes(v === "true");
            return true;
          }
          return false;
        case "setAnimateEdges":
          if (v === "true" || v === "false") {
            setAnimateEdges(v === "true");
            return true;
          }
          return false;
        case "setShowMinimap":
          if (v === "true" || v === "false") {
            setShowMinimap(v === "true");
            return true;
          }
          return false;
        case "setViewMode":
          if (v === "node" || v === "dashboard") {
            setViewMode(v);
            return true;
          }
          return false;
        case "toggleSidebar":
          toggleSidebar();
          return true;
        case "triggerRainbow":
          setRainbow(3 * 60 * 1000, "normal");
          return true;
        case "triggerRainbowSuper":
          setRainbow(3 * 60 * 1000, "super");
          return true;
      }
    },
    [
      setAccent,
      setCustomAccent,
      setGridIntensity,
      setMinimalNodes,
      setAnimateEdges,
      setShowMinimap,
      setViewMode,
      toggleSidebar,
      setRainbow,
    ]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<AssistantResponse | null>(null);

  const buildClientContext = useCallback(() => {
    return {
      operatorName,
      // Compact reminder snapshot — only what the model needs to answer.
      reminders: reminders.map((r) => ({
        title: r.title,
        description: r.description,
        priority: r.priority,
        dueAt: r.dueAt,
        complete: r.complete,
      })),
      stickers: stickers.map((s) => {
        if (s.kind === "todo") {
          const items = s.items ?? [];
          return {
            kind: "todo" as const,
            title: s.title,
            itemCount: items.length,
            openCount: items.filter((i) => !i.done).length,
          };
        }
        if (s.kind === "sticky") {
          return { kind: "sticky" as const, text: s.text, color: s.color };
        }
        if (s.kind === "text") {
          return { kind: "text" as const, text: s.text };
        }
        return { kind: "image" as const };
      }),
      resolvedTodos: resolvedTodos.length,
      currentPrefs: {
        accent: prefs.accent,
        customAccent: prefs.customAccent,
        gridIntensity: prefs.gridIntensity,
        minimalNodes: prefs.minimalNodes,
        animateEdges: prefs.animateEdges,
        showMinimap: prefs.showMinimap,
        viewMode: prefs.viewMode,
        sidebarCollapsed: prefs.sidebarCollapsed,
      },
    };
  }, [operatorName, reminders, stickers, resolvedTodos, prefs]);

  const ask = useCallback(
    async (message: string) => {
      setLoading(true);
      setError(null);
      try {
        const r = await askAssistant({
          message,
          assistantName: name,
          provider,
          clientContext: buildClientContext(),
        });
        // Apply any actions emitted, strip them from visible reply.
        const { actions, cleaned } = parseActions(r.reply);
        const applied = actions
          .filter((a) => applyAction(a))
          .map((a) => ({ description: describeAction(a), raw: a }));
        const annotated: AssistantResponse = {
          ...r,
          reply: cleaned,
          appliedActions: applied,
        };
        setReply(annotated);
        return annotated;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "ai_failed";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [name, provider, buildClientContext, applyAction]
  );

  const reset = useCallback(() => {
    setReply(null);
    setError(null);
  }, []);

  return { ask, loading, error, reply, reset, name, provider };
}
