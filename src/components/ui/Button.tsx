"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "ghost" | "subtle" | "danger";

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: "sm" | "md";
    icon?: React.ReactNode;
  }
>(({ className, variant = "default", size = "md", icon, children, ...props }, ref) => {
  const base =
    "relative inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-tight transition-all disabled:opacity-50 disabled:pointer-events-none";
  const sizes = {
    sm: "h-7 px-2.5 text-[11.5px]",
    md: "h-8 px-3 text-[12px]",
  };
  const variants: Record<Variant, string> = {
    default:
      "border border-white/[0.07] bg-white/[0.03] text-white hover:border-accent/30 hover:bg-accent/[0.05] hover:shadow-glow-sm",
    primary:
      "border border-accent/30 bg-accent/[0.08] text-white hover:bg-accent/[0.14] hover:border-accent/50 hover:shadow-glow",
    ghost:
      "text-muted hover:bg-white/[0.03] hover:text-white",
    subtle:
      "border border-white/[0.04] bg-transparent text-muted hover:bg-white/[0.025] hover:text-white",
    danger:
      "border border-red-500/20 bg-red-500/[0.06] text-red-300 hover:bg-red-500/[0.12]",
  };
  return (
    <button
      ref={ref}
      className={cn(base, sizes[size], variants[variant], className)}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
});
Button.displayName = "Button";
