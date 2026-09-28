"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Quote as QuoteIcon, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCitadel } from "@/lib/store";
import { cn, formatRelativeTime } from "@/lib/utils";

export function QuoteBookModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const quotes = useCitadel((s) => s.quotes);
  const addQuote = useCitadel((s) => s.addQuote);
  const removeQuote = useCitadel((s) => s.removeQuote);
  const updateQuote = useCitadel((s) => s.updateQuote);

  const [draftText, setDraftText] = useState("");
  const [draftAuthor, setDraftAuthor] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editAuthor, setEditAuthor] = useState("");

  // ESC to close + scroll lock.
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

  const onAdd = () => {
    const text = draftText.trim();
    if (!text) return;
    addQuote({ text, author: draftAuthor.trim() || undefined });
    setDraftText("");
    setDraftAuthor("");
  };

  const startEdit = (id: string, text: string, author?: string) => {
    setEditingId(id);
    setEditText(text);
    setEditAuthor(author ?? "");
  };
  const saveEdit = () => {
    if (!editingId) return;
    updateQuote(editingId, {
      text: editText.trim(),
      author: editAuthor.trim() || undefined,
    });
    setEditingId(null);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[88vh] w-[min(620px,94vw)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-100 shadow-panel"
          >
            <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] bg-ink-50/80 px-5 py-4 backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/30 bg-accent/[0.06] text-accent">
                  <QuoteIcon className="h-4 w-4" strokeWidth={1.7} />
                </div>
                <div>
                  <div className="mono-tag">quote book</div>
                  <h2 className="mt-0.5 text-[15px] font-medium tracking-tight text-white">
                    Words worth keeping
                  </h2>
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    Quotes here scroll across the top bar — pick what you want
                    to live with for a while.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted transition-colors hover:border-white/[0.12] hover:text-white"
                title="Close (Esc)"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </header>

            <div className="space-y-3 border-b border-white/[0.06] px-5 py-4">
              <div className="mono-tag">add</div>
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="The quote itself…"
                rows={2}
                className="w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] leading-relaxed text-white placeholder:text-muted-soft focus:border-accent/40 focus:outline-none"
              />
              <div className="flex gap-2">
                <input
                  value={draftAuthor}
                  onChange={(e) => setDraftAuthor(e.target.value)}
                  placeholder="Author (optional)"
                  className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12.5px] text-white placeholder:text-muted-soft focus:border-accent/40 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onAdd();
                  }}
                />
                <Button
                  variant="primary"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={onAdd}
                  disabled={!draftText.trim()}
                >
                  Add to book
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              <div className="mono-tag mb-2">
                {quotes.length === 0
                  ? "empty"
                  : `${quotes.length} quote${quotes.length === 1 ? "" : "s"}`}
              </div>
              {quotes.length === 0 ? (
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-8 text-center text-[12px] text-muted">
                  Nothing yet. Drop in something that should be in your peripheral vision today.
                </div>
              ) : (
                <ul className="space-y-2">
                  {quotes.map((q) => {
                    const editing = editingId === q.id;
                    return (
                      <li
                        key={q.id}
                        className={cn(
                          "group rounded-xl border bg-white/[0.015] px-4 py-3 transition-colors",
                          editing
                            ? "border-accent/30"
                            : "border-white/[0.05] hover:border-white/[0.10]"
                        )}
                      >
                        {editing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              rows={2}
                              className="w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] leading-relaxed text-white focus:border-accent/40 focus:outline-none"
                            />
                            <div className="flex gap-2">
                              <input
                                value={editAuthor}
                                onChange={(e) => setEditAuthor(e.target.value)}
                                placeholder="Author"
                                className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-white placeholder:text-muted-soft focus:border-accent/40 focus:outline-none"
                              />
                              <Button
                                size="sm"
                                variant="primary"
                                icon={<Check className="h-3.5 w-3.5" />}
                                onClick={saveEdit}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="subtle"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <QuoteIcon
                              className="mt-1 h-3.5 w-3.5 shrink-0 text-accent/60"
                              strokeWidth={1.8}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] leading-relaxed text-white">
                                {q.text}
                              </p>
                              <div className="mt-1 flex items-center gap-2 text-[10.5px] text-muted-soft">
                                {q.author && (
                                  <span className="text-muted">— {q.author}</span>
                                )}
                                <span>· added {formatRelativeTime(q.addedAt)}</span>
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                onClick={() => startEdit(q.id, q.text, q.author)}
                                title="Edit"
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted transition-colors hover:border-accent/30 hover:text-white"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => removeQuote(q.id)}
                                title="Delete"
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted transition-colors hover:border-rose-300/30 hover:text-rose-300"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
