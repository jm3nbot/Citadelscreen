"use client";

import { useEffect, useRef, useState } from "react";
import { type NodeProps, NodeResizer } from "reactflow";
import {
  X,
  Bold,
  Italic,
  Underline,
  Crop as CropIcon,
  Square,
  SquareDot,
  Minus,
  Plus,
  Pencil,
  Check,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCitadel } from "@/lib/store";
import { getLocalFileUrl, saveLocalFile, deleteLocalFile } from "@/lib/local-files";
import { ImageCropEditor } from "./ImageCropEditor";
import type { TextSticker } from "@/lib/types";

// Discriminated data shape so React Flow's dispatch can route by `kind`.
export type StickerNodeData =
  | {
      kind: "text";
      stickerId: string;
      text: string;
      color?: TextSticker["color"];
      fontSize?: number;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      bare?: boolean;
      width?: number;
      height?: number;
    }
  | {
      kind: "image";
      stickerId: string;
      localFileId: string;
      mimeType: string;
      alt?: string;
      bare?: boolean;
      width?: number;
      height?: number;
    };

const DEFAULT_FONT = 13;

// ---------- TEXT STICKER ----------
export function TextStickerNode({ data }: NodeProps<StickerNodeData>) {
  const updateSticker = useCitadel((s) => s.updateSticker);
  const removeSticker = useCitadel((s) => s.removeSticker);

  // Auto-edit when freshly created (empty text). Otherwise the user has to
  // explicitly enter edit mode by clicking the pencil button.
  const initialText = data.kind === "text" ? data.text : "";
  const [editing, setEditing] = useState(initialText.length === 0);
  const [value, setValue] = useState(initialText);
  const taRef = useRef<HTMLTextAreaElement>(null);
  // Buffer the prior width so we can scale fontSize proportionally as the
  // user drags the resize handle. Per-frame ratio multiplied into fontSize
  // integrates correctly to the total scale by drag-end.
  const prevWidthRef = useRef<number | null>(data.width ?? null);

  useEffect(() => {
    if (editing) {
      // Focus the textarea + place caret at end on entering edit mode.
      const el = taRef.current;
      if (el) {
        el.focus();
        const v = el.value;
        el.setSelectionRange(v.length, v.length);
      }
    }
  }, [editing]);

  useEffect(() => {
    if (data.kind === "text") setValue(data.text);
  }, [data]);

  if (data.kind !== "text") return null;

  const commit = () => {
    if (value !== data.text) updateSticker(data.stickerId, { text: value });
  };
  const exitEdit = () => {
    commit();
    setEditing(false);
  };

  const fontSize = data.fontSize ?? DEFAULT_FONT;
  const bare = !!data.bare;

  const textStyle: React.CSSProperties = {
    fontSize,
    fontWeight: data.bold ? 600 : 400,
    fontStyle: data.italic ? "italic" : "normal",
    textDecoration: data.underline ? "underline" : "none",
  };

  return (
    <>
      {/* Resize handles only show while editing — keeps the view mode clean. */}
      <NodeResizer
        isVisible={editing}
        minWidth={120}
        minHeight={40}
        color="rgb(var(--accent-rgb))"
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
        lineStyle={{ borderColor: "rgb(var(--accent-rgb) / 0.4)" }}
        onResize={(_e, params) => {
          const oldW = prevWidthRef.current ?? params.width;
          const newW = params.width;
          // Scale font with the block: per-frame width ratio applied to fontSize.
          const ratio = oldW > 0 ? newW / oldW : 1;
          prevWidthRef.current = newW;
          updateSticker(data.stickerId, {
            width: newW,
            height: params.height,
            fontSize: Math.max(8, Math.min(96, fontSize * ratio)),
          });
        }}
      />

      <div
        // Width/height: explicit dims from resize, else auto-size.
        style={{ width: data.width, height: data.height }}
        className={cn(
          "group relative flex h-full w-full min-w-[120px]",
          bare
            ? "items-start"
            : "items-stretch rounded-xl border bg-ink-100/85 px-3 py-2 shadow-glow-sm backdrop-blur-sm transition-colors",
          !bare && (editing ? "border-accent/60" : "border-amber-200/30 hover:border-amber-200/50")
        )}
      >
        {/* View-mode hover controls — Edit + Delete, top-right, always reachable. */}
        {!editing && (
          <HoverControls
            onEdit={() => setEditing(true)}
            onDelete={() => removeSticker(data.stickerId)}
          />
        )}

        {/* Edit-mode toolbar — rendered INSIDE the sticker DOM so toolbar
            clicks can't leak to ReactFlow and deselect anything. */}
        {editing && (
          <>
            <TextToolbar
              stickerId={data.stickerId}
              bold={!!data.bold}
              italic={!!data.italic}
              underline={!!data.underline}
              fontSize={fontSize}
              bare={bare}
              onDone={exitEdit}
              onDelete={() => removeSticker(data.stickerId)}
            />
            {/* Always-visible Done in the corner — guaranteed escape hatch
                regardless of where the floating toolbar ends up. */}
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                exitEdit();
              }}
              title="Done"
              className="nodrag absolute right-1.5 top-1.5 z-30 flex h-6 w-6 items-center justify-center rounded-md border border-accent/40 bg-accent/[0.20] text-white backdrop-blur-sm hover:bg-accent/[0.32]"
            >
              <Check className="h-3 w-3" strokeWidth={2.4} />
            </button>
          </>
        )}

        {editing ? (
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit /* save but stay in edit mode — Done button exits */}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setValue(data.text);
                setEditing(false);
                e.stopPropagation();
              } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                exitEdit();
                e.preventDefault();
              }
              // Don't let single-key shortcuts (T/I) fire while typing.
              e.stopPropagation();
            }}
            // nodrag lets text-select work inside without starting a node drag.
            className={cn(
              "nodrag h-full w-full resize-none leading-relaxed text-amber-50 placeholder:text-muted-soft focus:outline-none",
              bare
                ? "bg-transparent"
                : "rounded-md border border-amber-200/20 bg-black/30 px-2 py-1 focus:border-amber-200/40"
            )}
            style={textStyle}
            placeholder="Type a note…"
          />
        ) : (
          <div
            className={cn(
              "h-full w-full whitespace-pre-wrap break-words leading-relaxed",
              bare
                ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                : "text-amber-50"
            )}
            style={textStyle}
          >
            {data.text || (
              <span className="italic text-muted-soft">
                empty — click the pencil to edit
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ---------- IMAGE STICKER ----------
export function ImageStickerNode({ data }: NodeProps<StickerNodeData>) {
  const updateSticker = useCitadel((s) => s.updateSticker);
  const removeSticker = useCitadel((s) => s.removeSticker);
  const stickers = useCitadel((s) => s.stickers);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const [editing, setEditing] = useState(false);
  const switchFileRef = useRef<HTMLInputElement>(null);

  const localFileId = data.kind === "image" ? data.localFileId : null;
  useEffect(() => {
    if (!localFileId) return;
    let cancelled = false;
    let created: string | null = null;
    (async () => {
      try {
        const hit = await getLocalFileUrl(localFileId);
        if (cancelled) {
          if (hit) URL.revokeObjectURL(hit.url);
          return;
        }
        if (!hit) {
          setError("missing");
          return;
        }
        created = hit.url;
        setSrc(hit.url);
        setError(null);
      } catch {
        if (!cancelled) setError("load_failed");
      }
    })();
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [localFileId]);

  if (data.kind !== "image") return null;

  const bare = !!data.bare;
  const liveSticker = stickers.find((s) => s.id === data.stickerId);

  return (
    <>
      <NodeResizer
        isVisible={editing}
        minWidth={48}
        minHeight={48}
        color="rgb(var(--accent-rgb))"
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
        lineStyle={{ borderColor: "rgb(var(--accent-rgb) / 0.4)" }}
        keepAspectRatio
        onResize={(_e, params) => {
          updateSticker(data.stickerId, {
            width: params.width,
            height: params.height,
          });
        }}
      />

      <div
        // Double-click enters edit mode (matches the requested pattern).
        onDoubleClick={() => setEditing(true)}
        style={{ width: data.width, height: data.height }}
        className={cn(
          "group relative h-full w-full overflow-hidden transition-colors",
          bare
            ? ""
            : cn(
                "rounded-xl border bg-ink-100/85 shadow-glow-sm",
                editing
                  ? "border-accent/60"
                  : "border-white/[0.08] hover:border-white/[0.18]"
              )
        )}
      >
        {/* Hidden file input that the toolbar's Switch-Image button targets. */}
        <input
          ref={switchFileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const oldId = data.localFileId;
            const rec = await saveLocalFile(f);
            updateSticker(data.stickerId, {
              localFileId: rec.id,
              mimeType: rec.mimeType,
              alt: f.name,
              // Reset display dims so the new image's aspect ratio is honored.
              width: undefined,
              height: undefined,
            });
            deleteLocalFile(oldId).catch(() => {});
            if (switchFileRef.current) switchFileRef.current.value = "";
          }}
        />
        {!editing && (
          <HoverControls
            onEdit={() => setEditing(true)}
            onDelete={() => removeSticker(data.stickerId)}
          />
        )}

        {editing && (
          <>
            <ImageToolbar
              bare={bare}
              onToggleBare={() => updateSticker(data.stickerId, { bare: !bare })}
              onCrop={() => setCropping(true)}
              onSwitchImage={() => switchFileRef.current?.click()}
              onDone={() => setEditing(false)}
              onDelete={() => removeSticker(data.stickerId)}
            />
            {/* On-sticker corner controls — always visible while editing,
                regardless of where the floating toolbar lands. Ensures the
                user can always close edit mode + reach Crop, even on a
                sticker right at the top of the canvas where the floating
                toolbar would render off-screen. */}
            <div
              className="nodrag nopan absolute right-1.5 top-1.5 z-30 flex gap-1"
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setCropping(true)}
                title="Crop"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.10] bg-black/70 text-white backdrop-blur-sm hover:bg-black/85"
              >
                <CropIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
              <button
                onClick={() => setEditing(false)}
                title="Done (exit edit mode)"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-accent/40 bg-accent/[0.20] text-white backdrop-blur-sm hover:bg-accent/[0.32]"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
            </div>
          </>
        )}

        {error ? (
          <div className="flex h-32 w-32 items-center justify-center bg-rose-300/[0.04] px-3 text-center text-[10px] text-rose-200">
            Image missing from browser storage
          </div>
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={data.alt ?? ""}
            draggable={false}
            // object-contain (not cover) preserves the PNG's natural aspect
            // ratio when the user resizes — no cropping, no forced-square
            // look. Combined with default `bare: true` on new image
            // stickers, this lets transparent PNGs sit on the canvas as
            // raw pixels with no chrome around them.
            className={cn(
              "block h-full w-full select-none object-contain",
              !data.width && !data.height && "max-h-[320px] max-w-[320px]"
            )}
          />
        ) : (
          <div className="flex h-32 w-32 items-center justify-center text-[11px] text-muted">
            Loading…
          </div>
        )}
      </div>

      {liveSticker?.kind === "image" && (
        <ImageCropEditor
          sticker={cropping ? liveSticker : null}
          onClose={() => setCropping(false)}
        />
      )}
    </>
  );
}

// ---------- SHARED CONTROLS ----------

// Pencil (Edit) + X (Delete) — visible on hover, both always reachable.
// `nodrag` so clicks don't initiate a sticker drag; `onMouseDown` stops
// propagation so ReactFlow doesn't interpret them as canvas interactions.
function HoverControls({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="nodrag absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        title="Edit"
        className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.10] bg-black/65 text-white/85 backdrop-blur-sm hover:border-accent/40 hover:text-accent"
      >
        <Pencil className="h-3 w-3" strokeWidth={2} />
      </button>
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete"
        className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.10] bg-black/65 text-white/85 backdrop-blur-sm hover:border-rose-300/40 hover:text-rose-300"
      >
        <X className="h-3 w-3" strokeWidth={2} />
      </button>
    </div>
  );
}

