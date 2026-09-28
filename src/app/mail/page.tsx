"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Mail, RefreshCw, Plus, AlertTriangle } from "lucide-react";
import type { UnifiedMail, AccountFetchError } from "@/app/api/unified-mail/route";

type UnifiedResp = {
  emails?: UnifiedMail[];
  errors?: AccountFetchError[];
  accounts?: Array<{ id: string; email: string; displayName?: string }>;
  empty?: boolean;
};

export default function UnifiedMailPage() {
  const { data, isLoading, mutate } = useSWR<UnifiedResp>(
    "/api/unified-mail",
    { refreshInterval: 120_000 }
  );
  const [tab, setTab] = useState<string>("__all");

  const accounts = data?.accounts ?? [];
  const live = !data?.empty && (data?.emails?.length ?? 0) > 0;

  // No fallback emails — empty list when there's nothing connected. The
  // CTA banner below tells the user to connect a Google account.
  const emails = data?.emails ?? [];

  // Filter by account tab. "__all" is the default merged view.
  const filtered = useMemo(() => {
    if (tab === "__all") return emails;
    return emails.filter((e) => e.source.accountId === tab);
  }, [emails, tab]);

  const totalsByAccount = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of emails) {
      m.set(e.source.accountId, (m.get(e.source.accountId) ?? 0) + 1);
    }
    return m;
  }, [emails]);

  return (
    <div className="h-full overflow-auto bg-dot-grid">
      <div className="mx-auto max-w-[1400px] px-6 py-7">
        <PageHeader
          icon={
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.06] bg-white">
              <Icon name="gmail" className="h-6 w-6" />
            </div>
          }
          tag={
            data?.empty
              ? "unified · sample"
              : live
              ? `unified · ${accounts.length} account${accounts.length === 1 ? "" : "s"}`
              : "unified · loading"
          }
          title="Unified Mail"
          subtitle={
            data?.empty
              ? "No Google accounts connected yet. Add an account to start building your unified inbox."
              : "Every connected Google inbox in one stream. Sorted newest first."
          }
          right={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="subtle"
                icon={
                  <RefreshCw
                    className={cn(
                      "h-3 w-3",
                      isLoading && "animate-spin"
                    )}
                  />
                }
                onClick={() => mutate()}
              >
                Refresh
              </Button>
              <a href="/api/google-accounts/connect">
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus className="h-3.5 w-3.5" />}
                >
                  Add Account
                </Button>
              </a>
            </div>
          }
        />

        {/* Per-account errors surfaced so the user knows when one account
            silently failed without taking down the whole view. */}
        {data?.errors && data.errors.length > 0 && (
          <div className="mb-4 space-y-2">
            {data.errors.map((err) => (
              <div
                key={err.accountId}
                className="flex items-start gap-3 rounded-xl border border-rose-300/25 bg-rose-300/[0.05] p-3 text-[11.5px] text-rose-200/90"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
                <div>
                  <span className="text-white">{err.email}</span> — {err.error}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty-state CTA banner */}
        {data?.empty && (
          <div className="mb-5 flex flex-col items-start gap-3 rounded-2xl border border-accent/25 bg-accent/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/[0.10] text-accent">
                <Mail className="h-4 w-4" strokeWidth={1.7} />
              </div>
              <div>
                <div className="text-[13px] font-medium tracking-tight text-white">
                  No Google accounts connected yet.
                </div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-muted">
                  Add an account to start building your unified inbox. What
                  you see below is sample data.
                </div>
              </div>
            </div>
            <a href="/api/google-accounts/connect">
              <Button
                variant="primary"
                icon={<Plus className="h-3.5 w-3.5" />}
              >
                Add Account
              </Button>
            </a>
          </div>
        )}

        {/* Account tabs */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <TabButton
            active={tab === "__all"}
            onClick={() => setTab("__all")}
            label="All Mail"
            count={emails.length}
          />
          {accounts.map((a) => (
            <TabButton
              key={a.id}
              active={tab === a.id}
              onClick={() => setTab(a.id)}
              label={a.email}
              count={totalsByAccount.get(a.id) ?? 0}
            />
          ))}
        </div>

        <Card>
          {isLoading && filtered.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-muted">
              Loading mail…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center">
              <Mail
                className="mx-auto h-5 w-5 text-muted-soft"
                strokeWidth={1.6}
              />
              <div className="mt-2 text-[13px] text-white">
                Nothing in this view.
              </div>
              <div className="mt-1 text-[11.5px] text-muted">
                Try the All Mail tab or refresh.
              </div>
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((em) => (
                <EmailRow key={`${em.source.accountId}:${em.id}`} email={em} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11.5px] tracking-tight transition-all",
        active
          ? "border-accent/30 bg-accent/[0.06] text-white shadow-glow-sm"
          : "border-white/[0.05] bg-white/[0.015] text-muted hover:text-white"
      )}
    >
      <span className="max-w-[180px] truncate">{label}</span>
      <span
        className={cn(
          "rounded-md border px-1.5 py-px text-[9.5px] tabular-nums tracking-wider",
          active
            ? "border-accent/30 bg-accent/[0.08] text-white"
            : "border-white/[0.06] bg-white/[0.02] text-muted"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function EmailRow({ email: em }: { email: UnifiedMail }) {
  return (
    <li className="group flex items-start gap-3 rounded-lg border border-transparent px-2.5 py-2.5 transition-colors hover:border-white/[0.06] hover:bg-white/[0.015]">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-[10px] font-medium text-white/80">
        {em.fromInitials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[12.5px] tracking-tight text-white">
            {em.subject}
          </span>
          {em.unread && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="truncate text-[11px] text-muted">
            {em.from}
            <span className="text-muted-soft"> · {em.snippet}</span>
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[10px] text-muted-soft">
          {formatRelativeTime(em.receivedAt)}
        </span>
        {/* Source-account badge — tells the user which inbox this is from. */}
        <span className="max-w-[160px] truncate rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-px text-[9.5px] tracking-wider text-muted-soft">
          {em.source.email}
        </span>
      </div>
    </li>
  );
}
