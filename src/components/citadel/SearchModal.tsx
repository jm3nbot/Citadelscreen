"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Search, Mail, FileText as DocIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCitadel } from "@/lib/store";
import type { UnifiedMail } from "@/app/api/unified-mail/route";

// Global search modal. Currently scoped to:
//   - Emails across all connected Google accounts (via /api/unified-mail)
//   - Pinned documents (local store)
// Future: extend to stickers + reminders + automations once we have more
// data sources. The structure here is deliberately one-shot fetch on open
// rather than per-keystroke — keystroke latency is then zero.

type SearchHit =
  | {
      kind: "email";
      id: string;
      title: string;
      subtitle: string;
      meta: string;
      source?: string;
      navigate: string;
    }
  | {
      kind: "doc";
      id: string;
      title: string;
      subtitle: string;
      meta: string;
      navigate: string;
    };

function fuzzyMatch(query: string, text: string): boolean {
  // Simple case-insensitive contains. Good enough for personal inboxes /
  // dozens-of-docs scale; can swap for fuse.js later.
  if (!query) return true;
  return text.toLowerCase().includes(query.toLowerCase());
}

export function SearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pinnedDocs = useCitadel((s) => s.pinnedDocs);
  const setRainbow = useCitadel((s) => s.setRainbow);
  // Slash-command catalogue. Extensible — add more entries to grow the
  // search bar into a real palette. /rainbow is the only one wired today.
  const COMMANDS: Array<{
    name: string;
    label: string;
    run: () => void;
  }> = [
    {
      name: "/rainbow",
      label: "Cycle accent through every hue for 3 minutes",
      run: () => {
        setRainbow(3 * 60 * 1000, "normal");
        onClose();
      },
    },
    {
      name: "/rainbowsuper",
      label: "Hyper rainbow — 3-second cycle + 30% brighter glow for 3 min",
      run: () => {
        setRainbow(3 * 60 * 1000, "super");
        onClose();
      },
    },
  ];
  const slash = q.trim().toLowerCase().startsWith("/")
    ? COMMANDS.find((c) => c.name === q.trim().toLowerCase())
    : undefined;

  // Only fetch unified mail while the modal is open — keeps the rest of the
  // app's polling load unchanged.
  const { data, isLoading } = useSWR<{ emails?: UnifiedMail[] }>(
    open ? "/api/unified-mail" : null
  );
  const emails = data?.emails ?? [];

  // Focus on open + reset query.
  useEffect(() => {
    if (open) {
      setQ("");
      // Defer a frame so the input is mounted.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // ESC closes + lock scroll while open.
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

  const hits = useMemo<SearchHit[]>(() => {
    if (!q.trim() && !open) return [];
    const term = q.trim();

    const emailHits: SearchHit[] = emails
      .filter((e) =>
        fuzzyMatch(
          term,
          `${e.subject} ${e.from} ${e.fromEmail ?? ""} ${e.snippet}`
        )
      )
      .slice(0, 12)
      .map((e) => ({
        kind: "email",
        id: e.id,
        title: e.subject,
        subtitle: `${e.from} · ${e.snippet}`.slice(0, 120),
        meta: e.source.email,
        source: e.source.email,
        navigate: `/inbox?focus=${e.id}`,
      }));

    const docHits: SearchHit[] = pinnedDocs
      .filter((d) =>
        fuzzyMatch(term, `${d.title} ${d.description ?? ""} ${d.kind}`)
      )
      .slice(0, 8)
      .map((d) => ({
        kind: "doc",
        id: d.id,
        title: d.title,
        subtitle: d.description ?? `${d.kind.toUpperCase()} · pinned doc`,
        meta: d.kind.toUpperCase(),
        navigate: `/documents`,
      }));

    // Empty query → show recent emails + recent docs as a peek.
    if (!term) return [...emailHits.slice(0, 6), ...docHits.slice(0, 4)];
    return [...emailHits, ...docHits];
  }, [q, emails, pinnedDocs, open]);

  const navigate = (path: string) => {
    onClose();
    router.push(path);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[120] flex items-start justify-center bg-black/65 p-4 pt-[14vh] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: 0.16 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[min(640px,95vw)] overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-100 shadow-panel"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
              <Search className="h-4 w-4 text-muted-soft" strokeWidth={1.8} />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  // Enter on a recognised slash command runs it.
                  if (e.key === "Enter" && slash) {
                    e.preventDefault();
                    slash.run();
                  }
                }}
                placeholder="Search emails, documents… (try /rainbow)"
                className="flex-1 bg-transparent text-[14px] text-white placeholder:text-muted-soft focus:outline-none"
              />
              <kbd className="rounded border border-white/[0.10] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-muted-soft">
                Esc
              </kbd>
              <button
                onClick={onClose}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted-soft hover:text-white"
                aria-label="Close search"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {/* Slash-command hit: a single fat row that runs the command
                  on click or on Enter. Sits above search results so it's
                  obviously the primary action when typing /something. */}
              {slash && (
                <button
                  onClick={slash.run}
                  className="flex w-full items-start gap-3 border-b border-white/[0.06] bg-accent/[0.04] px-4 py-3 text-left transition-colors hover:bg-accent/[0.08]"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-accent/30 bg-accent/[0.10] text-accent">
                    <span className="font-mono text-[11px]">/</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[12.5px] text-white">
                      {slash.name}
                    </div>
                    <div className="text-[11px] text-muted">{slash.label}</div>
                  </div>
                  <kbd className="rounded border border-white/[0.10] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-muted-soft">
                    ↵ run
                  </kbd>
                </button>
              )}
              {isLoading && hits.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12px] text-muted">
                  Loading…
                </div>
              ) : hits.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12px] text-muted">
                  {q.trim()
                    ? `No matches for "${q}"`
                    : "Type to search across your inboxes and pinned docs."}
                </div>
              ) : (
                <ul className="py-2">
                  {hits.map((h) => (
                    <li key={`${h.kind}:${h.id}`}>
                      <button
                        onClick={() => navigate(h.navigate)}
                        className="flex w-full items-start gap-3 px-4 py-2 text-left transition-colors hover:bg-white/[0.025]"
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                            h.kind === "email"
                              ? "border-amber-200/20 bg-amber-200/[0.04] text-amber-200"
                              : "border-sky-300/20 bg-sky-300/[0.04] text-sky-300"
                          )}
                        >
                          {h.kind === "email" ? (
                            <Mail className="h-3.5 w-3.5" strokeWidth={1.7} />
                          ) : (
                            <DocIcon className="h-3.5 w-3.5" strokeWidth={1.7} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] text-white">
                            {h.title}
                          </div>
                          <div className="truncate text-[11px] text-muted">
                            {h.subtitle}
                          </div>
                        </div>
                        <div className="shrink-0 text-[10px] uppercase tracking-wider text-muted-soft">
                          {h.meta}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-white/[0.05] bg-ink-50/80 px-4 py-2 text-[10.5px] text-muted-soft">
              {hits.length} result{hits.length === 1 ? "" : "s"} ·{" "}
              <kbd className="rounded border border-white/[0.10] bg-white/[0.04] px-1 py-px text-[9px]">
                ↵
              </kbd>{" "}
              to open
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
