"use client";

import { cn } from "@/lib/utils";

// Animated AI core. Designed to feel like a small living entity — concentric
// rings rotating at different speeds with a soft central orb that breathes.
// All animations are pure CSS / SVG transforms so it costs nothing on the
// JS event loop.
//
// States:
//   - idle: slow breathe, slow ring rotation
//   - thinking: faster rotation, brighter glow, additional pulse ring
//   - error: rings frozen, single muted red dot

export type AiCoreState = "idle" | "thinking" | "error";

export function AiCore({
  state = "idle",
  size = 96,
  className,
}: {
  state?: AiCoreState;
  size?: number;
  className?: string;
}) {
  const isError = state === "error";
  const isThinking = state === "thinking";

  return (
    <div
      className={cn("relative", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* Soft outer glow — accent in idle, accent-bright in thinking,
          rose-tinted in error. Sits behind everything. */}
      <div
        className={cn(
          "absolute inset-0 rounded-full blur-2xl transition-opacity",
          isError
            ? "bg-rose-400/30 opacity-60"
            : isThinking
            ? "bg-accent/40 opacity-90"
            : "bg-accent/20 opacity-60"
        )}
        style={{
          animation: isThinking
            ? "ai-core-breathe 1.6s ease-in-out infinite"
            : "ai-core-breathe 3.6s ease-in-out infinite",
        }}
      />

      {/* SVG rings + orb. Two rings counter-rotating, dashed pattern for
          the "orbiting dots" feel. */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        fill="none"
      >
        <defs>
          <radialGradient id="ai-core-orb" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgb(var(--accent-rgb))" stopOpacity="0.95" />
            <stop offset="60%" stopColor="rgb(var(--accent-rgb))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="rgb(var(--accent-rgb))" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ai-core-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(var(--accent-rgb))" stopOpacity="0.9" />
            <stop offset="100%" stopColor="rgb(var(--accent-rgb))" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Outermost ring — full circle, slowly rotating, dashed */}
        <circle
          cx="50"
          cy="50"
          r="46"
          stroke={isError ? "rgb(248 113 113 / 0.7)" : "url(#ai-core-ring)"}
          strokeWidth="0.8"
          strokeDasharray="2 4"
          style={{
            transformOrigin: "50% 50%",
            animation: isError
              ? "none"
              : `ai-core-spin ${isThinking ? "6s" : "18s"} linear infinite`,
          }}
        />

        {/* Middle ring — counter-rotating, brighter, denser dashes */}
        <circle
          cx="50"
          cy="50"
          r="34"
          stroke={isError ? "rgb(248 113 113 / 0.45)" : "rgb(var(--accent-rgb) / 0.55)"}
          strokeWidth="0.6"
          strokeDasharray="1 2.5"
          style={{
            transformOrigin: "50% 50%",
            animation: isError
              ? "none"
              : `ai-core-spin-reverse ${isThinking ? "4s" : "12s"} linear infinite`,
          }}
        />

        {/* Inner solid ring — provides definition around the orb */}
        <circle
          cx="50"
          cy="50"
          r="22"
          stroke={isError ? "rgb(248 113 113 / 0.6)" : "rgb(var(--accent-rgb) / 0.4)"}
          strokeWidth="0.6"
        />

        {/* Central orb */}
        <circle
          cx="50"
          cy="50"
          r="16"
          fill={isError ? "rgb(248 113 113 / 0.5)" : "url(#ai-core-orb)"}
          style={{
            transformOrigin: "50% 50%",
            animation: isError
              ? "none"
              : `ai-core-orb-pulse ${isThinking ? "1.2s" : "2.8s"} ease-in-out infinite`,
          }}
        />

        {/* Thinking-only pulse ring expanding outward */}
        {isThinking && (
          <circle
            cx="50"
            cy="50"
            r="22"
            fill="none"
            stroke="rgb(var(--accent-rgb) / 0.7)"
            strokeWidth="0.5"
            style={{
              transformOrigin: "50% 50%",
              animation: "ai-core-emit 1.6s ease-out infinite",
            }}
          />
        )}
      </svg>

      <style jsx>{`
        @keyframes ai-core-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes ai-core-spin-reverse {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes ai-core-breathe {
          0%, 100% { transform: scale(0.92); opacity: 0.5; }
          50%      { transform: scale(1.05); opacity: 0.9; }
        }
        @keyframes ai-core-orb-pulse {
          0%, 100% { transform: scale(0.95); opacity: 0.85; }
          50%      { transform: scale(1.08); opacity: 1; }
        }
        @keyframes ai-core-emit {
          0%   { transform: scale(0.65); opacity: 0.9; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
