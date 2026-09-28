"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import {
  useCitadel,
  type FeatureFlags,
  type AccentKey,
  type GridIntensity,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { RotateCcw, Eraser, AlertTriangle, CheckCircle2, Pipette } from "lucide-react";
import { ConnectGoogle } from "@/components/citadel/ConnectGoogle";
import { ConnectSpotify } from "@/components/citadel/ConnectSpotify";
import { ConnectedAccountsCard } from "@/components/citadel/ConnectedAccountsCard";
import { Icon } from "@/components/ui/Icon";

// Human-readable messages for the spotify_error codes that the callback
// route forwards to /settings. Anything not in this map renders as-is so we
// always show *something* rather than swallowing unknowns.
const SPOTIFY_ERRORS: Record<string, string> = {
  state_mismatch:
    "CSRF state didn't match. This usually means you started the flow from localhost but Spotify only accepts 127.0.0.1 — open the app at http://127.0.0.1:3000 instead.",
  missing_code: "Spotify didn't return an authorization code.",
  access_denied: "You declined the Spotify consent prompt.",
  wrong_host_localhost:
    "You can't start the Spotify flow from localhost — open the app at http://127.0.0.1:3000/settings and try again.",
};

const features: Array<{
  key: keyof FeatureFlags;
  label: string;
  description: string;
}> = [
  { key: "inbox", label: "Inbox", description: "Show Gmail surface on dashboard & node graph." },
  { key: "calendar", label: "Calendar", description: "Show Calendar surface on dashboard & node graph." },
  { key: "reminders", label: "Reminders", description: "Show reminders surface on dashboard." },
  { key: "automations", label: "Automations", description: "Surface n8n workflows on dashboard." },
  { key: "aiTools", label: "AI Tools", description: "Show ChatGPT, Claude, and brief generators." },
  { key: "drive", label: "Drive", description: "Show Drive on dashboard & node graph." },
  { key: "tasks", label: "Tasks", description: "Show tasks on dashboard." },
  { key: "network", label: "Network editor", description: "Enable the standalone Network page." },
];

// Swatches are pure CSS — they don't depend on the accent CSS var so they always render true colors.
const accents: Array<{ id: AccentKey; swatch: string; label: string }> = [
  { id: "cyan", swatch: "from-sky-300 to-cyan-300", label: "Cyan" },
  { id: "ice", swatch: "from-slate-200 to-zinc-200", label: "Ice" },
  { id: "violet", swatch: "from-fuchsia-300 to-violet-300", label: "Violet" },
  { id: "red", swatch: "from-rose-400 to-red-500", label: "Red" },
  { id: "lime", swatch: "from-lime-300 to-emerald-300", label: "Lime" },
  { id: "amber", swatch: "from-amber-300 to-orange-300", label: "Amber" },
];

const gridOptions: Array<{ id: GridIntensity; label: string; sub: string }> = [
  { id: "off", label: "Off", sub: "Clean canvas" },
  { id: "veryLight", label: "Very light", sub: "Barely visible" },
  { id: "normal", label: "Normal", sub: "Subtle dots" },
  { id: "bold", label: "Bold", sub: "Super visible · brighter edges" },
];