// Container for any toolbar floating above a sticker in edit mode. Lives
// inside the sticker's DOM so clicks can't leak out and tear down edit mode.
function ToolbarShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="nodrag nopan absolute -top-12 left-0 z-20"
      // Stop EVERY pointer event from reaching React Flow / parent — this is
      // what makes the toolbar stable instead of flickering away on click.
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-ink-100/95 p-1 shadow-panel backdrop-blur-md">
        {children}
      </div>
    </div>
  );
}

function ToolbarBtn({
  active,
  onClick,
  title,
  danger,
  primary,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  danger?: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        primary
          ? "bg-accent/[0.18] text-white hover:bg-accent/[0.28]"
          : active
          ? "bg-accent/[0.14] text-white"
          : danger
          ? "text-muted hover:bg-rose-300/[0.10] hover:text-rose-300"
          : "text-muted hover:bg-white/[0.05] hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-white/[0.08]" />;
}

function TextToolbar({
  stickerId,
  bold,
  italic,
  underline,
  fontSize,
  bare,
  onDone,
  onDelete,
}: {
  stickerId: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontSize: number;
  bare: boolean;
  onDone: () => void;
  onDelete: () => void;
}) {
  const updateSticker = useCitadel((s) => s.updateSticker);
  const bumpSize = (delta: number) =>
    updateSticker(stickerId, {
      fontSize: Math.max(9, Math.min(48, fontSize + delta)),
    });

  return (
    <ToolbarShell>
      <ToolbarBtn
        active={bold}
        onClick={() => updateSticker(stickerId, { bold: !bold })}
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" strokeWidth={2.2} />
      </ToolbarBtn>
      <ToolbarBtn
        active={italic}
        onClick={() => updateSticker(stickerId, { italic: !italic })}
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" strokeWidth={2} />
      </ToolbarBtn>
      <ToolbarBtn
        active={underline}
        onClick={() => updateSticker(stickerId, { underline: !underline })}
        title="Underline"
      >
        <Underline className="h-3.5 w-3.5" strokeWidth={2} />
      </ToolbarBtn>

      <Divider />

      <ToolbarBtn onClick={() => bumpSize(-1)} title="Smaller text">
        <Minus className="h-3 w-3" strokeWidth={2.4} />
      </ToolbarBtn>
      <div className="px-1 text-[10.5px] tabular-nums text-muted">{fontSize}</div>
      <ToolbarBtn onClick={() => bumpSize(1)} title="Bigger text">
        <Plus className="h-3 w-3" strokeWidth={2.4} />
      </ToolbarBtn>

      <Divider />

      <ToolbarBtn
        active={!bare}
        onClick={() => updateSticker(stickerId, { bare: !bare })}
        title={bare ? "Switch to card style" : "Switch to bare text"}
      >
        {bare ? (
          <SquareDot className="h-3.5 w-3.5" strokeWidth={1.7} />
        ) : (
          <Square className="h-3.5 w-3.5" strokeWidth={1.7} />
        )}
      </ToolbarBtn>

      <Divider />

      <ToolbarBtn danger onClick={onDelete} title="Delete sticker">
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </ToolbarBtn>

      <Divider />

      <ToolbarBtn primary onClick={onDone} title="Done editing">
        <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
      </ToolbarBtn>
    </ToolbarShell>
  );
}

function ImageToolbar({
  bare,
  onToggleBare,
  onCrop,
  onSwitchImage,
  onDone,
  onDelete,
}: {
  bare: boolean;
  onToggleBare: () => void;
  onCrop: () => void;
  onSwitchImage: () => void;
  onDone: () => void;
  onDelete: () => void;
}) {
  return (
    <ToolbarShell>
      <ToolbarBtn onClick={onCrop} title="Crop">
        <CropIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
      </ToolbarBtn>
      <ToolbarBtn onClick={onSwitchImage} title="Switch image (upload another)">
        <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
      </ToolbarBtn>

      <Divider />

      <ToolbarBtn
        active={!bare}
        onClick={onToggleBare}
        title={bare ? "Switch to card style (with border)" : "Switch to bare image (no border)"}
      >
        {bare ? (
          <SquareDot className="h-3.5 w-3.5" strokeWidth={1.7} />
        ) : (
          <Square className="h-3.5 w-3.5" strokeWidth={1.7} />
        )}
      </ToolbarBtn>

      <Divider />

      <ToolbarBtn danger onClick={onDelete} title="Delete sticker">
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </ToolbarBtn>

      <Divider />

      <ToolbarBtn primary onClick={onDone} title="Done editing">
        <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
      </ToolbarBtn>
    </ToolbarShell>
  );
}
