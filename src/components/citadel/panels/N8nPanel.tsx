"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useCitadel } from "@/lib/store";
import { formatRelativeTime } from "@/lib/utils";
import { Plus, Zap, Link2 } from "lucide-react";
import type { Automation } from "@/lib/types";

export function N8nPanel() {
  const automations = useCitadel((s) => s.automations);
  const triggerAutomation = useCitadel((s) => s.triggerAutomation);
  const updateAutomation = useCitadel((s) => s.updateAutomation);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.04] p-4">
        <div className="mono-tag">webhook stub mode</div>
        <p className="mt-1 text-[12px] text-muted">
          Workflows below show toasts on trigger. Paste your n8n webhook URL on
          any workflow to wire it up when you're ready for real calls.
        </p>
      </div>

      <ul className="space-y-2">
        {automations.map((a) => (
          <AutomationRow
            key={a.id}
            automation={a}
            onTrigger={() => triggerAutomation(a.id)}
            onUrl={(url) => updateAutomation(a.id, { webhookUrl: url })}
          />
        ))}
      </ul>
    </div>
  );
}

function AutomationRow({
  automation,
  onTrigger,
  onUrl,
}: {
  automation: Automation;
  onTrigger: () => void;
  onUrl: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(automation.webhookUrl ?? "");

  return (
    <li className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] tracking-tight text-white">
            {automation.name}
          </div>
          <div className="mt-0.5 text-[11.5px] text-muted">
            {automation.description}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[10.5px] text-muted-soft">
            <span>{automation.runs ?? 0} runs</span>
            {automation.lastRunAt && (
              <span>· last {formatRelativeTime(automation.lastRunAt)}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <Button size="sm" variant="primary" icon={<Zap className="h-3 w-3" />} onClick={onTrigger}>
            Trigger
          </Button>
          <Button size="sm" variant="subtle" icon={<Link2 className="h-3 w-3" />} onClick={() => setOpen((o) => !o)}>
            {automation.webhookUrl ? "Edit URL" : "Add URL"}
          </Button>
        </div>
      </div>
      {open && (
        <div className="mt-3 flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://n8n.your-domain/webhook/..."
            className="flex-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[11.5px] text-white placeholder:text-muted-soft focus:border-accent/40 focus:outline-none"
          />
          <Button
            size="sm"
            variant="default"
            icon={<Plus className="h-3 w-3" />}
            onClick={() => {
              onUrl(url);
              setOpen(false);
            }}
          >
            Save
          </Button>
        </div>
      )}
    </li>
  );
}
