"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { useCitadel } from "@/lib/store";
import { initialNodes } from "@/lib/data/nodes";
import { Icon } from "@/components/ui/Icon";
const GmailPanel = dynamic(() => import("./panels/GmailPanel").then((m) => m.GmailPanel), { loading: PanelLoading });
const CalendarPanel = dynamic(() => import("./panels/CalendarPanel").then((m) => m.CalendarPanel), { loading: PanelLoading });
const N8nPanel = dynamic(() => import("./panels/N8nPanel").then((m) => m.N8nPanel), { loading: PanelLoading });
const RemindersPanel = dynamic(() => import("./panels/RemindersPanel").then((m) => m.RemindersPanel), { loading: PanelLoading });
const AiPanel = dynamic(() => import("./panels/AiPanel").then((m) => m.AiPanel), { loading: PanelLoading });
const GenericAppPanel = dynamic(() => import("./panels/GenericAppPanel").then((m) => m.GenericAppPanel), { loading: PanelLoading });
const CitadelCorePanel = dynamic(() => import("./panels/CitadelCorePanel").then((m) => m.CitadelCorePanel), { loading: PanelLoading });
const DrivePanel = dynamic(() => import("./panels/DrivePanel").then((m) => m.DrivePanel), { loading: PanelLoading });
const SpotifyPanel = dynamic(() => import("./panels/SpotifyPanel").then((m) => m.SpotifyPanel), { loading: PanelLoading });
const YouTubePanel = dynamic(() => import("./panels/YouTubePanel").then((m) => m.YouTubePanel), { loading: PanelLoading });
const GitHubPanel = dynamic(() => import("./panels/GitHubPanel").then((m) => m.GitHubPanel), { loading: PanelLoading });

function PanelLoading() {
  return <div role="status" aria-label="Loading panel" className="h-24 animate-pulse rounded bg-white/[0.04]" />;
}

export function SidePanel() {
  const selectedNodeId = useCitadel((s) => s.selectedNodeId);
  const setSelectedNodeId = useCitadel((s) => s.setSelectedNodeId);
  const node = selectedNodeId
    ? initialNodes.find((n) => n.id === selectedNodeId)
    : null;

  return (
    <AnimatePresence>
      {node && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setSelectedNodeId(null)}
          />
          <motion.aside
            key="panel"
            initial={{ x: 32, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 32, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-3 top-3 bottom-3 z-40 w-[420px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-white/[0.07] glass shadow-panel"
          >
            <header className="flex items-start justify-between gap-3 border-b border-white/[0.05] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <Icon name={node.icon} className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <div className="mono-tag">{node.kind} · {node.category}</div>
                  <h2 className="mt-0.5 text-[16px] font-medium tracking-tight text-white">
                    {node.label}
                  </h2>
                  {node.description && (
                    <p className="mt-0.5 text-[11.5px] text-muted">{node.description}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.05] bg-white/[0.02] text-muted hover:border-white/[0.12] hover:text-white"
                aria-label="Close panel"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.7} />
              </button>
            </header>

            <div className="h-[calc(100%-72px)] overflow-y-auto p-5">
              {node.id === "citadel" && <CitadelCorePanel />}
              {node.id === "gmail" && <GmailPanel />}
              {node.id === "calendar" && <CalendarPanel />}
              {node.id === "n8n" && <N8nPanel />}
              {node.id === "reminders" && <RemindersPanel />}
              {node.id === "drive" && <DrivePanel />}
              {node.id === "docs" && <DrivePanel filter="docs" />}
              {node.id === "sheets" && <DrivePanel filter="sheets" />}
              {node.id === "spotify" && <SpotifyPanel />}
              {node.id === "youtube" && <YouTubePanel />}
              {node.id === "github" && <GitHubPanel />}
              {(node.id === "chatgpt" || node.id === "claude" || node.id === "gemini") && (
                <AiPanel name={node.label} nodeId={node.id} />
              )}
              {![
                "citadel",
                "gmail",
                "calendar",
                "n8n",
                "reminders",
                "drive",
                "docs",
                "sheets",
                "spotify",
                "youtube",
                "github",
                "chatgpt",
                "claude",
                "gemini",
              ].includes(node.id) && <GenericAppPanel node={node} />}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
