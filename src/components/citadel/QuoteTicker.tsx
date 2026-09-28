"use client";

import { useEffect, useMemo, useState } from "react";
import { Quote as QuoteIcon } from "lucide-react";
import { useCitadel } from "@/lib/store";
import { cn } from "@/lib/utils";

// CSS-driven marquee. We render the quote list twice end-to-end and animate
// the track by -50% so the second copy seamlessly takes over when the first
// scrolls off. Pure CSS, no JS frame-by-frame work — sips battery on laptops.
//
// Direction matches news-ticker convention: text moves LEFTWARD across the
// strip, new headlines emerge from the right edge. Adjust direction by
// flipping the keyframe values + initial offset.
export function QuoteTicker({ className }: { className?: string }) {
  const quotes = useCitadel((s) => s.quotes);
  // Suppress hydration mismatch — the store rehydrates client-side.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Loop duration scales with quote count so longer playlists don't whip past.
  // ~9 seconds per quote feels comfortably readable.
  const duration = Math.max(28, quotes.length * 9);

  // Render the list twice — same items, same order — so the animation can
  // translate by exactly -50% and produce a seamless loop.
  const doubled = useMemo(() => [...quotes, ...quotes], [quotes]);

  if (!hydrated || quotes.length === 0) return null;

  return (
    <div
      className={cn(
        "relative flex h-7 min-w-0 items-center overflow-hidden rounded-md border border-white/[0.05] bg-white/[0.02] px-2",
        className
      )}
      title="Quote book — open from Reminders to edit"
    >
      <QuoteIcon className="mr-2 h-3 w-3 shrink-0 text-accent/70" strokeWidth={1.8} />
      {/* Fade masks on both edges */}
      <div className="pointer-events-none absolute left-7 top-0 z-10 h-full w-6 bg-gradient-to-r from-ink-50 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-6 bg-gradient-to-l from-ink-50 to-transparent" />
      <div className="relative flex w-full min-w-0 overflow-hidden">
        <div
          className="flex shrink-0 whitespace-nowrap will-change-transform"
          style={{
            animation: `citadel-ticker ${duration}s linear infinite`,
          }}
        >
          {doubled.map((q, i) => (
            <span
              key={`${q.id}-${i}`}
              className="mx-6 text-[11.5px] tracking-tight text-white/85"
            >
              <span>{q.text}</span>
              {q.author && (
                <span className="ml-2 text-muted">— {q.author}</span>
              )}
              <span className="ml-6 text-muted-soft">·</span>
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes citadel-ticker {
          from {
            transform: translateX(0);
          }
          to {
            /* -50% lines up the second copy exactly where the first started */
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
