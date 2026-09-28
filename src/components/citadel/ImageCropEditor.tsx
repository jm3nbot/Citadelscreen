"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Crop as CropIcon, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getLocalFileUrl, saveLocalFile, deleteLocalFile } from "@/lib/local-files";
import { useCitadel } from "@/lib/store";
import type { ImageSticker } from "@/lib/types";

// Crop rectangle in DISPLAY coordinates (pixels relative to the displayed
// image element). We convert to NATURAL coords (original image pixels) when
// the user hits Apply, so the actual blob write happens at full resolution.
type Rect = { x: number; y: number; w: number; h: number };

type Drag =
  | { kind: "move"; startX: number; startY: number; orig: Rect }
  | { kind: "resize"; handle: HandleKey; startX: number; startY: number; orig: Rect }
  | null;

// 8 directional handles + center move. NW/NE/SW/SE corners + 4 edge midpoints.
type HandleKey = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLES: Array<{ key: HandleKey; pos: string; cursor: string }> = [
  { key: "nw", pos: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "cursor-nwse-resize" },
  { key: "n",  pos: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "cursor-ns-resize" },
  { key: "ne", pos: "right-0 top-0 translate-x-1/2 -translate-y-1/2",  cursor: "cursor-nesw-resize" },
  { key: "e",  pos: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2", cursor: "cursor-ew-resize" },
  { key: "se", pos: "right-0 bottom-0 translate-x-1/2 translate-y-1/2", cursor: "cursor-nwse-resize" },
  { key: "s",  pos: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "cursor-ns-resize" },
  { key: "sw", pos: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "cursor-nesw-resize" },
  { key: "w",  pos: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2", cursor: "cursor-ew-resize" },
];

export function ImageCropEditor({
  sticker,
  onClose,
}: {
  sticker: ImageSticker | null;
  onClose: () => void;
}) {
  const updateSticker = useCitadel((s) => s.updateSticker);

  const [src, setSrc] = useState<string | null>(null);
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [displayW, setDisplayW] = useState(0);
  const [displayH, setDisplayH] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<Drag>(null);

  // Load the sticker's blob into an object URL. Revoke on close.
  useEffect(() => {
    if (!sticker) {
      setSrc(null);
      setRect(null);
      return;
    }
    let cancelled = false;
    let created: string | null = null;
    (async () => {
      try {
        const hit = await getLocalFileUrl(sticker.localFileId);
        if (cancelled) {
          if (hit) URL.revokeObjectURL(hit.url);
          return;
        }
        if (!hit) {
          setError("Image not found in browser storage.");
          return;
        }
        created = hit.url;
        setSrc(hit.url);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "load_failed");
      }
    })();
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [sticker]);

  // ESC closes + lock scroll.
  useEffect(() => {
    if (!sticker) return;
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
  }, [sticker, onClose]);

  // Once the image loads we know its display + natural dimensions. Seed the
  // crop rectangle to a centered 80% so the user can immediately drag handles.
  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    setNaturalW(img.naturalWidth);
    setNaturalH(img.naturalHeight);
    const dw = img.clientWidth;
    const dh = img.clientHeight;
    setDisplayW(dw);
    setDisplayH(dh);
    const inset = 0.1;
    setRect({
      x: dw * inset,
      y: dh * inset,
      w: dw * (1 - inset * 2),
      h: dh * (1 - inset * 2),
    });
  };

  const startMove = (e: React.MouseEvent) => {
    if (!rect) return;
    dragRef.current = {
      kind: "move",
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...rect },
    };
    e.preventDefault();
  };
  const startResize = (handle: HandleKey) => (e: React.MouseEvent) => {
    if (!rect) return;
    dragRef.current = {
      kind: "resize",
      handle,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...rect },
    };
    e.stopPropagation();
    e.preventDefault();
  };

  useEffect(() => {
    const clamp = (r: Rect): Rect => {
      const minSize = 12;
      let { x, y, w, h } = r;
      // Keep box inside the displayed image area.
      if (x < 0) { w += x; x = 0; }
      if (y < 0) { h += y; y = 0; }
      if (x + w > displayW) w = displayW - x;
      if (y + h > displayH) h = displayH - y;
      if (w < minSize) w = minSize;
      if (h < minSize) h = minSize;
      return { x, y, w, h };
    };
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (d.kind === "move") {
        setRect(clamp({ x: d.orig.x + dx, y: d.orig.y + dy, w: d.orig.w, h: d.orig.h }));
      } else {
        const r = { ...d.orig };
        if (d.handle.includes("w")) {
          r.x = d.orig.x + dx;
          r.w = d.orig.w - dx;
        }
        if (d.handle.includes("e")) {
          r.w = d.orig.w + dx;
        }
        if (d.handle.includes("n")) {
          r.y = d.orig.y + dy;
          r.h = d.orig.h - dy;
        }
        if (d.handle.includes("s")) {
          r.h = d.orig.h + dy;
        }
        setRect(clamp(r));
      }
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [displayW, displayH]);

  const reset = () => {
    if (displayW === 0) return;
    const inset = 0.1;
    setRect({
      x: displayW * inset,
      y: displayH * inset,
      w: displayW * (1 - inset * 2),
      h: displayH * (1 - inset * 2),
    });
  };

  const apply = async () => {
    if (!sticker || !rect || !imgRef.current || displayW === 0) return;
    setBusy(true);
    try {
      // Translate display-space rect → natural-image pixels.
      const sx = (rect.x / displayW) * naturalW;
      const sy = (rect.y / displayH) * naturalH;
      const sw = (rect.w / displayW) * naturalW;
      const sh = (rect.h / displayH) * naturalH;

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw));
      canvas.height = Math.max(1, Math.round(sh));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no_canvas_2d");
      ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      const blob: Blob = await new Promise((resolve, reject) => {
        // Re-encode as PNG to preserve transparency; falls back to original mime
        // if PNG fails. Use the image's natural mime when it's a JPEG to keep
        // file sizes sane.
        const mime = sticker.mimeType?.startsWith("image/jpeg") ? "image/jpeg" : "image/png";
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob_null"))),
          mime,
          0.92
        );
      });

      const file = new File(
        [blob],
        (sticker.alt ?? "cropped") + (blob.type === "image/jpeg" ? ".jpg" : ".png"),
        { type: blob.type }
      );
      const rec = await saveLocalFile(file);

      // Swap the sticker's blob reference, then garbage-collect the old one.
      const oldId = sticker.localFileId;
      updateSticker(sticker.id, {
        localFileId: rec.id,
        mimeType: rec.mimeType,
        // Reset display width/height so the new aspect ratio is honored.
        width: undefined,
        height: undefined,
      });
      // Fire-and-forget cleanup of the prior blob.
      deleteLocalFile(oldId).catch(() => {});
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "crop_failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {sticker && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[92vh] w-[min(960px,96vw)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-100 shadow-panel"
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] bg-ink-50/80 px-4 py-3 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <CropIcon className="h-4 w-4 text-accent" strokeWidth={1.7} />
                <div className="text-[13px] tracking-tight text-white">Crop image</div>
                {naturalW > 0 && (
                  <span className="ml-2 text-[10.5px] tabular-nums text-muted">
                    {naturalW} × {naturalH}
                    {rect && (
                      <>
                        {" → "}
                        {Math.round((rect.w / displayW) * naturalW)} ×{" "}
                        {Math.round((rect.h / displayH) * naturalH)}
                      </>
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="subtle"
                  icon={<RotateCcw className="h-3.5 w-3.5" />}
                  onClick={reset}
                  disabled={busy}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Check className="h-3.5 w-3.5" />}
                  onClick={apply}
                  disabled={busy || !rect}
                >
                  {busy ? "Cropping…" : "Apply crop"}
                </Button>
                <button
                  onClick={onClose}
                  title="Close (Esc)"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted transition-colors hover:border-white/[0.12] hover:text-white"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            </header>

            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#0b0b0e] p-6">
              {error && (
                <div className="text-[12.5px] text-rose-200">{error}</div>
              )}
              {src && !error && (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imgRef}
                    src={src}
                    alt={sticker.alt ?? ""}
                    onLoad={onImgLoad}
                    draggable={false}
                    className="block max-h-[70vh] max-w-full select-none"
                  />
                  {rect && (
                    <>
                      {/* Outer dim overlay using 4 boxes around the crop rect */}
                      <div
                        className="pointer-events-none absolute inset-0 bg-black/55"
                        style={{
                          clipPath: `polygon(
                            0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                            ${rect.x}px ${rect.y}px,
                            ${rect.x}px ${rect.y + rect.h}px,
                            ${rect.x + rect.w}px ${rect.y + rect.h}px,
                            ${rect.x + rect.w}px ${rect.y}px,
                            ${rect.x}px ${rect.y}px
                          )`,
                        }}
                      />
                      <div
                        onMouseDown={startMove}
                        className="absolute cursor-move border border-accent shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
                        style={{
                          left: rect.x,
                          top: rect.y,
                          width: rect.w,
                          height: rect.h,
                        }}
                      >
                        {/* Rule-of-thirds grid lines */}
                        <div className="pointer-events-none absolute inset-0">
                          <div className="absolute left-1/3 top-0 h-full w-px bg-white/30" />
                          <div className="absolute left-2/3 top-0 h-full w-px bg-white/30" />
                          <div className="absolute top-1/3 left-0 h-px w-full bg-white/30" />
                          <div className="absolute top-2/3 left-0 h-px w-full bg-white/30" />
                        </div>
                        {HANDLES.map((h) => (
                          <div
                            key={h.key}
                            onMouseDown={startResize(h.key)}
                            className={`absolute h-2.5 w-2.5 rounded-sm bg-accent shadow-[0_0_0_1px_rgba(0,0,0,0.5)] ${h.pos} ${h.cursor}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="border-t border-white/[0.06] bg-ink-50/60 px-4 py-2 text-[10.5px] text-muted">
              Drag the rectangle to position, or any handle to resize. <span className="text-white">Esc</span> to cancel.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