function SpotifyFlashBanner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const err = params.get("spotify_error");
    const ok = params.get("spotify");
    if (err) {
      setError(SPOTIFY_ERRORS[err] ?? `Spotify error: ${err}`);
    }
    if (ok === "connected") setSuccess(true);
    if (err || ok) {
      // Strip the query params so a refresh doesn't keep firing the banner.
      const fresh = new URLSearchParams(params.toString());
      fresh.delete("spotify_error");
      fresh.delete("spotify");
      const next = fresh.toString();
      router.replace(next ? `${pathname}?${next}` : pathname);
    }
  }, [params, router, pathname]);

  if (!error && !success) return null;
  return (
    <div
      className={cn(
        "mb-4 flex items-start gap-3 rounded-2xl border p-4",
        error
          ? "border-rose-300/25 bg-rose-300/[0.05]"
          : "border-emerald-300/25 bg-emerald-300/[0.05]"
      )}
    >
      {error ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" strokeWidth={1.7} />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" strokeWidth={1.7} />
      )}
      <div className="min-w-0 flex-1 text-[12px] leading-relaxed">
        <div className="text-white">
          {error ? "Spotify connection failed" : "Spotify connected"}
        </div>
        {error && (
          <div className="mt-0.5 text-rose-200/85">{error}</div>
        )}
      </div>
      <button
        onClick={() => {
          setError(null);
          setSuccess(false);
        }}
        className="text-[10px] uppercase tracking-wider text-muted-soft hover:text-white"
      >
        Dismiss
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const prefs = useCitadel((s) => s.prefs);
  const setFeature = useCitadel((s) => s.setFeature);
  const setAccent = useCitadel((s) => s.setAccent);
  const setCustomAccent = useCitadel((s) => s.setCustomAccent);
  const setGridIntensity = useCitadel((s) => s.setGridIntensity);
  const setShowMinimap = useCitadel((s) => s.setShowMinimap);
  const setAnimateEdges = useCitadel((s) => s.setAnimateEdges);
  const setMinimalNodes = useCitadel((s) => s.setMinimalNodes);
  const setViewMode = useCitadel((s) => s.setViewMode);
  const resetNodePositions = useCitadel((s) => s.resetNodePositions);
  const showAllNodes = useCitadel((s) => s.showAllNodes);

  const currentAccent = prefs.accent ?? "cyan";
  const currentGrid = prefs.gridIntensity ?? "normal";

  return (
    <div className="h-full overflow-auto bg-dot-grid">
      <div className="mx-auto max-w-[1100px] px-6 py-7">
        <PageHeader
          tag="settings · control panel"
          title="Tune your Citadel."
          subtitle="Enable surfaces, adjust the look, and reset state. Everything persists locally."
        />

        <SpotifyFlashBanner />

        <ConnectedAccountsCard />

        <Card className="mb-3">
          <CardHeader
            icon={
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white">
                <Icon name="google" className="h-5 w-5" />
              </div>
            }
            tag="connections · core"
            title="Core Account"
            subtitle="Connect to load real Gmail, Calendar, Drive, Docs, and Sheets. Read-only, revocable any time."
          />
          <div className="flex flex-wrap items-center gap-3">
            <ConnectGoogle />
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-muted underline-offset-4 hover:text-white hover:underline"
            >
              Manage app permissions ↗
            </a>
            <span className="text-[11px] text-muted">
              First time? See <code className="text-white/90">SETUP-GOOGLE.md</code> for the 5-min setup.
            </span>
          </div>
        </Card>

        <Card className="mb-3">
          <CardHeader
            icon={
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-black">
                <Icon name="spotify" className="h-5 w-5" />
              </div>
            }
            tag="connections · spotify"
            title="Spotify account"
            subtitle="Show what you're currently listening to in the top bar, and view your top tracks, artists, and recent plays from the network."
          />
          <div className="flex flex-wrap items-center gap-3">
            <ConnectSpotify />
            <a
              href="https://www.spotify.com/account/apps/"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-muted underline-offset-4 hover:text-white hover:underline"
            >
              Manage Spotify app permissions ↗
            </a>
            <span className="text-[11px] text-muted">
              Read-only — never modifies your library or queue.
            </span>
          </div>
        </Card>

        <div className="grid grid-cols-12 gap-3">
          <Card className="col-span-12 lg:col-span-7">
            <CardHeader
              tag="features"
              title="Enable surfaces"
              subtitle="Toggle dashboards and panels on or off. Start minimal — turn things on as you need them."
            />
            <div className="divide-y divide-white/[0.04]">
              {features.map((f) => (
                <Toggle
                  key={f.key}
                  checked={prefs.features[f.key]}
                  onChange={(v) => setFeature(f.key, v)}
                  label={f.label}
                  description={f.description}
                />
              ))}
            </div>
          </Card>

          <div className="col-span-12 space-y-3 lg:col-span-5">
            <Card>
              <CardHeader tag="appearance" title="Accent color" />
              <div className="flex flex-wrap items-center gap-2">
                {accents.map((a) => {
                  // Custom hex overrides — when set, no preset is "active".
                  const active = !prefs.customAccent && currentAccent === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => {
                        setAccent(a.id);
                        // Clear any custom hex so the preset takes effect.
                        setCustomAccent(undefined);
                      }}
                      className={cn(
                        "group relative flex h-11 w-11 items-center justify-center rounded-xl border transition-all",
                        active
                          ? "border-accent/55 shadow-glow-sm"
                          : "border-white/[0.06] hover:border-white/[0.20]"
                      )}
                      aria-label={`Accent ${a.label}`}
                      title={a.label}
                    >
                      <span
                        className={cn(
                          "h-5 w-5 rounded-full bg-gradient-to-br",
                          a.swatch
                        )}
                      />
                      {active && (
                        <span className="absolute -bottom-1 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-accent shadow-glow-sm" />
                      )}
                    </button>
                  );
                })}

                {/* Custom color picker — uses the native color input which
                    every desktop browser renders as a proper HSL wheel. We
                    style only the host chip so the swatch behind shows the
                    current hex (or the muted "+" affordance when unset). */}
                <label
                  className={cn(
                    "relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border transition-all",
                    prefs.customAccent
                      ? "border-accent/55 shadow-glow-sm"
                      : "border-dashed border-white/[0.14] hover:border-white/[0.30]"
                  )}
                  title="Pick a custom color"
                  aria-label="Pick a custom accent color"
                >
                  <input
                    type="color"
                    value={prefs.customAccent ?? "#7dd3fc"}
                    onChange={(e) => setCustomAccent(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  {prefs.customAccent ? (
                    <span
                      className="h-5 w-5 rounded-full"
                      style={{ background: prefs.customAccent }}
                    />
                  ) : (
                    <Pipette className="h-4 w-4 text-muted-soft" strokeWidth={1.7} />
                  )}
                  {prefs.customAccent && (
                    <span className="absolute -bottom-1 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-accent shadow-glow-sm" />
                  )}
                </label>

                {prefs.customAccent && (
                  <button
                    onClick={() => setCustomAccent(undefined)}
                    className="text-[10.5px] tracking-tight text-muted-soft underline-offset-4 hover:text-white hover:underline"
                  >
                    Clear custom
                  </button>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader tag="defaults" title="Mode preferences" />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={prefs.viewMode === "node" ? "primary" : "default"}
                  onClick={() => setViewMode("node")}
                >
                  Default · Node
                </Button>
                <Button
                  variant={prefs.viewMode === "dashboard" ? "primary" : "default"}
                  onClick={() => setViewMode("dashboard")}
                >
                  Default · Dashboard
                </Button>
              </div>
            </Card>

            <Card>
              <CardHeader
                tag="node graph"
                title="Graph behavior"
                subtitle="Tune the look of the network view."
              />

              <div className="mb-3">
                <div className="mono-tag mb-1.5">dotted grid</div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {gridOptions.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setGridIntensity(g.id)}
                      className={cn(
                        "rounded-lg border px-2 py-1.5 text-left transition-all",
                        currentGrid === g.id
                          ? "border-accent/30 bg-accent/[0.06] shadow-glow-sm"
                          : "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.18]"
                      )}
                    >
                      <div className="text-[11.5px] tracking-tight text-white">{g.label}</div>
                      <div className="text-[10px] text-muted">{g.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-white/[0.04]">
                <Toggle
                  checked={prefs.minimalNodes ?? false}
                  onChange={setMinimalNodes}
                  label="Minimalist nodes"
                  description="Show only logos in the graph (no names or descriptions). Hover for tooltips."
                />
                <Toggle
                  checked={prefs.animateEdges}
                  onChange={setAnimateEdges}
                  label="Animate edges"
                  description="Subtle flowing dashes on key connections."
                />
                <Toggle
                  checked={prefs.showMinimap}
                  onChange={setShowMinimap}
                  label="Show minimap"
                  description="Overview map in the bottom-left of the graph."
                />
              </div>
            </Card>
          </div>

          <Card className="col-span-12">
            <CardHeader
              tag="danger zone"
              title="Reset"
              subtitle="Local state is stored in your browser only."
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                onClick={() => resetNodePositions()}
              >
                Reset node positions
              </Button>
              <Button
                variant="default"
                onClick={() => showAllNodes()}
              >
                Show all hidden nodes
              </Button>
              <Button
                variant="danger"
                icon={<Eraser className="h-3.5 w-3.5" />}
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.localStorage.removeItem("citadel-store");
                    window.location.reload();
                  }
                }}
              >
                Clear all local state
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
