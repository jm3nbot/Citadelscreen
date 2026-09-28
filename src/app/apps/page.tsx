"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { sampleApps } from "@/lib/data/apps";
import { cn } from "@/lib/utils";
import { brandChip } from "@/lib/brand";
import type { AppConnection } from "@/lib/types";
import { useCitadel } from "@/lib/store";
import { useIntegrationStatus } from "@/lib/hooks";
import { Pin, PinOff } from "lucide-react";
import { ApiKeyModal, API_KEY_PROVIDERS } from "@/components/citadel/ApiKeyModal";

const tabs: Array<{ id: AppConnection["status"] | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "connected", label: "Connected" },
  { id: "not_connected", label: "Not connected" },
  { id: "coming_soon", label: "Coming soon" },
];

// IDs whose connection state we determine live (via /api/integrations/status).
// Anything not in this map keeps its sampleApps status — we don't pretend to
// know about apps we haven't actually wired up.
const LIVE_PROVIDERS: Record<string, string> = {
  // OAuth providers
  gmail: "google",
  calendar: "google",
  drive: "google",
  docs: "google",
  sheets: "google",
  github: "github",
  spotify: "spotify",
  notion: "notion",
  slack: "slack",
  linear: "linear",
  figma: "figma",
  discord: "discord",
  // BYOK providers (per-user API key cookie)
  claude: "claude",
  chatgpt: "openai",
  gemini: "gemini",
  n8n: "n8n",
  vapi: "vapi",
  vercel: "vercel",
};

// Per-provider entry point for the Connect button. Three shapes:
//   { kind: "oauth", url } → window.location → provider OAuth dance
//   { kind: "byok",  metaKey } → open ApiKeyModal with API_KEY_PROVIDERS[metaKey]
//   null                       → no in-app flow (kept for legacy hooks)
type ConnectFlow =
  | { kind: "oauth"; url: string }
  | { kind: "byok"; metaKey: string }
  | null;

const CONNECT_FLOWS: Record<string, ConnectFlow> = {
  gmail: { kind: "oauth", url: "/api/auth/signin/google" },
  calendar: { kind: "oauth", url: "/api/auth/signin/google" },
  drive: { kind: "oauth", url: "/api/auth/signin/google" },
  docs: { kind: "oauth", url: "/api/auth/signin/google" },
  sheets: { kind: "oauth", url: "/api/auth/signin/google" },
  github: { kind: "oauth", url: "/api/github/connect" },
  spotify: { kind: "oauth", url: "/api/spotify/connect" },
  notion: { kind: "oauth", url: "/api/notion/connect" },
  slack: { kind: "oauth", url: "/api/slack/connect" },
  linear: { kind: "oauth", url: "/api/linear/connect" },
  figma: { kind: "oauth", url: "/api/figma/connect" },
  discord: { kind: "oauth", url: "/api/discord/connect" },
  // BYOK — clicking opens the paste-key modal instead of redirecting
  claude: { kind: "byok", metaKey: "claude" },
  chatgpt: { kind: "byok", metaKey: "chatgpt" },
  gemini: { kind: "byok", metaKey: "gemini" },
  n8n: { kind: "byok", metaKey: "n8n" },
  vapi: { kind: "byok", metaKey: "vapi" },
  vercel: { kind: "byok", metaKey: "vercel" },
};

// All cookie-based OAuth flows compare the registered callback host exactly,
// so users on `localhost` need to bounce to `127.0.0.1` first or the state +
// token cookies won't survive the round-trip. NextAuth's Google path tolerates
// either host, so we don't bounce for it.
function startOAuth(target: string) {
  const needsBounce =
    target.startsWith("/api/github") ||
    target.startsWith("/api/spotify") ||
    target.startsWith("/api/notion") ||
    target.startsWith("/api/slack") ||
    target.startsWith("/api/linear") ||
    target.startsWith("/api/figma") ||
    target.startsWith("/api/discord");
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost" &&
    needsBounce
  ) {
    const next = new URL(window.location.href);
    next.hostname = "127.0.0.1";
    next.pathname = "/apps";
    window.location.replace(next.toString());
    return;
  }
  window.location.href = target;
}

