"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  History as HistoryIcon,
  Settings2,
  Trash2,
  Zap,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AiMarkdown } from "./AiMarkdown";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useCitadel } from "@/lib/store";
import type { ChatExchange } from "@/lib/store";
import {
  PROVIDERS,
  NAME_SUGGESTIONS,
  type AIProvider,
} from "@/lib/ai/providers";

type Tab = "configure" | "history";

type StatusResp = {
  providers?: {
    gemini?: { configured?: boolean; model?: string; missing?: string[] };
    openai?: { configured?: boolean; byok?: boolean };
    claude?: { configured?: boolean; byok?: boolean };
  };
};

export function AiAssistantConfigModal({
  open,
  onClose,
  name,
  provider,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  provider: AIProvider;
  onSave: (patch: { name?: string; provider?: AIProvider }) => void;
}) {
  const [draftName, setDraftName] = useState(name);
  const [draftProvider, setDraftProvider] = useState<AIProvider>(provider);
  const [tab, setTab] = useState<Tab>("configure");

  // Reset draft state on open so the modal always reflects current store.
  useEffect(() => {
    if (open) {
      setDraftName(name);
      setDraftProvider(provider);
      setTab("configure");
    }
  }, [open, name, provider]);

  // ESC / scroll lock.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const { data: status } = useSWR<StatusResp>(
    open ? "/api/ai/status" : null
  );

  const apply = () => {
    onSave({
      name: draftName.trim() || "Sentinel",
      provider: draftProvider,
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[min(560px,95vw)] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#06070a] shadow-panel"
          >
            <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] bg-black/40 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/25 bg-accent/[0.08] text-accent">
                  <Cpu className="h-4 w-4" strokeWidth={1.7} />
                </div>
                <div>
                  <div className="mono-tag">ai · configure</div>
                  <h2 className="mt-0.5 text-[15px] font-medium tracking-tight text-white">
                    Configure assistant
                  </h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted hover:border-white/[0.12] hover:text-white"
                title="Close (Esc)"
                aria-label="Close configure modal"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </header>

            {/* Tab strip — Configure / History */}
            <div className="flex items-center gap-1 border-b border-white/[0.04] bg-black/30 px-5 py-2">
              <TabButton
                active={tab === "configure"}
                onClick={() => setTab("configure")}
                icon={<Settings2 className="h-3 w-3" strokeWidth={1.8} />}
                label="Configure"
              />
              <TabButton
                active={tab === "history"}
                onClick={() => setTab("history")}
                icon={<HistoryIcon className="h-3 w-3" strokeWidth={1.8} />}
                label="History"
              />
            </div>

            {tab === "history" ? (
              <HistoryPanel />
            ) : (
            <div className="space-y-5 px-5 py-5">
              {/* Name */}
              <div>
                <label className="mb-1.5 block text-[11.5px] tracking-tight text-white">
                  Name your assistant
                </label>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  maxLength={64}
                  placeholder="Sentinel"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[14px] text-white placeholder:text-muted-soft focus:border-accent/40 focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {NAME_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setDraftName(s)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[10.5px] tracking-tight transition-colors",
                        draftName === s
                          ? "border-accent/40 bg-accent/[0.08] text-white"
                          : "border-white/[0.06] bg-white/[0.015] text-muted hover:text-white"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Provider picker */}
              <div>
                <div className="mb-2 text-[11.5px] tracking-tight text-white">
                  Provider
                </div>
                <div className="space-y-2">
                  {PROVIDERS.map((p) => {
                    const active = draftProvider === p.id;
                    // Gemini status has model+missing; others have byok only.
                    // Cast at the access site rather than fight TS union narrowing.
                    const geminiStatus =
                      p.id === "gemini" ? status?.providers?.gemini : undefined;
                    const configured = p.id === "gemini" && !!geminiStatus?.configured;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setDraftProvider(p.id)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all",
                          active
                            ? "border-accent/40 bg-accent/[0.05] shadow-glow-sm"
                            : "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.16]"
                        )}
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                            active
                              ? "border-accent bg-accent text-white"
                              : "border-white/[0.16]"
                          )}
                        >
                          {active && (
                            <Check className="h-2.5 w-2.5 text-ink-100" strokeWidth={3} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium tracking-tight text-white">
                              {p.label}
                            </span>
                            {p.id === "gemini" ? (
                              configured ? (
                                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300/25 bg-emerald-300/[0.05] px-1.5 py-px text-[9.5px] tracking-wider text-emerald-200">
                                  <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={2} />
                                  ADC READY
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/25 bg-amber-300/[0.05] px-1.5 py-px text-[9.5px] tracking-wider text-amber-200">
                                  <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2} />
                                  CONFIG NEEDED
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-px text-[9.5px] tracking-wider text-muted">
                                <Lock className="h-2.5 w-2.5" strokeWidth={2} />
                                BYOK
                              </span>
                            )}
                            {p.id === "gemini" && geminiStatus?.model && (
                              <span className="ml-auto font-mono text-[10px] text-muted">
                                {geminiStatus.model}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-muted">
                            {p.description}
                          </p>
                          {p.id === "gemini" &&
                            !configured &&
                            geminiStatus?.missing &&
                            geminiStatus.missing.length > 0 && (
                              <p className="mt-1 text-[10.5px] text-amber-200/80">
                                Missing env: <code className="text-white">{geminiStatus.missing.join(", ")}</code>
                              </p>
                            )}
                          {!p.implemented && (
                            <p className="mt-1 text-[10.5px] text-muted-soft">
                              Selecting this provider is allowed, but calls won't go through until you paste an API key in a future configure pass.
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            )}

            {/* Footer: only show Apply on Configure tab; History has its own
                trash control inline. */}
            {tab === "configure" ? (
              <footer className="flex items-center justify-end gap-2 border-t border-white/[0.06] bg-black/30 px-5 py-3">
                <Button variant="subtle" onClick={onClose}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={apply} icon={<Check className="h-3.5 w-3.5" />}>
                  Apply
                </Button>
              </footer>
            ) : (
              <footer className="flex items-center justify-end gap-2 border-t border-white/[0.06] bg-black/30 px-5 py-3">
                <Button variant="subtle" onClick={onClose}>
                  Close
                </Button>
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---- TabButton ----
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] tracking-tight transition-colors",
        active
          ? "bg-white/[0.04] text-white"
          : "text-muted hover:bg-white/[0.02] hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ---- HistoryPanel: shows previous chat exchanges, newest first ----
function HistoryPanel() {
  const chatHistory = useCitadel((s) => s.chatHistory);
  const removeChatExchange = useCitadel((s) => s.removeChatExchange);
  const clearChatHistory = useCitadel((s) => s.clearChatHistory);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (chatHistory.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.02] text-muted">
          <HistoryIcon className="h-4 w-4" strokeWidth={1.7} />
        </div>
        <div className="mt-3 text-[13px] tracking-tight text-white">
          No chat history yet
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
          Ask your assistant anything from the dashboard and the conversation
          will land here. History is saved locally to your browser.
        </p>
      </div>
    );
  }

  return (
    <div className="flex max-h-[55vh] flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.04] bg-black/20 px-5 py-2">
        <div className="text-[10.5px] tracking-wider uppercase text-muted-soft">
          {chatHistory.length} exchange{chatHistory.length === 1 ? "" : "s"} · newest first
        </div>
        <button
          onClick={() => {
            if (window.confirm(`Delete all ${chatHistory.length} saved exchanges?`)) {
              clearChatHistory();
            }
          }}
          className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[10.5px] text-muted hover:border-rose-300/30 hover:text-rose-300"
          title="Delete all history"
        >
          <Trash2 className="h-3 w-3" strokeWidth={1.8} />
          Clear all
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-3">
        <ul className="space-y-2">
          {chatHistory.map((c) => (
            <HistoryItem
              key={c.id}
              exchange={c}
              open={openIds.has(c.id)}
              onToggle={() => toggle(c.id)}
              onRemove={() => removeChatExchange(c.id)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function HistoryItem({
  exchange,
  open,
  onToggle,
  onRemove,
}: {
  exchange: ChatExchange;
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const c = exchange;
  const usedChips: string[] = [];
  if (c.contextsUsed?.email) usedChips.push("EMAIL");
  if (c.contextsUsed?.spotify) usedChips.push("SPOTIFY");
  if (c.contextsUsed?.youtube) usedChips.push("YOUTUBE");
  if (c.contextsUsed?.github) usedChips.push("GITHUB");
  if (c.contextsUsed?.reminders) usedChips.push("REMINDERS");
  if (c.contextsUsed?.stickers) usedChips.push("STICKERS");
  if (c.contextsUsed?.settings) usedChips.push("SETTINGS");

  return (
    <li className="rounded-lg border border-white/[0.05] bg-white/[0.015]">
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-white/[0.02]"
      >
        <div className="min-w-0 flex-1">
          <div className="line-clamp-1 text-[12.5px] tracking-tight text-white">
            {c.user}
          </div>
          <div className="mt-0.5 line-clamp-1 text-[11px] text-muted">
            {c.reply}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="text-[9.5px] tabular-nums text-muted-soft">
              {formatRelativeTime(new Date(c.at))} ago
            </span>
            {c.model && (
              <span className="font-mono text-[9.5px] text-muted-soft">
                · {c.model}
              </span>
            )}
            {c.totalTokens != null && c.totalTokens > 0 && (
              <span className="text-[9.5px] tabular-nums text-muted-soft">
                · {c.totalTokens.toLocaleString()}t
              </span>
            )}
            {usedChips.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-0.5 rounded-md border border-emerald-300/15 bg-emerald-300/[0.05] px-1 py-px text-[8.5px] tracking-wider text-emerald-200"
              >
                <Zap className="h-2 w-2" strokeWidth={2} />
                {chip}
              </span>
            ))}
          </div>
        </div>
        <div
          className="flex shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              navigator.clipboard.writeText(`Q: ${c.user}\n\nA: ${c.reply}`);
            }}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted-soft hover:border-accent/30 hover:text-white"
            title="Copy exchange to clipboard"
          >
            <Copy className="h-2.5 w-2.5" strokeWidth={1.8} />
          </button>
          <button
            onClick={onRemove}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted-soft hover:border-rose-300/30 hover:text-rose-300"
            title="Delete this exchange"
          >
            <Trash2 className="h-2.5 w-2.5" strokeWidth={1.8} />
          </button>
        </div>
      </button>
      {open && (
        <div className="border-t border-white/[0.04] px-3 py-3">
          <div className="mono-tag mb-1">you</div>
          <div className="mb-3 whitespace-pre-wrap text-[12px] text-white/90">
            {c.user}
          </div>
          <div className="mono-tag mb-1">assistant</div>
          <div className="text-[12px] leading-relaxed text-white/90">
            <AiMarkdown>{c.reply}</AiMarkdown>
          </div>
        </div>
      )}
    </li>
  );
}
