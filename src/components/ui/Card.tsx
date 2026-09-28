"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  hover = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.025] to-white/[0.005] p-5 shadow-panel transition-colors",
        hover && "hover:border-accent/20",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  tag,
  right,
  icon,
}: {
  title: string;
  subtitle?: string;
  tag?: string;
  right?: React.ReactNode;
  // Optional leading visual (e.g. a brand logo) shown before the title block.
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="shrink-0">{icon}</div>}
        <div className="min-w-0">
          {tag && <div className="mono-tag mb-1.5">{tag}</div>}
          <h3 className="text-[15px] font-medium tracking-tight text-white">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-[12px] text-muted">{subtitle}</p>
          )}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
