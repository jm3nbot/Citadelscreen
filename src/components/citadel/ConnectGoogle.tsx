"use client";

import { signIn, signOut } from "next-auth/react";
import useSWR from "swr";
import { useAuthStatus } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LogOut, AlertTriangle } from "lucide-react";

type StatusResp = { configured: boolean };

export function ConnectGoogle({ compact = false }: { compact?: boolean }) {
  const { signedIn, loading, user, error } = useAuthStatus();
  const { data } = useSWR<StatusResp>("/api/status");
  const configured = data?.configured;

  if (loading) {
    return (
      <span className="text-[11px] text-muted">checking session…</span>
    );
  }

  if (configured === false) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.04] px-3 py-2 text-[11.5px] text-amber-200">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <div className="tracking-tight text-white">Google not configured</div>
          <div className="mt-0.5 text-amber-200/80">
            Add <code className="text-white">GOOGLE_CLIENT_ID</code> and{" "}
            <code className="text-white">GOOGLE_CLIENT_SECRET</code> to{" "}
            <code className="text-white">.env.local</code> — see{" "}
            <code className="text-white">SETUP-GOOGLE.md</code>.
          </div>
        </div>
      </div>
    );
  }

  if (signedIn) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.04] px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.8)]" />
          <span className="text-[11px] tracking-tight text-emerald-200">
            {user?.email ?? "Connected"}
          </span>
        </div>
        {!compact && (
          <Button
            size="sm"
            variant="subtle"
            icon={<LogOut className="h-3 w-3" />}
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Sign out
          </Button>
        )}
        {error === "RefreshAccessTokenError" && (
          <span className="text-[10px] text-rose-300">re-auth needed</span>
        )}
      </div>
    );
  }

  return (
    <Button
      variant="primary"
      onClick={() => signIn("google", { callbackUrl: "/" })}
      icon={<Icon name="google" className="h-3.5 w-3.5" />}
    >
      Connect Google
    </Button>
  );
}
