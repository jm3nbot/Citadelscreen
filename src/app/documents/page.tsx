"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useCitadel } from "@/lib/store";
import { useDrive, useAuthStatus } from "@/lib/hooks";
import { ConnectGoogle } from "@/components/citadel/ConnectGoogle";
import { DocViewer } from "@/components/citadel/DocViewer";
import { saveLocalFile } from "@/lib/local-files";
import type { PinnedDoc, PinnedDocKind } from "@/lib/types";
import type { DriveFile } from "@/app/api/drive/route";
import {
  FileText,
  Table2,
  Presentation,
  FileType2,
  File as FileIcon,
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  Pin,
  Link as LinkIcon,
  Upload,
  Search,
  HardDriveDownload,
} from "lucide-react";

const kindMeta: Record<
  PinnedDocKind,
  { label: string; icon: typeof FileIcon; tint: string; chip: string }
> = {
  doc: {
    label: "Doc",
    icon: FileText,
    tint: "text-sky-300",
    chip: "border-sky-300/20 bg-sky-300/[0.06] text-sky-200",
  },
  sheet: {
    label: "Sheet",
    icon: Table2,
    tint: "text-emerald-300",
    chip: "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200",
  },
  slides: {
    label: "Slides",
    icon: Presentation,
    tint: "text-amber-300",
    chip: "border-amber-300/20 bg-amber-300/[0.06] text-amber-200",
  },
  pdf: {
    label: "PDF",
    icon: FileType2,
    tint: "text-rose-300",
    chip: "border-rose-300/20 bg-rose-300/[0.06] text-rose-200",
  },
  file: {
    label: "File",
    icon: FileIcon,
    tint: "text-white/80",
    chip: "border-white/[0.08] bg-white/[0.04] text-muted",
  },
};

// Best-effort kind detection from a URL (used in the manual-add flow).
function detectKind(url: string): PinnedDocKind {
  if (/docs\.google\.com\/document/i.test(url)) return "doc";
  if (/docs\.google\.com\/spreadsheets/i.test(url)) return "sheet";
  if (/docs\.google\.com\/presentation/i.test(url)) return "slides";
  if (/\.pdf(\?|$)/i.test(url)) return "pdf";
  return "file";
}

function kindFromMime(mime: string): PinnedDocKind {
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("spreadsheet")) return "sheet";
  if (mime.includes("presentation")) return "slides";
  if (mime.includes("document") || mime.startsWith("text/")) return "doc";
  return "file";
}

function kindFromDriveMime(mime: string): PinnedDocKind {
  if (mime.includes("spreadsheet")) return "sheet";
  if (mime.includes("presentation")) return "slides";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("document")) return "doc";
  return "file";
}

