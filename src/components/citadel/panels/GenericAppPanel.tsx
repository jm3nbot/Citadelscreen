"use client";

import type { CitadelNode } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { ExternalLink, Link2, EyeOff } from "lucide-react";
import { useCitadel } from "@/lib/store";

export function GenericAppPanel({ node }: { node: CitadelNode }) {
  // Hide-instead-of-delete: removing a citadel node permanently would be
  // dangerous (no undo). "Hide from network" toggles visibility which the
  // user can flip back from the Nodes gear menu at any time.
  const setNodeVisible = useCitadel((s) => s.setNodeVisible);
  const setSelectedNodeId = useCitadel((s) => s.setSelectedNodeId);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
        <div className="mono-tag">app · {node.category}</div>
        <div className="mt-1 text-[14px] tracking-tight text-white">
          {node.label} is {node.connected ? "connected" : "not connected"}.
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">
          {node.description ?? "Connect this app to add it to your network."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="status" value={node.connected ? "live" : "offline"} />
        <Stat label="category" value={node.category} />
      </div>

      <div className="space-y-2">
        <div className="mono-tag">actions</div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<Link2 className="h-3.5 w-3.5" />}>
            {node.connected ? "Manage connection" : "Connect"}
          </Button>
          <Button variant="default" icon={<ExternalLink className="h-3.5 w-3.5" />}>
            Open
          </Button>
          <Button
            variant="subtle"
            icon={<EyeOff className="h-3.5 w-3.5" />}
            onClick={() => {
              setNodeVisible(node.id, false);
              setSelectedNodeId(null);
            }}
            title="Hide this node from the network. Toggle back from the Nodes gear menu."
          >
            Hide from network
          </Button>
        </div>
        <p className="text-[10.5px] text-muted-soft">
          Hiding is reversible — re-show any node from the Nodes gear menu in the network's top-right.
        </p>
      </div>

      <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3 text-[11.5px] text-muted">
        Want this app deeper in your network? Drag it closer to Citadel on the
        graph, or wire it into an automation.
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2.5">
      <div className="mono-tag">{label}</div>
      <div className="mt-0.5 text-[13px] tracking-tight text-white capitalize">
        {value}
      </div>
    </div>
  );
}
