"use client";

import { useEffect } from "react";
import { useCitadel } from "@/lib/store";
import type { AccentKey, GridIntensity } from "@/lib/store";

const accentRgb: Record<AccentKey, string> = {
  cyan: "125 211 252", // sky-300
  ice: "226 232 240", // slate-200
  violet: "192 132 252", // violet-300
  lime: "190 242 100", // lime-300
  amber: "252 211 77", // amber-300
  red: "248 113 113", // red-400 — warm but not garish on dark
};

// "#rrggbb" → "r g b" (matches the format Tailwind reads via
// `rgb(var(--accent-rgb) / <alpha-value>)`). Returns null on malformed input.
function hexToRgbSpaceTriplet(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 0xff} ${(n >> 8) & 0xff} ${n & 0xff}`;
}

const gridOpacity: Record<GridIntensity, string> = {
  off: "0",
  veryLight: "0.025",
  normal: "0.06",
  bold: "0.16",
};

// HSL → RGB (each channel 0-255). Used by the rainbow easter egg so we can
// sweep the accent CSS variable through the full hue circle without
// dragging in a colour library.
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  // h in [0, 360), s/l in [0, 100]
  const sf = s / 100;
  const lf = l / 100;
  const c = (1 - Math.abs(2 * lf - 1)) * sf;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else[r, g, b] = [c, 0, x];
  const m = lf - c / 2;
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function staticAccent(
  accent: AccentKey,
  customAccent: string | undefined
): string {
  const custom = customAccent ? hexToRgbSpaceTriplet(customAccent) : null;
  return custom ?? accentRgb[accent] ?? accentRgb.cyan;
}

export function ThemeBridge() {
  const accent = useCitadel((s) => s.prefs.accent);
  const customAccent = useCitadel((s) => s.prefs.customAccent);
  const gridIntensity = useCitadel((s) => s.prefs.gridIntensity);
  const rainbowUntil = useCitadel((s) => s.prefs.rainbowUntil);
  const rainbowSpeed = useCitadel((s) => s.prefs.rainbowSpeed);
  const clearRainbow = useCitadel((s) => s.clearRainbow);

  // Static accent — only runs when rainbow is OFF. When rainbow is on, the
  // rainbow effect below owns --accent-rgb until it auto-stops.
  useEffect(() => {
    if (rainbowUntil && Date.now() < rainbowUntil) return;
    const root = document.documentElement;
    root.style.setProperty("--accent-rgb", staticAccent(accent, customAccent));
  }, [accent, customAccent, rainbowUntil]);

  // Rainbow animation. Hue cycles full 360° at a speed determined by
  // rainbowSpeed: "normal" = 6s/cycle, "super" = 3s/cycle. Super mode also
  // pushes saturation+lightness ~30% higher so glows / shadows pop more.
  useEffect(() => {
    if (!rainbowUntil || Date.now() >= rainbowUntil) return;
    const isSuper = rainbowSpeed === "super";
    const cycleMs = isSuper ? 3000 : 6000;
    const saturation = isSuper ? 100 : 85; // ~+17% (clamped at 100)
    const lightness = isSuper ? 70 : 65; // ~+8%
    let raf = 0;
    const root = document.documentElement;
    const t0 = performance.now();
    const tick = (t: number) => {
      if (Date.now() >= rainbowUntil) {
        root.style.setProperty(
          "--accent-rgb",
          staticAccent(accent, customAccent)
        );
        // Restore static glow alpha when leaving super.
        if (isSuper) root.style.setProperty("--accent-glow-boost", "1");
        clearRainbow();
        return;
      }
      const hue = ((t - t0) / cycleMs) * 360;
      const [r, g, b] = hslToRgb(hue % 360, saturation, lightness);
      root.style.setProperty("--accent-rgb", `${r} ${g} ${b}`);
      // Glow boost knob — consumed by anywhere that wants a brighter halo
      // during super mode. Use as `calc(<base-alpha> * var(--accent-glow-boost))`.
      root.style.setProperty("--accent-glow-boost", isSuper ? "1.3" : "1");
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rainbowUntil, rainbowSpeed, accent, customAccent, clearRainbow]);

  useEffect(() => {
    const root = document.documentElement;
    const op = gridOpacity[gridIntensity ?? "normal"] ?? gridOpacity.normal;
    root.style.setProperty("--grid-opacity", op);
  }, [gridIntensity]);

  return null;
}