function formatBytes(n?: number): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const docs = useCitadel((s) => s.pinnedDocs);
  const addPinnedDoc = useCitadel((s) => s.addPinnedDoc);
  const removePinnedDoc = useCitadel((s) => s.removePinnedDoc);

  const [showAdd, setShowAdd] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [draftKind, setDraftKind] = useState<PinnedDocKind | "auto">("auto");
  const [viewing, setViewing] = useState<PinnedDoc | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    (async () => {
      try {
        for (const file of Array.from(files)) {
          // Soft cap — IndexedDB can do much more, but warn if a single file
          // is over 100MB to surface unexpected huge uploads.
          if (file.size > 100 * 1024 * 1024) {
            throw new Error(
              `"${file.name}" is over 100MB — too large for the browser store.`
            );
          }
          const rec = await saveLocalFile(file);
          addPinnedDoc({
            title: file.name,
            url: "",
            kind: kindFromMime(file.type),
            localFileId: rec.id,
            mimeType: rec.mimeType,
            size: rec.size,
            description: `Local upload · ${formatBytes(rec.size)}`,
          });
        }
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "upload_failed");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    })();
  };

  const onAddManual = () => {
    const title = draftTitle.trim();
    const url = draftUrl.trim();
    if (!title || !url) return;
    addPinnedDoc({
      title,
      url,
      kind: draftKind === "auto" ? detectKind(url) : draftKind,
    });
    setDraftTitle("");
    setDraftUrl("");
    setDraftKind("auto");
    setShowAdd(false);
  };

  return (
    <div className="h-full overflow-auto bg-dot-grid">
      <div className="mx-auto max-w-[1400px] px-6 py-7">
        <PageHeader
          tag="documents · pinned"
          title="Your working set."
          subtitle="Pin the docs, sheets, and files you reach for most. One click to open, one to edit."
          right={
            <div className="flex items-center gap-2">
              <ConnectGoogle compact />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => onPickFiles(e.target.files)}
                accept="application/pdf,image/*,text/*,.csv,.txt,.md"
              />
              <Button
                size="sm"
                variant="default"
                icon={<Upload className="h-3.5 w-3.5" />}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Uploading…" : "Upload from PC"}
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setShowAdd((v) => !v)}
              >
                Pin link
              </Button>
            </div>
          }
        />

        {uploadError && (
          <div className="mb-4 rounded-lg border border-rose-300/25 bg-rose-300/[0.05] px-3 py-2 text-[11.5px] text-rose-200">
            {uploadError}
          </div>
        )}

        <DriveSearchPanel onPin={addPinnedDoc} />


        <AnimatePresence initial={false}>
          {showAdd && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <Card className="mb-4">
                <div className="mono-tag mb-2">add · paste a link</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Title — e.g. Weekly review"
                    className="md:col-span-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12.5px] text-white placeholder:text-muted-soft focus:border-accent/40 focus:outline-none"
                  />
                  <input
                    value={draftUrl}
                    onChange={(e) => setDraftUrl(e.target.value)}
                    placeholder="https://docs.google.com/document/d/…"
                    className="md:col-span-5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12.5px] text-white placeholder:text-muted-soft focus:border-accent/40 focus:outline-none"
                  />
                  <select
                    value={draftKind}
                    onChange={(e) =>
                      setDraftKind(e.target.value as PinnedDocKind | "auto")
                    }
                    className="md:col-span-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12.5px] text-white focus:border-accent/40 focus:outline-none"
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="doc">Doc</option>
                    <option value="sheet">Sheet</option>
                    <option value="slides">Slides</option>
                    <option value="pdf">PDF</option>
                    <option value="file">File</option>
                  </select>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={onAddManual}
                    className="md:col-span-1"
                  >
                    Pin
                  </Button>
                </div>
                <p className="mt-2 text-[10.5px] text-muted">
                  Tip — paste any Google Docs / Sheets / Slides URL. Auto-detect
                  picks the right type from the URL pattern.
                </p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {docs.length === 0 ? (
          <Card>
            <div className="py-8 text-center">
              <Pin className="mx-auto h-5 w-5 text-muted-soft" strokeWidth={1.6} />
              <div className="mt-2 text-[13px] text-white">No pinned documents yet.</div>
              <div className="mt-1 text-[11.5px] text-muted">
                Click <span className="text-white">Pin document</span> above to add your first one.
              </div>
            </div>
          </Card>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            <AnimatePresence initial={false}>
              {docs.map((d) => (
                <DocCard
                  key={d.id}
                  doc={d}
                  onRemove={() => removePinnedDoc(d.id)}
                  onOpen={() => setViewing(d)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        <DriveSuggestionsRow />
      </div>

      <DocViewer doc={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function DocCard({
  doc,
  onRemove,
  onOpen,
}: {
  doc: PinnedDoc;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const meta = kindMeta[doc.kind];
  const KindIcon = meta.icon;
  // "Open" launches the in-app viewer modal; "Edit" routes the same way since
  // Google's URL gives edit access when the embed actually loads. New-tab is
  // available from inside the viewer + via cmd-click on the buttons.
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
    >
      <Card className="group flex h-full flex-col">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]"
            )}
          >
            <KindIcon className={cn("h-5 w-5", meta.tint)} strokeWidth={1.6} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[14px] font-medium tracking-tight text-white">
                {doc.title}
              </h3>
              <span
                className={cn(
                  "rounded-md border px-1.5 py-px text-[9px] tracking-wider",
                  meta.chip
                )}
              >
                {meta.label.toUpperCase()}
              </span>
            </div>
            {doc.description && (
              <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-muted">
                {doc.description}
              </p>
            )}
            <div className="mt-1 text-[10px] text-muted-soft">
              Pinned {formatRelativeTime(doc.addedAt)}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={onRemove}
            title="Unpin"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted opacity-0 transition-all hover:border-rose-300/30 hover:text-rose-300 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
          </button>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              icon={<ExternalLink className="h-3.5 w-3.5" />}
              onClick={onOpen}
            >
              Open
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={<Pencil className="h-3.5 w-3.5" />}
              onClick={onOpen}
            >
              Edit
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// Live search across the user's Google Drive — debounced, only fires when
// signed in. The same pin/open affordances as the cards above.
function DriveSearchPanel({
  onPin,
}: {
  onPin: (doc: Omit<PinnedDoc, "id" | "addedAt">) => void;
}) {
  const { signedIn } = useAuthStatus();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "docs" | "sheets" | "slides" | "pdf">(
    "all"
  );
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const params = new URLSearchParams();
  if (debounced) params.set("q", debounced);
  if (filter !== "all") params.set("type", filter);
  params.set("limit", "12");
  const key = signedIn && debounced ? `/api/drive?${params.toString()}` : null;
  const { data, isLoading } = useSWR<{ files?: DriveFile[]; error?: string }>(key);
  const results = data?.files ?? [];
  const pinned = useCitadel((s) => s.pinnedDocs);
  const pinnedUrls = new Set(pinned.map((p) => p.url));

  if (!signedIn) {
    return (
      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-muted">
            <Search className="h-4 w-4" strokeWidth={1.6} />
          </div>
          <div className="flex-1">
            <div className="text-[13px] tracking-tight text-white">
              Drive search
            </div>
            <div className="mt-0.5 text-[11.5px] text-muted">
              Connect Google to search your Drive for docs, sheets, slides, and PDFs.
            </div>
          </div>
          <ConnectGoogle compact />
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <div className="flex items-center gap-2">
        <Search className="h-3.5 w-3.5 text-muted-soft" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your Google Drive…"
          className="flex-1 bg-transparent px-1 py-1 text-[12.5px] text-white placeholder:text-muted-soft focus:outline-none"
        />
        <div className="flex gap-1">
          {(["all", "docs", "sheets", "slides", "pdf"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-2 py-1 text-[10.5px] tracking-wider uppercase transition-colors",
                filter === f
                  ? "bg-accent/[0.10] text-white"
                  : "text-muted hover:bg-white/[0.03] hover:text-white"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {debounced && (
        <div className="mt-3 max-h-[280px] overflow-auto rounded-lg border border-white/[0.05] bg-black/20">
          {isLoading && (
            <div className="px-3 py-3 text-[11.5px] text-muted">Searching…</div>
          )}
          {!isLoading && results.length === 0 && (
            <div className="px-3 py-3 text-[11.5px] text-muted">
              No files match <span className="text-white">"{debounced}"</span>.
            </div>
          )}
          <ul className="divide-y divide-white/[0.04]">
            {results.map((f) => {
              const kind = kindFromDriveMime(f.mimeType);
              const m = kindMeta[kind];
              const K = m.icon;
              const already = f.webViewLink && pinnedUrls.has(f.webViewLink);
              return (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-white/[0.015]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <K className={cn("h-4 w-4 shrink-0", m.tint)} strokeWidth={1.6} />
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] text-white">{f.name}</div>
                      <div className="text-[10px] text-muted-soft">
                        {kind.toUpperCase()} · modified{" "}
                        {new Date(f.modifiedTime).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <a href={f.webViewLink ?? "#"} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="subtle" icon={<ExternalLink className="h-3 w-3" />}>
                        Open
                      </Button>
                    </a>
                    <Button
                      size="sm"
                      variant={already ? "subtle" : "primary"}
                      disabled={!!already || !f.webViewLink}
                      icon={<Pin className="h-3 w-3" />}
                      onClick={() => {
                        if (!f.webViewLink) return;
                        onPin({
                          title: f.name,
                          url: f.webViewLink,
                          kind,
                          driveId: f.id,
                        });
                      }}
                    >
                      {already ? "Pinned" : "Pin"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!debounced && (
        <div className="mt-2 flex items-center gap-2 text-[10.5px] text-muted-soft">
          <HardDriveDownload className="h-3 w-3" />
          Live-searches your Drive across docs, sheets, slides, and PDFs.
        </div>
      )}
    </Card>
  );
}

// Suggest recently-modified Drive items the user can pin in one click — only
// renders when they're signed in. Falls silent in sample mode.
function DriveSuggestionsRow() {
  const { files, live, loading } = useDrive();
  const addPinnedDoc = useCitadel((s) => s.addPinnedDoc);
  const pinned = useCitadel((s) => s.pinnedDocs);
  const pinnedUrls = new Set(pinned.map((p) => p.url));

  if (!live) return null;
  const candidates = files
    .filter((f) => f.webViewLink && !pinnedUrls.has(f.webViewLink))
    .slice(0, 6);
  if (!loading && candidates.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center gap-2">
        <Icon name="drive" className="h-3.5 w-3.5" />
        <span className="mono-tag">from drive · recent</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((f) => {
          const kind: PinnedDocKind =
            f.mimeType.includes("spreadsheet")
              ? "sheet"
              : f.mimeType.includes("presentation")
              ? "slides"
              : f.mimeType.includes("pdf")
              ? "pdf"
              : f.mimeType.includes("document")
              ? "doc"
              : "file";
          const m = kindMeta[kind];
          const K = m.icon;
          return (
            <div
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <K className={cn("h-4 w-4 shrink-0", m.tint)} strokeWidth={1.6} />
                <span className="truncate text-[12px] text-white">{f.name}</span>
              </div>
              <Button
                size="sm"
                variant="subtle"
                icon={<LinkIcon className="h-3 w-3" />}
                onClick={() =>
                  addPinnedDoc({
                    title: f.name,
                    url: f.webViewLink ?? "",
                    kind,
                    driveId: f.id,
                  })
                }
              >
                Pin
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
