"use client";

import { useState, useRef, useEffect } from "react";
import { Settings2, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCitadel } from "@/lib/store";
import { initialNodes } from "@/lib/data/nodes";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function NodeVisibilityMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hidden = useCitadel((s) => s.hiddenNodes);
  const toggle = useCitadel((s) => s.toggleNodeVisibility);
  const showAll = useCitadel((s) => s.showAllNodes);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const nodes = initialNodes.filter((n) => n.kind !== "core");
  const hiddenCount = Object.keys(hidden).length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          // Stop bubbling so the canvas's onContextMenu / pane handlers
          // don't fight us — previously the button could feel unresponsive
          // because clicks were getting intercepted by ReactFlow internals.
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Show or hide individual nodes"
        aria-expanded={open}
        // Compact icon-only chip with a hidden-count dot — frees up real
        // estate so the dropdown can't visually collide with React Flow's
        // bottom Controls. Hover label gives discoverability.
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-ink-100/80 backdrop-blur-md transition-all",
          "hover:border-accent/30 hover:bg-accent/[0.04] hover:shadow-glow-sm",
          open && "border-accent/30 bg-accent/[0.04]"
        )}
        title="Show / hide nodes"
      >
        <Settings2 className="h-[14px] w-[14px] text-accent" strokeWidth={1.7} />
        {hiddenCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-accent px-1 text-[8.5px] font-medium tracking-wider text-ink-100"
            aria-label={`${hiddenCount} nodes hidden`}
          >
            {hiddenCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            // z-50 inside the wrapper's already-z-50 stacking context puts
            // this dropdown above EVERY other Network overlay (ReactFlow
            // Controls/MiniMap, corner labels, placement-mode banner).
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute right-0 top-full z-50 mt-2 w-[280px] overflow-hidden rounded-xl border border-white/[0.07] bg-ink-100/95 shadow-panel backdrop-blur-md"
          >
            <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-2.5">
              <div>
                <div className="mono-tag">visibility</div>
                <div className="mt-0.5 text-[12px] tracking-tight text-white">
                  Show / hide nodes
                </div>
              </div>
              {hiddenCount > 0 && (
                <Button size="sm" variant="subtle" onClick={() => showAll()}>
                  Show all
                </Button>
              )}
            </div>
            {/* Viewport-aware cap: never grow past 50% of the window so the
                bottom-right ReactFlow Controls always remain reachable, even
                when the user has the side-panel open or a short window. */}
            <ul
              className="overflow-y-auto py-1"
              style={{ maxHeight: "min(360px, 45vh)" }}
            >
              {nodes.map((n) => {
                const isHidden = !!hidden[n.id];
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => toggle(n.id)}
                      className={cn(
                        "group flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                        isHidden
                          ? "opacity-50 hover:opacity-100 hover:bg-white/[0.02]"
                          : "hover:bg-accent/[0.03]"
                      )}
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02]">
                        <Icon name={n.icon} className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] tracking-tight text-white">
                          {n.label}
                        </div>
                        <div className="text-[10px] capitalize text-muted-soft">
                          {n.category}
                        </div>
                      </div>
                      {isHidden ? (
                        <EyeOff className="h-3.5 w-3.5 text-muted-soft" strokeWidth={1.7} />
                      ) : (
                        <Eye className="h-3.5 w-3.5 text-accent" strokeWidth={1.7} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
