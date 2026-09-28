"use client";

import { useEffect, useRef, useState } from "react";
import { type NodeProps, NodeResizer } from "reactflow";
import { X, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCitadel } from "@/lib/store";
import type { StickyNoteColor } from "@/lib/types";

export type StickyNodeData = {
  kind: "sticky";
  stickerId: string;
  text: string;
  color: StickyNoteColor;
  fontSize?: number;
  width?: number;
  height?: number;
};

// Color palette — paper-tinted hues with a faint inner shadow for a modern
// take on the classic post-it look. Each entry pairs a body color, ruled
// header line, and text tone tuned for the dark canvas.
const COLOR_STYLES: Record<
  StickyNoteColor,
  {
    bg: string;
    border: string;
    text: string;
    ruled: string;
    // Optional left-edge rule (the legal-pad red line). Drawn as an inset
    // box-shadow column inside the note when present.
    leftRule?: string;
  }
> = {
  yellow: {
    bg: "linear-gradient(160deg, #fde68a 0%, #fcd34d 100%)",
    border: "rgba(180, 130, 20, 0.45)",
    text: "#3b2a00",
    ruled: "rgba(120, 80, 0, 0.18)",
  },
  pink: {
    bg: "linear-gradient(160deg, #fbcfe8 0%, #f9a8d4 100%)",
    border: "rgba(170, 60, 110, 0.45)",
    text: "#3a0d24",
    ruled: "rgba(120, 30, 70, 0.18)",
  },
  blue: {
    bg: "linear-gradient(160deg, #bae6fd 0%, #7dd3fc 100%)",
    border: "rgba(20, 90, 150, 0.45)",
    text: "#0c2740",
    ruled: "rgba(20, 60, 120, 0.18)",
  },
  green: {
    bg: "linear-gradient(160deg, #bbf7d0 0%, #86efac 100%)",
    border: "rgba(20, 110, 60, 0.45)",
    text: "#0c2e1a",
    ruled: "rgba(20, 80, 40, 0.18)",
  },
  purple: {
    bg: "linear-gradient(160deg, #ddd6fe 0%, #c4b5fd 100%)",
    border: "rgba(100, 60, 180, 0.45)",
    text: "#1f1245",
    ruled: "rgba(60, 30, 130, 0.18)",
  },
  // Legal-pad / notepad: white paper, faint blue horizontal rules, red
  // vertical rule on the left margin.
  paper: {
    bg: "linear-gradient(180deg, #ffffff 0%, #f7f7f5 100%)",
    border: "rgba(0, 0, 0, 0.18)",
    text: "#171717",
    ruled: "rgba(80, 130, 200, 0.22)",
    leftRule: "rgba(220, 38, 38, 0.6)",
  },
};

const COLORS: StickyNoteColor[] = [
  "yellow",
  "pink",
  "blue",
  "green",
  "purple",
  "paper",
];

