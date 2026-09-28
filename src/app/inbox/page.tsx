"use client";

import { useMemo, useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime, cn } from "@/lib/utils";
import { Sparkles, BellPlus, RefreshCw, Flag, Star, Clock, AlertTriangle, LogOut, Trash2, ChevronUp, ChevronDown, Plus } from "lucide-react";
import { signOut, signIn } from "next-auth/react";
import { useCitadel } from "@/lib/store";
import { useGmail, useAuthStatus } from "@/lib/hooks";
import { ConnectGoogle } from "@/components/citadel/ConnectGoogle";
import { Icon } from "@/components/ui/Icon";
import type { Email } from "@/lib/types";
import type { UnifiedMail, UnifiedAccount } from "@/app/api/unified-mail/route";
import useSWR from "swr";
import { useAssistant } from "@/lib/ai-client";
import { AiActionModal } from "@/components/citadel/AiActionModal";

type UnifiedMailResp = {
  emails?: UnifiedMail[];
  accounts?: UnifiedAccount[];
  empty?: boolean;
};

const tabs = ["All", "Needs reply", "Priority", "Unread", "Flagged"] as const;

type Flag = "todo" | "later" | "important" | "read";

export default function InboxPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("All");
  // accountFilter: "all" = merged across every connected account,
  //                "primary" = only the NextAuth Google session account,
  //                <connected-id> = only that specific connected account.
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const addReminder = useCitadel((s) => s.addReminder);
  const { emails, live, loading, refresh, error, meta } = useGmail();
  const { signedIn } = useAuthStatus();
  // AI plumbing — shared with the dashboard assistant card.
  const ai = useAssistant();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTitle, setAiTitle] = useState("AI summary");
  const [aiSubtitle, setAiSubtitle] = useState<string | undefined>(undefined);

  const openAiAction = (prompt: string, title: string, subtitle?: string) => {
    setAiTitle(title);
    setAiSubtitle(subtitle);
    ai.reset();
    setAiOpen(true);
    ai.ask(prompt);
  };
  // Multi-account roster + per-source-tagged emails come from /api/unified-mail.
  // We layer those ON TOP of the existing single-account useGmail() flow so
  // Star/Trash mutations keep working for the primary account.
  const { data: unified } = useSWR<UnifiedMailResp>(
    "/api/unified-mail",
    { refreshInterval: 120_000 }
  );
  const unifiedAccounts = unified?.accounts ?? [];
  const unifiedEmails = useMemo(() => unified?.emails ?? [], [unified]);
  // Index from message id → source account so each row can show its
  // origin badge ("to: ...") without re-fetching.
  const sourceById = useMemo(() => {
    const m = new Map<string, UnifiedMail["source"]>();
    for (const e of unifiedEmails) m.set(e.id, e.source);
    return m;
  }, [unifiedEmails]);
  // Transient error from a Star/Trash mutation. Surfaced as a banner that
  // auto-dismisses after a few seconds so the user actually sees when an
  // action fails (previously it was silent).
  const [actionError, setActionError] = useState<{
    message: string;
    needsReauth?: boolean;
  } | null>(null);

  // Mutate one email's state. Optimistically updates the local SWR cache so
  // the star toggles / row disappears IMMEDIATELY, then fires the API. If
  // the API rejects, we revert via revalidate.
  const mutateEmail = async (id: string, action: "trash" | "star" | "unstar") => {
    if (!live) return;
    setActionError(null);

    type GmailResp = { emails?: Email[] };
    const apply = (curr: GmailResp | undefined): GmailResp => {
      if (!curr?.emails) return curr ?? {};
      if (action === "trash") {
        return { ...curr, emails: curr.emails.filter((e) => e.id !== id) };
      }
      const nextStarred = action === "star";
      return {
        ...curr,
        emails: curr.emails.map((e) =>
          e.id === id ? { ...e, starred: nextStarred } : e
        ),
      };
    };

    try {
      await refresh(
        async (current) => {
          const res = await fetch(`/api/gmail/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          });
          let body: { error?: string; needsReauth?: boolean; apiDisabled?: boolean } = {};
          try {
            body = await res.json();
          } catch {}
          if (!res.ok) {
            const message =
              body.needsReauth
                ? "Your Gmail token can't modify mail. Click Re-authenticate below."
                : body.apiDisabled
                ? "Gmail API isn't enabled in your Google Cloud project."
                : `Gmail rejected the action (${res.status}: ${body.error ?? "unknown"})`;
            const err: Error & { needsReauth?: boolean } = new Error(message);
            err.needsReauth = body.needsReauth;
            throw err;
          }
          return apply(current);
        },
        {
          optimisticData: apply,
          rollbackOnError: true,
          // Re-fetch from Gmail after to confirm truth (labels updated, etc.).
          revalidate: true,
          populateCache: true,
        }
      );
    } catch (e) {
      const err = e as Error & { needsReauth?: boolean };
      setActionError({
        message: err.message ?? "Action failed",
        needsReauth: err.needsReauth,
      });
      // Auto-dismiss after 6 seconds so the banner doesn't pile up.
      window.setTimeout(() => setActionError(null), 6000);
    }
  };

  // Local per-email flags persisted in localStorage. Keyed by
  // `<accountId>:<emailId>` so the same Gmail message id from two different
  // connected accounts can't collide. Older flags written without an account
  // prefix are auto-migrated to "primary:<id>" on load.
  const [flags, setFlags] = useState<Record<string, Flag>>({});
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("citadel-email-flags");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, Flag>;
      // Migrate any keys that don't already have an account prefix.
      const migrated: Record<string, Flag> = {};
      for (const [k, v] of Object.entries(parsed)) {
        migrated[k.includes(":") ? k : `primary:${k}`] = v;
      }
      setFlags(migrated);
    } catch {}
  }, []);
  const flagKey = (em: Email) => {
    const src = sourceById.get(em.id);
    const acct = src?.accountId ?? "primary";
    return `${acct}:${em.id}`;
  };
  const setFlag = (em: Email, f: Flag | null) => {
    const key = flagKey(em);
    setFlags((prev) => {
      const next = { ...prev };
      if (f === null) delete next[key];
      else next[key] = f;
      try {
        window.localStorage.setItem("citadel-email-flags", JSON.stringify(next));
      } catch {}
      return next;
    });
  };
  const flagFor = (em: Email): Flag | undefined => flags[flagKey(em)];

  const summary = useMemo(
    () => ({
      total: emails.length,
      unread: emails.filter((e) => e.unread).length,
      needsReply: emails.filter((e) => e.needsReply).length,
      highPriority: emails.filter((e) => e.priority === "high").length,
      flagged: Object.keys(flags).length,
    }),
    [emails, flags]
  );

  // Two data sources depending on accountFilter:
  //   - "primary": rich primary-only stream from /api/gmail (priority,
  //                needsReply, etc., and mutations work).
  //   - "all" or <connected-id>: cross-account stream from /api/unified-mail,
  //                filtered to that account if a specific id is chosen.
  // The list shape stays Email[] so all the downstream UI keeps working;
  // unified rows are adapted with `source`-tagged fallback values.
  const list = useMemo(() => {
    let base: Email[];
    if (accountFilter === "primary") {
      base = emails;
    } else {
      const fromUnified: Email[] = unifiedEmails
        .filter((u) =>
          accountFilter === "all" ? true : u.source.accountId === accountFilter
        )
        .map((u) => ({
          id: u.id,
          from: u.from,
          fromEmail: u.fromEmail,
          fromInitials: u.fromInitials,
          subject: u.subject,
          preview: u.snippet,
          receivedAt: u.receivedAt,
          unread: u.unread,
          starred: u.starred,
          priority: u.starred ? "high" : "normal",
          needsReply: u.unread && u.starred,
          tags: [],
        }));
      base = fromUnified;
    }
    return base.filter((em) => {
      if (tab === "Needs reply") return em.needsReply;
      if (tab === "Priority") return em.priority === "high";
      if (tab === "Unread") return em.unread;
      if (tab === "Flagged") return !!flagFor(em);
      return true;
    });
  }, [emails, unifiedEmails, accountFilter, tab, flags]);

  const [selected, setSelected] = useState<Email | undefined>(undefined);
  useEffect(() => {
    if (!selected && list.length) setSelected(list[0]);
    else if (selected && !list.find((e) => e.id === selected.id) && list.length) {
      setSelected(list[0]);
    }
  }, [list, selected]);

  // Pick the next email AFTER the given one in the current list — falling
  // back to the previous if we're at the end. Used after Trash so the user
  // keeps reading downward instead of getting yanked back to the top.
  const pickNeighbor = (id: string): Email | undefined => {
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return list[0];
    return list[idx + 1] ?? list[idx - 1];
  };

  // Arrow-key navigation across the inbox list. Cmd/Ctrl combinations are
  // left alone (browser shortcuts), and we ignore keypresses while focused
  // in a text input so it doesn't fight typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          t.isContentEditable
        )
          return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "j" && e.key !== "k") return;
      if (list.length === 0) return;
      const idx = selected ? list.findIndex((em) => em.id === selected.id) : -1;
      const dir = e.key === "ArrowUp" || e.key === "k" ? -1 : 1;
      const next = idx === -1 ? list[0] : list[(idx + dir + list.length) % list.length];
      if (next) {
        e.preventDefault();
        setSelected(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list, selected]);

  return (
    <div className="h-full overflow-auto bg-dot-grid">
      <div className="mx-auto max-w-[1400px] px-6 py-7">
        <PageHeader
          icon={
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.06] bg-white">
              <Icon name="gmail" className="h-6 w-6" />
            </div>
          }
          tag={live ? "inbox · gmail · live" : "inbox · gmail · sample"}
          title="Threads that matter."
          subtitle={
            live
              ? "Live Gmail data. Flag emails to triage them — flags persist locally."
              : "Sample inbox. Connect Google to load your real Gmail."
          }
          right={
            <div className="flex items-center gap-2">
              <ConnectGoogle compact />
              {live && (
                <Button
                  size="sm"
                  variant="subtle"
                  icon={<RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />}
                  onClick={() => refresh()}
                >
                  Refresh
                </Button>
              )}
              <Button
                size="sm"
                variant="primary"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() =>
                  openAiAction(
                    "Summarize the most important emails in my inbox right now. Group by what needs a response vs. FYI, cite each email by its [N] index, and mention which account each is in if there are multiple accounts.",
                    `${ai.name}: Inbox summary`,
                    "Most important threads across all connected accounts"
                  )
                }
              >
                AI summary
              </Button>
            </div>
          }
        />

        {actionError && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-rose-300/25 bg-rose-300/[0.05] px-4 py-2.5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" strokeWidth={1.8} />
              <div className="text-[11.5px] leading-snug text-rose-200">
                {actionError.message}
              </div>
            </div>
            {actionError.needsReauth && (
              <Button
                size="sm"
                variant="default"
                icon={<LogOut className="h-3.5 w-3.5" />}
                onClick={async () => {
                  await signOut({ redirect: false });
                  signIn("google", { callbackUrl: "/inbox" });
                }}
              >
                Re-authenticate
              </Button>
            )}
          </div>
        )}

        {signedIn && error && (
          <div className="mb-5 flex flex-col items-start gap-3 rounded-2xl border border-rose-300/25 bg-rose-300/[0.04] p-4">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-300/30 bg-rose-300/[0.08] text-rose-200">
                  <AlertTriangle className="h-4 w-4" strokeWidth={1.6} />
                </div>
                <div>
                  <div className="text-[13px] font-medium tracking-tight text-white">
                    {error.body?.apiDisabled
                      ? "Gmail API is not enabled in your Google Cloud project."
                      : error.body?.needsReauth
                      ? "Token is missing the Gmail scope."
                      : "Gmail returned an error."}
                  </div>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-rose-200/85">
                    <span className="font-mono text-white">
                      {error.status ?? "—"} · {error.body?.reason ?? error.body?.error ?? error.message}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {error.body?.needsReauth && (
                  <Button
                    size="sm"
                    variant="default"
                    icon={<LogOut className="h-3.5 w-3.5" />}
                    onClick={async () => {
                      await signOut({ redirect: false });
                      signIn("google", { callbackUrl: "/inbox" });
                    }}
                  >
                    Re-authenticate
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="subtle"
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                  onClick={() => refresh()}
                >
                  Retry
                </Button>
              </div>
            </div>

            {error.body?.apiDisabled && (
              <div className="w-full rounded-lg border border-rose-300/15 bg-black/30 p-3 text-[11.5px] leading-relaxed text-rose-100/90">
                <div className="mb-1.5 font-medium text-white">Fix in 3 steps (~2 minutes):</div>
                <ol className="ml-4 list-decimal space-y-1">
                  <li>
                    Open{" "}
                    <a
                      className="text-sky-300 underline underline-offset-2 hover:text-white"
                      target="_blank"
                      rel="noreferrer"
                      href={
                        error.body.projectId
                          ? `https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=${error.body.projectId}`
                          : "https://console.cloud.google.com/apis/library/gmail.googleapis.com"
                      }
                    >
                      console.cloud.google.com → APIs &amp; Services → Library → Gmail API
                    </a>
                    {error.body.projectId && (
                      <>
                        {" "}(project <code className="text-white">{error.body.projectId}</code> — opened automatically by that link)
                      </>
                    )}
                  </li>
                  <li>
                    Click <span className="text-white">Enable</span>. Wait ~30 seconds for propagation.
                  </li>
                  <li>
                    Hit <span className="text-white">Retry</span> above. While you're there, enable{" "}
                    <a
                      className="text-sky-300 underline underline-offset-2 hover:text-white"
                      target="_blank"
                      rel="noreferrer"
                      href={
                        error.body.projectId
                          ? `https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=${error.body.projectId}`
                          : "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"
                      }
                    >
                      Calendar API
                    </a>{" "}
                    and{" "}
                    <a
                      className="text-sky-300 underline underline-offset-2 hover:text-white"
                      target="_blank"
                      rel="noreferrer"
                      href={
                        error.body.projectId
                          ? `https://console.cloud.google.com/apis/library/drive.googleapis.com?project=${error.body.projectId}`
                          : "https://console.cloud.google.com/apis/library/drive.googleapis.com"
                      }
                    >
                      Drive API
                    </a>{" "}
                    too — they'll hit the same wall otherwise.
                  </li>
                </ol>
                <div className="mt-2 text-rose-200/70">
                  Why this happens — when you created an OAuth client in Cloud Console,
                  the individual product APIs (Gmail, Calendar, Drive) aren't enabled by default.
                  Authorizing the user grants the <em>scope</em>, but the <em>API itself</em> still needs to be turned on for the project.
                  Re-signing in won't fix it.
                </div>
              </div>
            )}
          </div>
        )}

        {signedIn && !error && live && emails.length === 0 && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-sky-300/20 bg-sky-300/[0.04] p-4">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-300/30 bg-sky-300/[0.08] text-sky-200">
              <Sparkles className="h-4 w-4" strokeWidth={1.6} />
            </div>
            <div>
              <div className="text-[13px] font-medium tracking-tight text-white">
                Connected to {meta?.profileEmail ?? "Gmail"} — inbox is empty.
              </div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-sky-200/85">
                Query <code className="text-white">{meta?.query ?? "in:inbox"}</code> returned no messages.
                If you expected mail here, check that you signed in with the right account,
                or try the <a className="underline" href="/api/gmail?q=newer_than:30d">broader query (last 30 days)</a>.
              </div>
            </div>
          </div>
        )}

        {!signedIn && (
          <div className="mb-5 flex flex-col items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-300/30 bg-amber-300/[0.08] text-amber-200">
                <Sparkles className="h-4 w-4" strokeWidth={1.6} />
              </div>
              <div>
                <div className="text-[13px] font-medium tracking-tight text-white">
                  Connect Google to load your inbox.
                </div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-amber-200/85">
                  No mail is shown until a Google account is connected — unread messages will appear at the top once it is.
                </div>
              </div>
            </div>
            <ConnectGoogle />
          </div>
        )}

        {/* Compact stat strip — single thin row instead of five chunky
            cards. Same information, ~60% less vertical real estate. */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2">
          <Stat label="Unread" value={summary.unread} accent />
          <StatDivider />
          <Stat label="Needs reply" value={summary.needsReply} />
          <StatDivider />
          <Stat label="High priority" value={summary.highPriority} />
          <StatDivider />
          <Stat label="Flagged" value={summary.flagged} />
          <StatDivider />
          <Stat label="Total" value={summary.total} muted />
        </div>

        {/* Connected accounts strip: every account this user has wired up
            (NextAuth primary + multi-account flow), shown minimalistically
            with their Google profile picture. Click any chip to filter the
            inbox below to that account; click "All Mail" to merge them. */}
        {unifiedAccounts.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <AccountChip
              active={accountFilter === "all"}
              onClick={() => setAccountFilter("all")}
              label="All Mail"
              count={unifiedEmails.length}
            />
            {unifiedAccounts.map((a) => {
              const count = unifiedEmails.filter(
                (e) => e.source.accountId === a.id
              ).length;
              return (
                <AccountChip
                  key={a.id}
                  active={accountFilter === a.id}
                  onClick={() => setAccountFilter(a.id)}
                  label={a.email}
                  picture={a.picture}
                  isPrimary={a.isPrimary}
                  count={count}
                />
              );
            })}
            <a
              href="/api/google-accounts/connect"
              onClick={(e) => {
                // Same client-side bounce so localhost users land on the
                // 127.0.0.1 origin BEFORE the OAuth state cookie is set.
                if (
                  typeof window !== "undefined" &&
                  window.location.hostname === "localhost"
                ) {
                  e.preventDefault();
                  const next = new URL(window.location.href);
                  next.hostname = "127.0.0.1";
                  window.location.replace(next.toString());
                }
              }}
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-dashed border-white/[0.10] bg-white/[0.015] px-2.5 py-1 text-[10.5px] tracking-tight text-muted hover:border-accent/40 hover:text-white"
            >
              <Plus className="h-3 w-3" /> Add Account
            </a>
          </div>
        )}

        <div className="mb-4 flex items-center gap-1.5">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[11.5px] tracking-tight transition-all",
                tab === t
                  ? "border-accent/30 bg-accent/[0.06] text-white shadow-glow-sm"
                  : "border-white/[0.05] bg-white/[0.015] text-muted hover:text-white"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-3">
          <Card className="col-span-12 lg:col-span-5">
            {loading && (
              <div className="py-6 text-center text-[12px] text-muted">
                Loading inbox…
              </div>
            )}
            {!loading && list.length === 0 && (
              <div className="py-6 text-center text-[12px] text-muted">
                No messages.
              </div>
            )}
            <ul className="space-y-1">
              {list.map((em) => (
                <li
                  key={em.id}
                  onClick={() => setSelected(em)}
                  className={cn(
                    "group flex cursor-pointer items-start gap-3 rounded-lg border px-2.5 py-2.5 transition-colors",
                    selected?.id === em.id
                      ? "border-accent/25 bg-accent/[0.04]"
                      : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.015]"
                  )}
                >
                  <SenderAvatar email={em} className="h-7 w-7 shrink-0 rounded-md text-[10px]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12.5px] tracking-tight text-white">
                        {em.subject}
                      </span>
                      {em.unread && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      )}
                      {em.starred && (
                        <Star className="h-3 w-3 shrink-0 fill-amber-300 text-amber-300" strokeWidth={1.5} />
                      )}
                      {flagFor(em) && <FlagBadge flag={flagFor(em)!} />}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="truncate text-[11px] text-muted">
                        {em.from} · {em.preview}
                      </span>
                    </div>
                    {/* Source-account badge — "to: which account this landed in".
                        Shown only when there's more than one connected
                        account, otherwise it's just noise. */}
                    {unifiedAccounts.length > 1 && sourceById.get(em.id) && (
                      <div className="mt-1 inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[9.5px] tracking-tight text-muted-soft">
                        {sourceById.get(em.id)?.picture ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={sourceById.get(em.id)!.picture!}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-3 w-3 rounded-full object-cover"
                          />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-accent/50" />
                        )}
                        <span className="truncate max-w-[180px]">
                          to: {sourceById.get(em.id)?.email}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {live && (
                      <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            mutateEmail(em.id, em.starred ? "unstar" : "star");
                          }}
                          title={em.starred ? "Unstar" : "Star"}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-soft hover:bg-amber-300/[0.10] hover:text-amber-300"
                        >
                          <Star
                            className={cn(
                              "h-3.5 w-3.5",
                              em.starred && "fill-amber-300 text-amber-300"
                            )}
                            strokeWidth={1.6}
                          />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Pick the NEXT email BEFORE firing the mutation so the
                            // user keeps reading downward.
                            if (selected?.id === em.id) {
                              setSelected(pickNeighbor(em.id));
                            }
                            mutateEmail(em.id, "trash");
                          }}
                          title="Move to Bin"
                          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-soft hover:bg-rose-300/[0.10] hover:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                        </button>
                      </div>
                    )}
                    <div className="text-[10px] text-muted-soft">
                      {formatRelativeTime(em.receivedAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="col-span-12 lg:col-span-7">
            {!selected ? (
              <div className="py-10 text-center text-[12px] text-muted">
                Select an email.
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <SenderAvatar
                      email={selected}
                      className="h-11 w-11 shrink-0 rounded-xl text-[13px]"
                    />
                    <div className="min-w-0">
                      <div className="mono-tag truncate">{selected.from}</div>
                      <h3 className="mt-1 truncate text-[16px] font-medium tracking-tight text-white">
                        {selected.subject}
                      </h3>
                      <p className="mt-0.5 text-[11.5px] text-muted">
                        {formatRelativeTime(selected.receivedAt)} ·{" "}
                        {selected.priority.toUpperCase()}{" "}
                        {selected.needsReply && "· needs reply"}
                        {selected.fromEmail && (
                          <span className="text-muted-soft"> · {selected.fromEmail}</span>
                        )}
                      </p>
                      {/* "Inbox: which connected account" — only shown
                          when there are 2+ accounts so it's not pointless. */}
                      {unifiedAccounts.length > 1 && sourceById.get(selected.id) && (
                        <div className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[10px] tracking-tight text-muted">
                          {sourceById.get(selected.id)?.picture && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={sourceById.get(selected.id)!.picture!}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="h-3.5 w-3.5 rounded-full object-cover"
                            />
                          )}
                          <span className="text-muted-soft">to:</span>
                          <span className="text-white">
                            {sourceById.get(selected.id)?.email}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {/* Prev / Next navigation. Always visible (works in sample
                        mode too). Disabled at the ends; keyboard ↑/↓ + j/k
                        also wired up via the keydown effect above. */}
                    <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
                      {(() => {
                        const idx = list.findIndex((em) => em.id === selected.id);
                        const prevDisabled = idx <= 0;
                        const nextDisabled = idx === -1 || idx >= list.length - 1;
                        return (
                          <>
                            <button
                              disabled={prevDisabled}
                              onClick={() => {
                                if (idx > 0) setSelected(list[idx - 1]);
                              }}
                              title="Previous email (↑ or k)"
                              className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                                prevDisabled
                                  ? "text-muted-soft/50"
                                  : "text-muted hover:bg-white/[0.05] hover:text-white"
                              )}
                            >
                              <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.8} />
                            </button>
                            <button
                              disabled={nextDisabled}
                              onClick={() => {
                                if (idx < list.length - 1) setSelected(list[idx + 1]);
                              }}
                              title="Next email (↓ or j)"
                              className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                                nextDisabled
                                  ? "text-muted-soft/50"
                                  : "text-muted hover:bg-white/[0.05] hover:text-white"
                              )}
                            >
                              <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.8} />
                            </button>
                          </>
                        );
                      })()}
                    </div>
                    {live && (
                      <>
                        <button
                          onClick={() =>
                            mutateEmail(selected.id, selected.starred ? "unstar" : "star")
                          }
                          title={selected.starred ? "Unstar" : "Star (syncs to Gmail)"}
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                            selected.starred
                              ? "border-amber-300/30 bg-amber-300/[0.08] text-amber-300"
                              : "border-white/[0.06] bg-white/[0.02] text-muted hover:border-amber-300/30 hover:text-amber-300"
                          )}
                        >
                          <Star
                            className={cn(
                              "h-3.5 w-3.5",
                              selected.starred && "fill-amber-300"
                            )}
                            strokeWidth={1.6}
                          />
                        </button>
                        <button
                          onClick={() => {
                            // Advance to the next email first — same UX as the
                            // hover-trash on each list row.
                            const next = pickNeighbor(selected.id);
                            mutateEmail(selected.id, "trash");
                            setSelected(next);
                          }}
                          title="Move to Bin (syncs to Gmail)"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-muted transition-colors hover:border-rose-300/30 hover:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                        </button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="default"
                      icon={<BellPlus className="h-3.5 w-3.5" />}
                      onClick={() =>
                        addReminder({
                          title: `Reply to: ${selected.subject}`,
                          description: `From ${selected.from}`,
                          priority: selected.priority === "high" ? "high" : "medium",
                          linkedAppId: "gmail",
                          dueAt: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
                        })
                      }
                    >
                      Reminder
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="mono-tag mr-1">flag</span>
                  <FlagPill
                    label="To-do"
                    active={flagFor(selected) === "todo"}
                    icon={<Flag className="h-3 w-3" />}
                    onClick={() => setFlag(selected, flagFor(selected) === "todo" ? null : "todo")}
                  />
                  <FlagPill
                    label="Later"
                    active={flagFor(selected) === "later"}
                    icon={<Clock className="h-3 w-3" />}
                    onClick={() => setFlag(selected, flagFor(selected) === "later" ? null : "later")}
                  />
                  <FlagPill
                    label="Important"
                    active={flagFor(selected) === "important"}
                    icon={<Star className="h-3 w-3" />}
                    onClick={() => setFlag(selected, flagFor(selected) === "important" ? null : "important")}
                  />
                  <FlagPill
                    label="Read"
                    active={flagFor(selected) === "read"}
                    onClick={() => setFlag(selected, flagFor(selected) === "read" ? null : "read")}
                  />
                </div>

                <div className="mt-4 rounded-lg border border-white/[0.04] bg-white/[0.01] p-4 text-[13px] leading-relaxed text-white/85">
                  {selected.preview}
                  <br />
                  <br />
                  <span className="text-muted">— {selected.from}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="primary"
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                    onClick={() => {
                      // We inline the selected email's metadata into the
                      // prompt so the model has the context even though it
                      // would also pull from the global email_context block.
                      const prompt = `Draft a concise, professional reply to this email. Match the sender's tone. Don't include a subject line — just the body. Sign off with "—" (no name).

EMAIL TO REPLY TO:
From: ${selected.from}${selected.fromEmail ? ` <${selected.fromEmail}>` : ""}
Subject: ${selected.subject}
Date: ${selected.receivedAt}
Body: ${selected.preview}`;
                      openAiAction(
                        prompt,
                        `${ai.name}: Draft reply`,
                        `To: ${selected.from} · "${selected.subject}"`
                      );
                    }}
                  >
                    Draft reply with AI
                  </Button>
                  <a
                    href={`https://mail.google.com/mail/u/0/#inbox/${selected.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="default">Open in Gmail</Button>
                  </a>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      <AiActionModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        title={aiTitle}
        subtitle={aiSubtitle}
        loading={ai.loading}
        reply={ai.reply?.reply ?? null}
        error={ai.error}
      />
    </div>
  );
}

// Compute a SHA-256 hex digest of the lowercased email — Gravatar's modern
// hash format (they accepted MD5 historically; SHA-256 has been supported
// since 2023). We use SubtleCrypto so no MD5 lib is needed.
async function gravatarHash(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const data = new TextEncoder().encode(normalized);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Sender avatar — tries the real face via Gravatar first (many senders have
// one wired to their email), then falls back to DiceBear's gradient
// initials. The `?d=404` tells Gravatar to 404 (not serve a default) on
// miss so onError fires and we render the fallback.
function SenderAvatar({
  email,
  className,
}: {
  email: Email;
  className?: string;
}) {
  const seed = email.fromEmail || email.from;
  const [gravatar, setGravatar] = useState<string | null>(null);
  const [gravatarFailed, setGravatarFailed] = useState(false);
  const [diceFailed, setDiceFailed] = useState(false);

  useEffect(() => {
    setGravatar(null);
    setGravatarFailed(false);
    setDiceFailed(false);
    if (!email.fromEmail) return;
    let cancelled = false;
    gravatarHash(email.fromEmail)
      .then((hash) => {
        if (!cancelled) {
          setGravatar(`https://www.gravatar.com/avatar/${hash}?d=404&s=128`);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [email.fromEmail]);

  const diceBearUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
    seed
  )}&backgroundType=gradientLinear&fontFamily=Geist&fontWeight=600&radius=50`;

  const showGravatar = gravatar && !gravatarFailed;
  const showDice = !showGravatar && !diceFailed;

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden border border-white/[0.06] bg-white/[0.02] font-medium text-white/85",
        className
      )}
    >
      {showGravatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={gravatar!}
          alt=""
          onError={() => setGravatarFailed(true)}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : showDice ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={diceBearUrl}
          alt=""
          onError={() => setDiceFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{email.fromInitials}</span>
      )}
    </div>
  );
}

function AccountChip({
  active,
  onClick,
  label,
  picture,
  isPrimary,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  picture?: string;
  isPrimary?: boolean;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[11px] tracking-tight transition-all",
        active
          ? "border-accent/40 bg-accent/[0.08] text-white shadow-glow-sm"
          : "border-white/[0.06] bg-white/[0.02] text-muted hover:border-white/[0.14] hover:text-white"
      )}
    >
      {picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={picture}
          alt=""
          referrerPolicy="no-referrer"
          className="h-4 w-4 rounded-full object-cover"
        />
      ) : isPrimary === undefined ? (
        // "All Mail" pseudo-account — no picture, just a soft accent dot.
        <span className="h-2 w-2 rounded-full bg-accent/60" />
      ) : (
        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.02] text-[8px] uppercase text-muted">
          {label[0]}
        </span>
      )}
      <span className="max-w-[160px] truncate">{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 py-px text-[9.5px] tabular-nums tracking-wider",
          active ? "bg-accent/[0.12] text-white" : "bg-white/[0.03] text-muted-soft"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function Stat({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: number;
  accent?: boolean;
  muted?: boolean;
}) {
  // Inline pill rendering: label + value side-by-side, tabular-nums so the
  // numbers don't jitter when they change. Accent variant lights up the
  // most-actionable stat (Unread); muted variant softens the "Total" tail.
  return (
    <div className="flex items-center gap-1.5 px-1 text-[11px] tracking-tight">
      <span className={cn("text-muted", muted && "text-muted-soft")}>
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          accent ? "text-accent" : muted ? "text-muted" : "text-white"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function StatDivider() {
  return <span className="h-3 w-px bg-white/[0.06]" />;
}

const flagStyles: Record<Flag, string> = {
  todo: "border-accent/25 bg-accent/[0.08] text-accent",
  later: "border-sky-300/20 bg-sky-300/[0.06] text-sky-200",
  important: "border-amber-300/20 bg-amber-300/[0.06] text-amber-200",
  read: "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200",
};

function FlagBadge({ flag }: { flag: Flag }) {
  return (
    <span className={cn("rounded-md border px-1.5 py-px text-[9px] tracking-wider", flagStyles[flag])}>
      {flag.toUpperCase()}
    </span>
  );
}

function FlagPill({
  label,
  active,
  icon,
  onClick,
}: {
  label: string;
  active: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10.5px] tracking-tight transition-colors",
        active
          ? "border-accent/30 bg-accent/[0.08] text-white shadow-glow-sm"
          : "border-white/[0.06] bg-white/[0.02] text-muted hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
