"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AiCore } from "./AiCore";
import { AiMarkdown } from "./AiMarkdown";

// Generic modal for one-shot AI outputs that don't warrant a full chat
// surface — Inbox "AI summary" + "Draft reply with AI" both render here.
// The parent owns the loading + reply state via the useAssistant hook;
// we just present them with a copy-to-clipboard affordance.

export function AiActionModal({
  open,
  onClose,
  title,
  subtitle,
  loading,
  reply,
  error,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  loading: boolean;
  reply: string | null;
  error: string | null;
}) {
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

  const copy = async () => {
    if (!reply) return;
    try {
      await navigator.clipboard.writeText(reply);
    } catch {
      // navigator.clipboard fails on some non-https origins; fall back to
      // selecting the text area. For our local 127.0.0.1 use it works.
    }
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
            className="w-[min(620px,95vw)] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#06070a] shadow-panel"
          >
            <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] bg-black/40 px-5 py-4">
              <div className="flex items-center gap-3">
                <AiCore state={loading ? "thinking" : error ? "error" : "idle"} size={44} />
                <div>
                  <div className="mono-tag">ai · output</div>
                  <h2 className="mt-0.5 text-[15px] font-medium tracking-tight text-white">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted hover:border-white/[0.12] hover:text-white"
                title="Close (Esc)"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </header>

            <div className="px-5 py-5">
              {loading ? (
                <div className="flex items-center gap-3 text-[12.5px] text-muted">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse text-accent" />
                  Generating…
                </div>
              ) : error ? (
                <div className="flex items-start gap-3 rounded-lg border border-rose-300/25 bg-rose-300/[0.05] p-3 text-[12px] text-rose-200/90">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
                  <div>{error}</div>
                </div>
              ) : reply ? (
                <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-white/[0.06] bg-black/30 p-4">
                  <AiMarkdown>{reply}</AiMarkdown>
                </div>
              ) : (
                <div className="text-[12px] text-muted-soft">No output yet.</div>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-white/[0.06] bg-black/30 px-5 py-3">
              {reply && (
                <Button
                  size="sm"
                  variant="subtle"
                  icon={<Copy className="h-3.5 w-3.5" />}
                  onClick={copy}
                >
                  Copy
                </Button>
              )}
              <Button size="sm" variant="default" onClick={onClose}>
                Done
              </Button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
