"use client";

import useSWR from "swr";
import { Music, LogOut, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

type StatusResp = {
  configured?: boolean;
  connected?: boolean;
  account?: { displayName?: string };
};

// Sibling to <ConnectGoogle>. Drives the standalone cookie-based Spotify
// flow — completely separate from NextAuth so it can't trample the Google
// session. Connect = redirect to /api/spotify/connect (server handles OAuth);
// disconnect = clear the Spotify cookie without touching the Google JWT.
export function ConnectSpotify({ compact = false }: { compact?: boolean }) {
  const { data, mutate, isLoading } = useSWR<StatusResp>(
    "/api/spotify/status",
    { refreshInterval: 30_000 }
  );
  const configured = data?.configured;
  const connected = !!data?.connected;

  if (isLoading) {
    return <span className="text-[11px] text-muted">checking…</span>;
  }

  if (configured === false) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.04] px-3 py-2 text-[11.5px] text-amber-200">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <div className="tracking-tight text-white">Spotify not configured</div>
          <div className="mt-0.5 text-amber-200/80">
            Add <code className="text-white">SPOTIFY_CLIENT_ID</code> and{" "}
            <code className="text-white">SPOTIFY_CLIENT_SECRET</code> to{" "}
            <code className="text-white">.env.local</code>, then restart the dev server.
          </div>
        </div>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.04] px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.8)]" />
          <span className="text-[11px] tracking-tight text-emerald-200">
            {data?.account?.displayName ?? "Connected"}
          </span>
        </div>
        {!compact && (
          <Button
            size="sm"
            variant="subtle"
            icon={<LogOut className="h-3 w-3" />}
            onClick={async () => {
              await fetch("/api/spotify/disconnect", { method: "POST" });
              mutate();
            }}
          >
            Disconnect Spotify
          </Button>
        )}
      </div>
    );
  }

  // Hostname check happens HERE in the browser (where window.location is
  // authoritative) instead of server-side, where Next.js dev's req.url can
  // misreport the host and cause redirect loops. If we're on localhost, bounce
  // the whole page to 127.0.0.1 first — Spotify's Dashboard only accepts that
  // exact host for the redirect URI, and cookies don't cross between them.
  const handleConnect = (e: React.MouseEvent) => {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      e.preventDefault();
      const next = new URL(window.location.href);
      next.hostname = "127.0.0.1";
      window.location.replace(next.toString());
    }
  };

  return (
    <a href="/api/spotify/connect" onClick={handleConnect}>
      <Button variant="primary" icon={<Music className="h-3.5 w-3.5" />}>
        Connect Spotify
      </Button>
    </a>
  );
}
