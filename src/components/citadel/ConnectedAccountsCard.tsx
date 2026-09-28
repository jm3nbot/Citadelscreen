"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Mail,
  Plus,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn, formatRelativeTime } from "@/lib/utils";

type AccountRow = {
  id: string;
  provider: "google";
  email: string;
  displayName?: string;
  picture?: string;
  scopes: string[];
  expiresAt: number;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
};

// Click-side host check. The OAuth redirect_uri (set in env / Google Cloud
// Console) is on 127.0.0.1, so the callback always lands there. If the
// user started the flow on localhost the state cookie went to a DIFFERENT
// cookie origin and the callback's state-cookie check fails → state_mismatch.
// Bounce the page to 127.0.0.1 before starting the flow.
function bounceLocalhost(e: React.MouseEvent) {
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    e.preventDefault();
    const next = new URL(window.location.href);
    next.hostname = "127.0.0.1";
    window.location.replace(next.toString());
  }
}

const ACCOUNT_ERRORS: Record<string, string> = {
  missing_code: "Google didn't return an authorization code.",
  state_mismatch:
    "CSRF state cookie didn't match — try again from http://127.0.0.1:3000/settings.",
  access_denied: "You declined Google's consent prompt.",
  no_refresh_token_revoke_and_retry:
    "Google didn't issue a refresh token. Revoke this app on https://myaccount.google.com/permissions and try again — that forces a fresh consent prompt.",
};

export function ConnectedAccountsCard() {
  const { data, isLoading, mutate } = useSWR<{ accounts: AccountRow[] }>(
    "/api/google-accounts",
    { refreshInterval: 60_000 }
  );
  const accounts = data?.accounts ?? [];

  // Surface OAuth success / failure that the callback redirected with.
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [flash, setFlash] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);

  useEffect(() => {
    const added = params.get("google_account_added");
    const err = params.get("google_account_error");
    if (added) {
      setFlash({ kind: "success", message: `Connected ${added}` });
      mutate();
    } else if (err) {
      setFlash({
        kind: "error",
        message: ACCOUNT_ERRORS[err] ?? `Failed to connect: ${err}`,
      });
    }
    if (added || err) {
      // Clean the URL so refresh doesn't re-fire the banner.
      const next = new URLSearchParams(params.toString());
      next.delete("google_account_added");
      next.delete("google_account_error");
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname);
    }
  }, [params, router, pathname, mutate]);

  // Auto-dismiss banner after 6 seconds.
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 6000);
    return () => clearTimeout(t);
  }, [flash]);

  const disconnect = async (id: string, email: string) => {
    if (!confirm(`Disconnect ${email}? You can re-add it any time.`)) return;
    await fetch(`/api/google-accounts/${id}`, { method: "DELETE" });
    mutate();
  };

  return (
    <Card className="mb-3">
      <CardHeader
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white">
            <Icon name="gmail" className="h-5 w-5" />
          </div>
        }
        tag="connections · accounts"
        title="Connected Accounts to Gmail"
        subtitle="Link your Google accounts into one Citadel."
        right={
          <a href="/api/google-accounts/connect" onClick={bounceLocalhost}>
            <Button
              size="sm"
              variant="primary"
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              Add Account
            </Button>
          </a>
        }
      />

      {flash && (
        <div
          className={cn(
            "mb-3 flex items-start gap-3 rounded-xl border p-3 text-[12px]",
            flash.kind === "success"
              ? "border-emerald-300/25 bg-emerald-300/[0.05]"
              : "border-rose-300/25 bg-rose-300/[0.05]"
          )}
        >
          {flash.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
          ) : (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
          )}
          <div className="flex-1 leading-snug text-white/90">
            {flash.message}
          </div>
          <button
            onClick={() => setFlash(null)}
            className="text-[10px] uppercase tracking-wider text-muted-soft hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {isLoading && accounts.length === 0 ? (
        <div className="py-3 text-[11.5px] text-muted">Loading accounts…</div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-5 text-center">
          <Mail
            className="mx-auto h-5 w-5 text-muted-soft"
            strokeWidth={1.6}
          />
          <div className="mt-2 text-[13px] text-white">
            No Google accounts connected yet.
          </div>
          <div className="mt-1 text-[11.5px] text-muted">
            Add an account to start building your unified inbox.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {accounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              onDisconnect={() => disconnect(a.id, a.email)}
            />
          ))}
        </div>
      )}

      <p className="mt-3 text-[10.5px] text-muted-soft">
        Tokens are encrypted at rest with AES-256-GCM in{" "}
        <code className="text-muted">data/connected-accounts.json</code>.
        They never reach the browser.
      </p>
    </Card>
  );
}

function AccountCard({
  account,
  onDisconnect,
}: {
  account: AccountRow;
  onDisconnect: () => void;
}) {
  const expiresSoon = account.expiresAt * 1000 < Date.now() + 5 * 60_000;
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 transition-colors hover:border-white/[0.10]">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]">
        {account.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={account.picture}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          <Icon name="gmail" className="h-5 w-5" />
        )}
        {/* Tiny corner badge so the Google source is always obvious even
            when the user's profile photo is loaded as the main avatar. */}
        <div className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-ink-100 bg-white">
          <Icon name="gmail" className="h-2.5 w-2.5" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[12.5px] font-medium tracking-tight text-white">
            {account.email}
          </span>
          <span className="rounded-md border border-emerald-300/25 bg-emerald-300/[0.06] px-1.5 py-px text-[9.5px] tracking-wider text-emerald-200">
            CONNECTED
          </span>
        </div>
        {account.displayName && (
          <div className="mt-0.5 truncate text-[11px] text-muted">
            {account.displayName}
          </div>
        )}
        <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-soft">
          <span className="inline-flex items-center gap-1">
            <RefreshCw className="h-2.5 w-2.5" strokeWidth={2} />
            {account.lastSyncedAt
              ? `Synced ${formatRelativeTime(account.lastSyncedAt)}`
              : "Never synced"}
          </span>
          {expiresSoon && (
            <span className="text-amber-300">Token expires soon</span>
          )}
        </div>
      </div>
      <button
        onClick={onDisconnect}
        title="Disconnect"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted opacity-0 transition-all hover:border-rose-300/30 hover:text-rose-300 group-hover:opacity-100"
      >
        <LogOut className="h-3 w-3" strokeWidth={1.8} />
      </button>
    </div>
  );
}