export function StickyNoteNode({ data }: NodeProps<StickyNodeData>) {
  const updateSticker = useCitadel((s) => s.updateSticker);
  const removeSticker = useCitadel((s) => s.removeSticker);

  const initialText = data.text;
  const [editing, setEditing] = useState(initialText.length === 0);
  const [value, setValue] = useState(initialText);
  const taRef = useRef<HTMLTextAreaElement>(null);
  // Track current width during resize so we can auto-scale fontSize. The store
  // is the source of truth; this ref just buffers the previous width for the
  // per-frame ratio calculation.
  const prevWidthRef = useRef<number | null>(data.width ?? null);

  useEffect(() => {
    if (editing) {
      const el = taRef.current;
      if (el) {
        el.focus();
        const v = el.value;
        el.setSelectionRange(v.length, v.length);
      }
    }
  }, [editing]);

  useEffect(() => {
    setValue(data.text);
  }, [data.text]);

  const commit = () => {
    if (value !== data.text) updateSticker(data.stickerId, { text: value });
  };
  const exitEdit = () => {
    commit();
    setEditing(false);
  };

  const palette = COLOR_STYLES[data.color];
  const fontSize = data.fontSize ?? 14;

  return (
    <>
      <NodeResizer
        isVisible={editing}
        minWidth={140}
        minHeight={120}
        color="rgba(0,0,0,0.4)"
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
        lineStyle={{ borderColor: "rgba(0,0,0,0.35)" }}
        onResize={(_e, params) => {
          const oldW = prevWidthRef.current ?? params.width;
          const newW = params.width;
          // Scale fontSize by width ratio per frame so resizing the note
          // makes the text scale with it (the user explicitly asked for this).
          const ratio = oldW > 0 ? newW / oldW : 1;
          prevWidthRef.current = newW;
          updateSticker(data.stickerId, {
            width: newW,
            height: params.height,
            fontSize: Math.max(8, Math.min(72, fontSize * ratio)),
          });
        }}
      />

      <div
        // Double-click toggles edit mode (matches the user's requested pattern).
        onDoubleClick={() => setEditing(true)}
        style={{
          width: data.width,
          height: data.height,
          background: palette.bg,
          border: `1px solid ${palette.border}`,
          color: palette.text,
          // The classic "torn corner" + slight rotation gives that paper feel
          // without going kitsch.
          boxShadow:
            "0 6px 18px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.45) inset",
          // Patrick Hand — clean printed handwriting. Loaded via
          // platform print-style fonts for offline/local development.
          fontFamily:
            "var(--font-handwrite, 'Segoe Print'), 'Marker Felt', sans-serif",
        }}
        className={cn(
          "group relative flex h-full min-h-[120px] w-full min-w-[140px] flex-col overflow-hidden rounded-[3px] py-3",
          // Paper variant gets extra left padding so the text body clears
          // the red rule. Every other variant uses uniform horizontal padding.
          palette.leftRule ? "pl-8 pr-4" : "px-4"
        )}
      >
        {/* Subtle ruled lines for a notebook feel. CSS-only. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(transparent, transparent ${fontSize * 1.55}px, ${palette.ruled} ${fontSize * 1.55}px, ${palette.ruled} ${fontSize * 1.55 + 1}px)`,
            backgroundPositionY: `${fontSize * 1.8}px`,
          }}
        />

        {/* Optional red left rule — drawn as a thin vertical bar inset
            from the edge so it reads as a notepad margin line, not a border. */}
        {palette.leftRule && (
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 top-0"
            style={{
              left: 22,
              width: 1.5,
              background: palette.leftRule,
            }}
          />
        )}

        {/* View-mode corner controls — hover-only. The earlier "click only
            works at the top" bug was a click-target size issue (h-6 w-6),
            not the hover gate itself. h-7 w-7 + explicit pointer-events on
            the hover wrapper restores reliable clicks while keeping the
            buttons hidden until the user mouses over the note. */}
        {!editing && (
          <div className="nodrag absolute right-1.5 top-1.5 z-20 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              title="Edit"
              aria-label="Edit sticky note"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-black/20 bg-white/85 text-black/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                removeSticker(data.stickerId);
              }}
              title="Delete"
              aria-label="Delete sticky note"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-black/20 bg-white/85 text-black/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-rose-200 hover:text-rose-900"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Edit-mode chrome: color row pinned at top INSIDE the sticky (so
            it can never drift off-screen above a top-of-canvas note) plus
            a corner Done button. */}
        {editing && (
          <>
            <div
              className="nodrag absolute left-2 right-12 top-1.5 z-20 flex items-center gap-1 rounded-md border border-black/10 bg-white/85 p-1 shadow-sm backdrop-blur-sm"
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {COLORS.map((c) => {
                const active = c === data.color;
                return (
                  <button
                    key={c}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateSticker(data.stickerId, { color: c });
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    title={c.charAt(0).toUpperCase() + c.slice(1)}
                    aria-label={`Change color to ${c}`}
                    className={cn(
                      "relative h-5 w-5 shrink-0 rounded-full border transition-transform",
                      active
                        ? "scale-110 ring-2 ring-black/30"
                        : "hover:scale-110"
                    )}
                    style={{
                      background: COLOR_STYLES[c].bg,
                      borderColor: COLOR_STYLES[c].border,
                    }}
                  >
                    {/* Tiny red marker inside the paper swatch so its
                        identity is unmistakable in the picker. */}
                    {c === "paper" && (
                      <span
                        aria-hidden
                        className="absolute left-1 top-0.5 bottom-0.5 w-px"
                        style={{ background: "rgba(220,38,38,0.8)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Corner Done button — always on top, always reachable. */}
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                exitEdit();
              }}
              title="Done"
              aria-label="Finish editing"
              className="nodrag absolute right-1.5 top-1.5 z-30 flex h-7 w-7 items-center justify-center rounded-md border border-black/30 bg-accent/[0.20] text-white shadow-sm backdrop-blur-sm hover:bg-accent/[0.32]"
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
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setValue(data.text);
                setEditing(false);
                e.stopPropagation();
              } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                exitEdit();
                e.preventDefault();
              }
              e.stopPropagation();
            }}
            // pt-9 keeps text clear of the inline color-picker row that
            // sits at top-1.5 above the textarea in edit mode.
            className="nodrag relative z-10 h-full w-full resize-none border-0 bg-transparent pt-9 leading-relaxed placeholder:text-black/40 focus:outline-none"
            style={{ fontSize, color: palette.text, fontFamily: "inherit" }}
            placeholder="Write a note…"
          />
        ) : (
          <div
            className="relative z-10 h-full w-full whitespace-pre-wrap break-words leading-relaxed"
            style={{ fontSize }}
          >
            {data.text || (
              <span className="italic opacity-60">empty · double-click to edit</span>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// (Old floating StickyToolbar removed — color picker is now an inline row
// inside the sticky's edit mode so it can never drift off-screen.)
