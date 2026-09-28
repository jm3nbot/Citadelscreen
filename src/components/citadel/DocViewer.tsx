"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, AlertTriangle, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { PinnedDoc } from "@/lib/types";
import { getLocalFileUrl } from "@/lib/local-files";

// Convert a typical Google Docs/Sheets/Slides URL to a maximally-embeddable variant.
//   - Sheets: appending `?widget=true&headers=false` gives a chrome-free embed view.
//   - Docs:   `?rm=minimal` strips most of the chrome.
//   - Slides: `/embed?…` is the canonical embed path.
// We strip any pre-existing query/fragment so we control the params.
function embedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname !== "docs.google.com") return url;
    const segments = u.pathname.split("/").filter(Boolean);
    // Path looks like ["document"|"spreadsheets"|"presentation", "d", "<id>", "edit", ...]
    const kind = segments[0];
    const id = segments[2];
    if (!id) return url;
    if (kind === "spreadsheets") {
      return `https://docs.google.com/spreadsheets/d/${id}/edit?widget=true&headers=false&rm=minimal`;
    }
    if (kind === "document") {
      return `https://docs.google.com/document/d/${id}/edit?rm=minimal`;
    }
    if (kind === "presentation") {
      return `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false`;
    }
    return url;
  } catch {
    return url;
  }
}

export function DocViewer({
  doc,
  onClose,
}: {
  doc: PinnedDoc | null;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [graceExpired, setGraceExpired] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  // For local files, we hydrate a blob URL from IndexedDB on open and revoke
  // it on close — leaks would otherwise accumulate across sessions.
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [localMime, setLocalMime] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // ESC to close + lock body scroll while open.
  useEffect(() => {
    if (!doc) return;
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
  }, [doc, onClose]);

  // Reset load state when a new doc opens.
  useEffect(() => {
    if (!doc) return;
    setLoaded(false);
    setGraceExpired(false);
    const t = setTimeout(() => setGraceExpired(true), 3500);
    return () => clearTimeout(t);
  }, [doc, iframeKey]);

  // Hydrate local-file blob on open. Revoke on close to free memory.
  useEffect(() => {
    if (!doc?.localFileId) {
      setLocalUrl(null);
      setLocalMime(null);
      setLocalError(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    (async () => {
      try {
        const hit = await getLocalFileUrl(doc.localFileId!);
        if (cancelled) {
          if (hit) URL.revokeObjectURL(hit.url);
          return;
        }
        if (!hit) {
          setLocalError("File not found in browser storage. It may have been cleared.");
          return;
        }
        createdUrl = hit.url;
        setLocalUrl(hit.url);
        setLocalMime(hit.mimeType);
      } catch (e) {
        if (!cancelled) setLocalError(e instanceof Error ? e.message : "open_failed");
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [doc?.localFileId]);

  const isLocal = !!doc?.localFileId;
  const src = doc ? (isLocal ? localUrl ?? "" : embedUrl(doc.url)) : "";
  // The X-Frame-Options blocked overlay only applies to Google embeds, not
  // local blobs (those always render in-frame).
  const blocked = !isLocal && doc && graceExpired && !loaded;

  return (
    <AnimatePresence>
      {doc && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-[92vh] w-[min(1280px,96vw)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-100 shadow-panel"
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] bg-ink-50/80 px-4 py-2.5 backdrop-blur-md">
              <div className="min-w-0 flex-1">
                <div className="mono-tag">{doc.kind}</div>
                <div className="truncate text-[13px] font-medium tracking-tight text-white">
                  {doc.title}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!isLocal && (
                  <Button
                    size="sm"
                    variant="subtle"
                    icon={<RefreshCw className="h-3.5 w-3.5" />}
                    onClick={() => setIframeKey((k) => k + 1)}
                    title="Reload"
                  >
                    Reload
                  </Button>
                )}
                {isLocal ? (
                  <a href={localUrl ?? "#"} download={doc.title}>
                    <Button
                      size="sm"
                      variant="default"
                      icon={<Download className="h-3.5 w-3.5" />}
                      disabled={!localUrl}
                    >
                      Download
                    </Button>
                  </a>
                ) : (
                  <a href={doc.url} target="_blank" rel="noreferrer">
                    <Button
                      size="sm"
                      variant="default"
                      icon={<ExternalLink className="h-3.5 w-3.5" />}
                    >
                      Open in new tab
                    </Button>
                  </a>
                )}
                <button
                  onClick={onClose}
                  title="Close (Esc)"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted transition-colors hover:border-white/[0.12] hover:text-white"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            </header>

            <div className="relative min-h-0 flex-1 bg-white">
              {isLocal && localError ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink-50/95 p-6">
                  <div className="max-w-md text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-rose-300/30 bg-rose-300/[0.08] text-rose-200">
                      <AlertTriangle className="h-5 w-5" strokeWidth={1.7} />
                    </div>
                    <h3 className="mt-3 text-[15px] font-medium tracking-tight text-white">
                      Couldn't load local file.
                    </h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">
                      {localError}
                    </p>
                  </div>
                </div>
              ) : isLocal && !localUrl ? (
                <div className="absolute inset-0 flex items-center justify-center bg-ink-50/80">
                  <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-muted">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                    Reading from browser storage…
                  </div>
                </div>
              ) : isLocal && localMime?.startsWith("image/") ? (
                // Images render via <img> for native zoom/aspect handling.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={localUrl ?? ""}
                  alt={doc.title}
                  onLoad={() => setLoaded(true)}
                  className="absolute inset-0 h-full w-full object-contain bg-ink-100"
                />
              ) : (
                <iframe
                  key={iframeKey}
                  src={src}
                  title={doc.title}
                  className="absolute inset-0 h-full w-full border-0"
                  onLoad={() => setLoaded(true)}
                  // sandbox left omitted intentionally — Google Docs needs full
                  // capabilities to function. We rely on X-Frame-Options for
                  // the security boundary, since the doc is on docs.google.com.
                  allow="clipboard-read; clipboard-write; encrypted-media"
                />
              )}

              {blocked && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink-50/95 p-6 backdrop-blur-sm">
                  <div className="max-w-md text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-amber-300/30 bg-amber-300/[0.08] text-amber-200">
                      <AlertTriangle className="h-5 w-5" strokeWidth={1.7} />
                    </div>
                    <h3 className="mt-3 text-[15px] font-medium tracking-tight text-white">
                      Google blocked the embed.
                    </h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">
                      Google Docs sends <code className="text-white">X-Frame-Options: SAMEORIGIN</code> on
                      unpublished documents, so they cannot be embedded outside <code className="text-white">docs.google.com</code>.
                      This is a Google security policy — every third-party app hits the same wall.
                    </p>
                    <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
                      Workaround — in Google Docs, <span className="text-white">File → Share → Publish to web</span> makes a doc embeddable here.
                      Otherwise use the button below to edit in a new tab.
                    </p>
                    <div className="mt-4 flex justify-center gap-2">
                      <a href={doc.url} target="_blank" rel="noreferrer">
                        <Button
                          variant="primary"
                          icon={<ExternalLink className="h-3.5 w-3.5" />}
                        >
                          Open in Google
                        </Button>
                      </a>
                      <Button
                        variant="default"
                        onClick={() => {
                          setLoaded(false);
                          setGraceExpired(false);
                          setIframeKey((k) => k + 1);
                        }}
                        icon={<RefreshCw className="h-3.5 w-3.5" />}
                      >
                        Try again
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {!loaded && !blocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-ink-50/80">
                  <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-muted">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                    Loading {doc.title}…
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
