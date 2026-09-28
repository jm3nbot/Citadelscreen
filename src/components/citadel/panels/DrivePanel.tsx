"use client";

import { useDrive } from "@/lib/hooks";
import { Icon } from "@/components/ui/Icon";
import { formatRelativeTime } from "@/lib/utils";
import { ExternalLink, RefreshCw } from "lucide-react";

function mimeToIcon(mime: string): string {
  if (mime.includes("document")) return "FileText";
  if (mime.includes("spreadsheet")) return "Table2";
  if (mime.includes("folder")) return "HardDrive";
  return "FileText";
}

function mimeLabel(mime: string): string {
  if (mime.includes("document")) return "Doc";
  if (mime.includes("spreadsheet")) return "Sheet";
  if (mime.includes("presentation")) return "Slides";
  if (mime.includes("folder")) return "Folder";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("image")) return "Image";
  return "File";
}

export function DrivePanel({ filter }: { filter?: "docs" | "sheets" }) {
  const { files, live, loading, refresh } = useDrive(filter);

  const title = filter === "docs" ? "Google Docs" : filter === "sheets" ? "Google Sheets" : "Google Drive";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="mono-tag">
          {live ? `live · ${filter ?? "drive"}` : `${filter ?? "drive"} · not connected`}
        </span>
        {live && (
          <button
            onClick={() => refresh()}
            className="text-muted-soft hover:text-white"
            title="Refresh"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {!live && (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4 text-[12px] leading-relaxed text-muted">
          Connect Google to load your real {title}. See the Settings panel for the connect button and setup guide.
        </div>
      )}

      {live && loading && (
        <div className="py-2 text-[11.5px] text-muted">Loading files…</div>
      )}

      {live && !loading && files.length === 0 && (
        <div className="py-2 text-[11.5px] text-muted">No files found.</div>
      )}

      <ul className="space-y-1">
        {files.map((f) => (
          <li
            key={f.id}
            className="group flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02]">
              <Icon name={mimeToIcon(f.mimeType)} className="h-3.5 w-3.5 text-white/80" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[12.5px] tracking-tight text-white">
                  {f.name}
                </span>
                <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-px text-[9px] tracking-wider text-muted">
                  {mimeLabel(f.mimeType).toUpperCase()}
                </span>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-muted">
                modified {formatRelativeTime(f.modifiedTime)}
              </div>
            </div>
            {f.webViewLink && (
              <a
                href={f.webViewLink}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-muted-soft opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                title="Open in Google"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
