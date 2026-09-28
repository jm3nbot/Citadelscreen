"use client";

import { cn } from "@/lib/utils";

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        {label && (
          <div className="text-[13px] tracking-tight text-white">{label}</div>
        )}
        {description && (
          <div className="mt-0.5 text-[11.5px] leading-snug text-muted">
            {description}
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
          checked
            ? "border-accent/40 bg-accent/[0.18]"
            : "border-white/[0.08] bg-white/[0.025]"
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white transition-all",
            checked ? "left-[18px] shadow-glow-sm" : "left-[3px] bg-white/70"
          )}
        />
      </button>
    </label>
  );
}
