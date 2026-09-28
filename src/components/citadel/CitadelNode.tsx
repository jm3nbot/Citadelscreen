"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { brandChip } from "@/lib/brand";
import type { CitadelNode as CitadelNodeType } from "@/lib/types";

export type NodeData = Pick<
  CitadelNodeType,
  "label" | "kind" | "icon" | "description" | "connected" | "category"
> & {
  minimal?: boolean;
};

const kindRing: Record<NodeData["kind"], string> = {
  core: "border-accent/40 bg-gradient-to-b from-accent/[0.12] to-accent/[0.02] shadow-glow",
  ai: "border-fuchsia-300/15 bg-gradient-to-b from-fuchsia-200/[0.04] to-white/[0.005]",
  email: "border-amber-200/15 bg-gradient-to-b from-amber-200/[0.04] to-white/[0.005]",
  calendar: "border-sky-300/15 bg-gradient-to-b from-sky-300/[0.04] to-white/[0.005]",
  reminder: "border-rose-300/15 bg-gradient-to-b from-rose-300/[0.04] to-white/[0.005]",
  automation: "border-emerald-300/15 bg-gradient-to-b from-emerald-300/[0.04] to-white/[0.005]",
  app: "border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-white/[0.005]",
};

export function CitadelNodeComponent({ data, selected }: NodeProps<NodeData>) {
  const isCore = data.kind === "core";
  const minimal = !!data.minimal;
  const iconKey = data.icon.toLowerCase();
  const chipClass = brandChip[iconKey];

  if (isCore && minimal) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        title={`${data.label}${data.description ? " â€” " + data.description : ""}`}
        className={cn(
          "group relative flex h-[68px] w-[68px] items-center justify-center rounded-2xl border backdrop-blur-md transition-all",
          kindRing[data.kind],
          "hover:shadow-glow hover:border-accent/40",
          selected && "border-accent/60 shadow-glow"
        )}
      >
        <Handle type="target" position={Position.Top} className="!opacity-0" />
        <Handle type="source" position={Position.Bottom} className="!opacity-0" />
        <Handle type="target" position={Position.Left} className="!opacity-0" />
        <Handle type="source" position={Position.Right} className="!opacity-0" />

        <span className="pointer-events-none absolute inset-0 rounded-2xl border border-accent/20 animate-pulse-slow" />

        <div
          className={cn(
            "relative flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl border transition-all",
            chipClass ?? "border-white/[0.06] bg-white/[0.02]"
          )}
        >
          <Icon name={data.icon} className="h-[24px] w-[24px]" />
        </div>
      </motion.div>
    );
  }

  if (isCore) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-2xl border px-5 py-4 backdrop-blur-md transition-all",
          kindRing[data.kind],
          "hover:shadow-glow hover:border-accent/40",
          selected && "border-accent/60 shadow-glow"
        )}
        style={{ minWidth: 140 }}
      >
        <Handle type="target" position={Position.Top} className="!opacity-0" />
        <Handle type="source" position={Position.Bottom} className="!opacity-0" />
        <Handle type="target" position={Position.Left} className="!opacity-0" />
        <Handle type="source" position={Position.Right} className="!opacity-0" />

        <span className="pointer-events-none absolute inset-0 rounded-2xl border border-accent/20 animate-pulse-slow" />

        <div
          className={cn(
            "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all",
            chipClass ?? "border-white/[0.06] bg-white/[0.02]"
          )}
        >
          <Icon name={data.icon} className="h-[20px] w-[20px]" />
        </div>

        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-[14px] font-medium tracking-tight text-white">
            {data.label}
          </span>
          <span className="mono-tag mt-0.5 text-[9px]">command center</span>
        </div>
      </motion.div>
    );
  }

  // Minimal mode: just the chip. Default mode: chip + label row.
  if (minimal) {
    return (
      <div
        title={`${data.label}${data.description ? " — " + data.description : ""}`}
        className={cn(
          "group relative flex items-center justify-center rounded-2xl border transition-colors",
          kindRing[data.kind],
          "hover:border-accent/40",
          selected && "border-accent/60 shadow-glow",
          isCore ? "h-[68px] w-[68px]" : "h-[52px] w-[52px]"
        )}
      >
        <Handle type="target" position={Position.Top} className="!opacity-0" />
        <Handle type="source" position={Position.Bottom} className="!opacity-0" />
        <Handle type="target" position={Position.Left} className="!opacity-0" />
        <Handle type="source" position={Position.Right} className="!opacity-0" />

        {isCore && (
          <span className="pointer-events-none absolute inset-0 rounded-2xl border border-accent/20 animate-pulse-slow" />
        )}

        <div
          className={cn(
            "relative flex shrink-0 items-center justify-center rounded-xl border transition-all",
            chipClass ?? "border-white/[0.06] bg-white/[0.02]",
            isCore ? "h-[44px] w-[44px]" : "h-[34px] w-[34px]"
          )}
        >
          <Icon
            name={data.icon}
            className={cn(isCore ? "h-[24px] w-[24px]" : "h-[20px] w-[20px]")}
          />
          {data.connected && !isCore && (
            <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.7)]" />
          )}
        </div>
      </div>
    );
  }

  // Default mode: chip + label row (with description for non-core).
  return (
    <div
      className={cn(
        "group relative flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 transition-colors",
        kindRing[data.kind],
        "hover:border-accent/40",
        selected && "border-accent/60 shadow-glow",
        isCore && "px-5 py-4"
      )}
      style={{ minWidth: isCore ? 140 : 116 }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />

      {isCore && (
        <span className="pointer-events-none absolute inset-0 rounded-2xl border border-accent/20 animate-pulse-slow" />
      )}

      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-lg border transition-all",
          chipClass ?? "border-white/[0.06] bg-white/[0.02]",
          isCore ? "h-9 w-9" : "h-7 w-7"
        )}
      >
        <Icon
          name={data.icon}
          className={cn(isCore ? "h-[20px] w-[20px]" : "h-[16px] w-[16px]")}
        />
        {data.connected && !isCore && (
          <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.7)]" />
        )}
      </div>

      <div className="flex min-w-0 flex-col leading-tight">
        <span
          className={cn(
            "tracking-tight text-white",
            isCore ? "text-[14px] font-medium" : "text-[12px]"
          )}
        >
          {data.label}
        </span>
        {isCore ? (
          <span className="mono-tag mt-0.5 text-[9px]">command center</span>
        ) : (
          data.description && (
            <span className="mt-0.5 truncate text-[10.5px] text-muted">
              {data.description}
            </span>
          )
        )}
      </div>
    </div>
  );
}