export default function AppsPage() {
  const [tab, setTab] = useState<AppConnection["status"] | "all">("all");
  const setSelectedNodeId = useCitadel((s) => s.setSelectedNodeId);
  const pinnedApps = useCitadel((s) => s.pinnedApps);
  const togglePinApp = useCitadel((s) => s.togglePinApp);
  const { status, refresh: refreshStatus } = useIntegrationStatus();
  // BYOK modal state — null when closed, otherwise the meta entry to show.
  const [byokMetaKey, setByokMetaKey] = useState<string | null>(null);

  // Replace sample status with real connection state for providers we actually
  // check. Apps without a live integration drop to "not_connected" — never
  // pretend "connected" without proof.
  const apps = sampleApps.map((a) => {
    const provider = LIVE_PROVIDERS[a.id];
    if (!provider) return a;
    const block = status?.[provider];
    const isConnected = Boolean(block?.connected);
    return { ...a, status: isConnected ? "connected" : "not_connected" } as AppConnection;
  });

  const filtered = tab === "all" ? apps : apps.filter((a) => a.status === tab);

  return (
    <div className="h-full overflow-auto bg-dot-grid">
      <div className="mx-auto max-w-[1400px] px-6 py-7">
        <PageHeader
          tag="apps"
          title="Your connected tools."
          subtitle="Manage every app that lives inside your Citadel — connected, available, or queued."
        />

        <div className="mb-5 flex items-center gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[11.5px] tracking-tight transition-all",
                tab === t.id
                  ? "border-accent/30 bg-accent/[0.06] text-white shadow-glow-sm"
                  : "border-white/[0.05] bg-white/[0.015] text-muted hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <motion.div
          layout
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {filtered.map((app) => {
            // The whole card acts as the inspect trigger for connected apps.
            // Pin / Connect / Configure buttons stopPropagation so they don't
            // also open the panel when clicked.
            const isClickable = app.status === "connected";
            const onCardClick = isClickable
              ? () => setSelectedNodeId(app.id)
              : undefined;
            return (
              <Card
                key={app.id}
                className={cn(
                  "flex flex-col",
                  isClickable && "cursor-pointer hover:border-accent/40"
                )}
                onClick={onCardClick}
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={
                  isClickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedNodeId(app.id);
                        }
                      }
                    : undefined
                }
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border",
                      brandChip[app.icon.toLowerCase()] ??
                        "border-white/[0.06] bg-white/[0.02]"
                    )}
                  >
                    <Icon name={app.icon} className="h-4 w-4 text-white/85" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-[14px] font-medium tracking-tight text-white">
                        {app.name}
                      </h3>
                      <StatusBadge status={app.status} />
                    </div>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-muted">
                      {app.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  {app.status === "connected" && (
                    <Button
                      size="sm"
                      variant="subtle"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinApp(app.id);
                      }}
                      icon={
                        pinnedApps.includes(app.id) ? (
                          <PinOff className="h-3 w-3" />
                        ) : (
                          <Pin className="h-3 w-3" />
                        )
                      }
                      title={
                        pinnedApps.includes(app.id)
                          ? "Remove from dashboard"
                          : "Pin to dashboard"
                      }
                    >
                      {pinnedApps.includes(app.id) ? "Pinned" : "Pin"}
                    </Button>
                  )}
                  {app.status === "not_connected" &&
                    (() => {
                      const flow = CONNECT_FLOWS[app.id];
                      if (!flow) {
                        return (
                          <Button size="sm" variant="subtle" disabled>
                            Configure in .env
                          </Button>
                        );
                      }
                      return (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (flow.kind === "oauth") {
                              startOAuth(flow.url);
                            } else {
                              setByokMetaKey(flow.metaKey);
                            }
                          }}
                        >
                          Connect
                        </Button>
                      );
                    })()}
                  {app.status === "coming_soon" && (
                    <Button size="sm" variant="subtle" disabled>
                      Coming soon
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </motion.div>
      </div>

      {/* BYOK paste-key modal. Mounted at the page root so its z-index sits
          above the cards regardless of which one triggered it. */}
      <ApiKeyModal
        meta={byokMetaKey ? API_KEY_PROVIDERS[byokMetaKey] ?? null : null}
        open={!!byokMetaKey}
        onClose={() => setByokMetaKey(null)}
        onConnected={() => {
          // Re-fetch integration status so the card flips to LIVE immediately.
          refreshStatus();
        }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: AppConnection["status"] }) {
  const map = {
    connected: { label: "live", cls: "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200" },
    not_connected: { label: "off", cls: "border-white/[0.06] bg-white/[0.02] text-muted" },
    coming_soon: { label: "soon", cls: "border-accent/15 bg-accent/[0.04] text-accent" },
  } as const;
  const c = map[status];
  return (
    <span className={cn("rounded-md border px-1.5 py-px text-[9px] tracking-wider", c.cls)}>
      {c.label.toUpperCase()}
    </span>
  );
}
