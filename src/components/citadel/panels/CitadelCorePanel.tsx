"use client";

import { initialNodes } from "@/lib/data/nodes";
import { Icon } from "@/components/ui/Icon";

export function CitadelCorePanel() {
  const connected = initialNodes.filter((n) => n.connected && n.kind !== "core");
  const categories = Array.from(new Set(connected.map((n) => n.category)));

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-accent/15 bg-accent/[0.04] p-4">
        <div className="mono-tag">command center</div>
        <div className="mt-1 text-[14px] tracking-tight text-white">
          Citadel turns your workflow into a living system.
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">
          You currently have {connected.length} nodes across {categories.length}{" "}
          clusters. The web rewires as you add tools and automations.
        </p>
      </div>

      <div>
        <div className="mono-tag mb-2">clusters</div>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((c) => {
            const nodesIn = connected.filter((n) => n.category === c);
            return (
              <div
                key={c}
                className="rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2.5"
              >
                <div className="text-[11.5px] capitalize tracking-tight text-white">
                  {c}
                </div>
                <div className="mt-0.5 text-[10.5px] text-muted">
                  {nodesIn.length} node{nodesIn.length === 1 ? "" : "s"}
                </div>
                <div className="mt-2 flex -space-x-1">
                  {nodesIn.slice(0, 5).map((n) => (
                    <div
                      key={n.id}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] bg-ink-100"
                      title={n.label}
                    >
                      <Icon name={n.icon} className="h-3 w-3 text-white/85" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3 text-[11.5px] text-muted">
        Tip: click any node in the graph to inspect it. Drag to rearrange — your
        layout saves automatically.
      </div>
    </div>
  );
}
