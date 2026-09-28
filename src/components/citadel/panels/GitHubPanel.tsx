"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  Github,
  ExternalLink,
  Plug,
  GitPullRequest,
  CircleDot,
  GitCommit,
  Star,
  GitFork,
  Eye,
  Flame,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Term = "short_term" | "medium_term" | "long_term";

type StatusResp = {
  configured?: boolean;
  connected?: boolean;
  account?: { login: string; name?: string; avatarUrl?: string };
  error?: string;
};

type IssueLike = {
  id: number;
  number: number;
  title: string;
  url: string;
  state: string;
  repo: string;
  updatedAt: string;
  draft: boolean;
  author?: string;
};

type StatsResp = {
  term?: Term;
  profile?: {
    login: string;
    name: string;
    bio: string;
    avatar?: string;
    url?: string;
    followers: number;
    following: number;
    publicRepos: number;
    company?: string;
    location?: string;
    totalStars: number;
  };
  counts?: {
    openPrs: number;
    reviewRequests: number;
    openIssues: number;
  };
  topRepos?: Array<{
    id: number;
    name: string;
    fullName: string;
    private: boolean;
    description: string | null;
    url: string;
    language: string | null;
    stars: number;
    forks: number;
    openIssues: number;
    pushedAt: string;
    defaultBranch: string;
  }>;
  topLanguages?: Array<{ name: string; count: number; percent: number }>;
  openPrs?: IssueLike[];
  reviewRequests?: IssueLike[];
  recentIssues?: IssueLike[];
  heatmap?: {
    total: number;
    commits: number;
    prs: number;
    issues: number;
    reviews: number;
    weeks: Array<Array<{ date: string; count: number; color: string }>>;
  } | null;
  error?: string;
};

type ActivityResp = {
  login?: string;
  headline?: {
    kind: string;
    title: string;
    detail?: string;
    url?: string;
    at?: string;
  } | null;
  feed?: Array<{
    id: string;
    at: string;
    kind: string;
    repo: string;
    title: string;
    detail?: string;
    url?: string;
  }>;
};

const TERMS: Array<{ key: Term; label: string }> = [
  { key: "short_term", label: "4 wks" },
  { key: "medium_term", label: "6 mo" },
  { key: "long_term", label: "All time" },
];

// Map GitHub's calendar colors (light->dark green on light bg) into something
// readable on the dark panel. We key off the contribution count buckets the
// GraphQL API uses so the legend is consistent.
function heatColor(count: number): string {
  if (count <= 0) return "bg-white/[0.03] border border-white/[0.02]";
  if (count <= 2) return "bg-violet-400/20";
  if (count <= 5) return "bg-violet-400/40";
  if (count <= 9) return "bg-violet-400/65";
  return "bg-violet-300";
}

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

// Compute the current streak from the heatmap so we can show a flame chip.
// Walks back from today as long as days have >= 1 contribution; tolerates
// "today" being a zero (you might not have committed yet) without resetting.
function currentStreak(weeks: Array<Array<{ count: number }>>): number {
  const days = weeks.flat();
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) streak++;
    else if (i === days.length - 1) continue;
    else break;
  }
  return streak;
}

export function GitHubPanel() {
  const [term, setTerm] = useState<Term>("short_term");

  const { data: status } = useSWR<StatusResp>("/api/github/status");
  const connected = !!status?.connected;
  const configured = status?.configured !== false;

  const { data: activity } = useSWR<ActivityResp>(
    connected ? "/api/github/activity" : null,
    { refreshInterval: 30_000 }
  );
  const { data: stats, isLoading } = useSWR<StatsResp>(
    connected ? `/api/github/stats?term=${term}` : null
  );

  const streak = useMemo(() => {
    if (!stats?.heatmap?.weeks?.length) return 0;
    return currentStreak(stats.heatmap.weeks);
  }, [stats?.heatmap?.weeks]);

  // ---- Not configured (developer-only message: the OAuth App is missing) ----
  if (!configured) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4">
          <Plug className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" strokeWidth={1.7} />
          <div className="text-[11.5px] leading-relaxed text-amber-200/85">
            <div className="text-white">GitHub integration not set up</div>
            <div className="mt-1">
              The app owner needs to register a GitHub OAuth App and set{" "}
              <code className="text-white">GITHUB_CLIENT_ID</code> and{" "}
              <code className="text-white">GITHUB_CLIENT_SECRET</code> in{" "}
              <code className="text-white">.env.local</code>. Once that's done,
              you'll see a Connect button here.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Not connected (user just hasn't signed in to GitHub yet) ----
  if (!connected) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Github className="h-4 w-4 text-violet-300" strokeWidth={1.7} />
            <div className="text-[13px] tracking-tight text-white">Connect GitHub</div>
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted">
            Sign in with your GitHub account to see your top repos, languages,
            contribution heatmap, open PRs, review requests, and recent activity —
            all in one place.
          </p>
          {status?.error && (
            <p className="mt-2 rounded-md border border-rose-300/15 bg-rose-300/[0.04] px-2 py-1 text-[10.5px] text-rose-200/90">
              Previous attempt: {status.error}
            </p>
          )}
          <a
            href="/api/github/connect"
            onClick={(e) => {
              // Same client-side localhost → 127.0.0.1 bounce as Spotify.
              // GitHub OAuth honours the registered callback exactly; if the
              // user is on localhost the cookies won't survive the round-trip.
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
          >
            <Button
              variant="primary"
              className="mt-3"
              icon={<Github className="h-3.5 w-3.5" />}
            >
              Connect GitHub
            </Button>
          </a>
        </div>
      </div>
    );
  }

  // ---- Connected ----
  return (
    <div className="space-y-4">
      {/* Profile + streak */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-violet-300/15 bg-violet-300/[0.03] p-3">
        <div className="flex min-w-0 items-center gap-3">
          {stats?.profile?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stats.profile.avatar}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-300/30 bg-violet-300/[0.10]">
              <Github className="h-4 w-4 text-violet-200" strokeWidth={1.7} />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="truncate text-[13px] tracking-tight text-white">
                {stats?.profile?.name ?? status?.account?.name ?? status?.account?.login}
              </div>
              {streak > 0 && (
                <span className="flex items-center gap-0.5 rounded-full border border-orange-300/25 bg-orange-300/[0.08] px-1.5 py-[1px] text-[9px] tabular-nums text-orange-200">
                  <Flame className="h-2.5 w-2.5" strokeWidth={2} />
                  {streak}d
                </span>
              )}
            </div>
            <div className="truncate text-[10.5px] text-muted">
              {stats?.profile && (
                <>
                  @{stats.profile.login} ·{" "}
                  {stats.profile.followers.toLocaleString()} followers ·{" "}
                  {stats.profile.publicRepos} repos
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {stats?.profile?.url && (
            <a
              href={stats.profile.url}
              target="_blank"
              rel="noreferrer"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted hover:border-white/[0.12] hover:text-white"
              title="Open profile on GitHub"
            >
              <ExternalLink className="h-3 w-3" strokeWidth={1.7} />
            </a>
          )}
          <button
            onClick={async () => {
              await fetch("/api/github/disconnect", { method: "POST" });
              window.location.reload();
            }}
            title="Disconnect GitHub (Google and Spotify sessions untouched)"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted hover:border-rose-300/30 hover:text-rose-300"
          >
            <LogOut className="h-3 w-3" strokeWidth={1.7} />
          </button>
        </div>
      </div>

      {/* Headline: "now working on" */}
      {activity?.headline && (
        <a
          href={activity.headline.url ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl border border-violet-300/15 bg-gradient-to-br from-violet-300/[0.06] to-transparent p-3 hover:border-violet-300/30"
        >
          <div className="mono-tag mb-1.5 flex items-center gap-1.5">
            <GitCommit className="h-2.5 w-2.5" strokeWidth={2} />
            now working on
            {activity.headline.at && (
              <span className="text-muted-soft">
                · {relativeTime(activity.headline.at)} ago
              </span>
            )}
          </div>
          <div className="text-[13px] text-white">{activity.headline.title}</div>
          {activity.headline.detail && (
            <div className="text-[11px] text-muted">{activity.headline.detail}</div>
          )}
        </a>
      )}

      {/* Counts row */}
      {stats?.counts && (
        <div className="grid grid-cols-3 gap-2">
          <CountTile
            icon={<GitPullRequest className="h-3 w-3" strokeWidth={1.8} />}
            label="open PRs"
            value={stats.counts.openPrs}
            tone="sky"
          />
          <CountTile
            icon={<Eye className="h-3 w-3" strokeWidth={1.8} />}
            label="review reqs"
            value={stats.counts.reviewRequests}
            tone="amber"
          />
          <CountTile
            icon={<CircleDot className="h-3 w-3" strokeWidth={1.8} />}
            label="open issues"
            value={stats.counts.openIssues}
            tone="emerald"
          />
        </div>
      )}

      {/* Term selector */}
      <div className="flex gap-1.5">
        {TERMS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTerm(t.key)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[10.5px] tracking-wider uppercase transition-colors",
              term === t.key
                ? "border-violet-300/30 bg-violet-300/[0.08] text-white"
                : "border-white/[0.05] bg-white/[0.015] text-muted hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contribution heatmap */}
      {stats?.heatmap && (
        <div>
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <div className="mono-tag">contributions</div>
              <div className="mt-0.5 text-[18px] font-medium tabular-nums tracking-tight text-white">
                {stats.heatmap.total.toLocaleString()}
                <span className="ml-1 text-[10.5px] tracking-wider uppercase text-muted-soft">
                  total
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <HeatStat icon={<GitCommit className="h-2.5 w-2.5" strokeWidth={2} />} value={stats.heatmap.commits} label="commits" />
              <HeatStat icon={<GitPullRequest className="h-2.5 w-2.5" strokeWidth={2} />} value={stats.heatmap.prs} label="PRs" />
              <HeatStat icon={<Eye className="h-2.5 w-2.5" strokeWidth={2} />} value={stats.heatmap.reviews} label="reviews" />
              <HeatStat icon={<CircleDot className="h-2.5 w-2.5" strokeWidth={2} />} value={stats.heatmap.issues} label="issues" />
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-white/[0.04] bg-white/[0.01] p-2">
            <div className="flex gap-[2px]">
              {stats.heatmap.weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[2px]">
                  {week.map((day) => (
                    <div
                      key={day.date}
                      title={`${day.date}: ${day.count} contribution${day.count === 1 ? "" : "s"}`}
                      className={cn("h-[9px] w-[9px] rounded-[2px]", heatColor(day.count))}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top repos */}
      <div>
        <div className="mono-tag mb-2">top repos</div>
        {isLoading ? (
          <div className="text-[11.5px] text-muted">Loading…</div>
        ) : !stats?.topRepos?.length ? (
          <div className="text-[11.5px] text-muted">No active repos in this window.</div>
        ) : (
          <ul className="space-y-1.5">
            {stats.topRepos.map((r, i) => (
              <li
                key={r.id}
                className="group flex items-center gap-2.5 rounded-lg border border-white/[0.04] bg-white/[0.01] px-2 py-1.5"
              >
                <span className="w-5 text-right text-[10px] tabular-nums text-muted-soft">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] text-white">{r.name}</span>
                    {r.private && (
                      <span className="rounded border border-white/[0.08] bg-white/[0.02] px-1 text-[8.5px] uppercase tracking-wider text-muted-soft">
                        private
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 truncate text-[10px] text-muted">
                    {r.language && <span>{r.language}</span>}
                    <span className="flex items-center gap-0.5">
                      <Star className="h-2.5 w-2.5" strokeWidth={2} />
                      {r.stars}
                    </span>
                    {r.forks > 0 && (
                      <span className="flex items-center gap-0.5">
                        <GitFork className="h-2.5 w-2.5" strokeWidth={2} />
                        {r.forks}
                      </span>
                    )}
                    <span className="text-muted-soft">
                      · pushed {relativeTime(r.pushedAt)} ago
                    </span>
                  </div>
                </div>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <ExternalLink className="h-3 w-3 text-muted hover:text-white" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Top languages */}
      {stats?.topLanguages?.length ? (
        <div>
          <div className="mono-tag mb-2">top languages</div>
          <div className="grid grid-cols-3 gap-2">
            {stats.topLanguages.map((l) => (
              <div
                key={l.name}
                className="flex flex-col gap-1 rounded-lg border border-white/[0.04] bg-white/[0.01] p-2"
              >
                <div className="truncate text-[11px] text-white">{l.name}</div>
                <div className="flex items-center justify-between text-[9.5px] tabular-nums text-muted-soft">
                  <span>{l.count} repos</span>
                  <span>{l.percent}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    className="h-full bg-violet-300/60"
                    style={{ width: `${Math.max(l.percent, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Open PRs */}
      <IssueList
        title="open pull requests"
        items={stats?.openPrs}
        emptyMessage="No open PRs."
        iconKind="pr"
      />

      {/* Review requests */}
      <IssueList
        title="review requested"
        items={stats?.reviewRequests}
        emptyMessage="Nothing awaiting your review."
        iconKind="pr"
      />

      {/* Open issues */}
      <IssueList
        title="open issues"
        items={stats?.recentIssues}
        emptyMessage="No open issues."
        iconKind="issue"
      />

      {/* Activity feed */}
      <div>
        <div className="mono-tag mb-2">recent activity</div>
        {!activity?.feed?.length ? (
          <div className="text-[11.5px] text-muted">No recent activity.</div>
        ) : (
          <ul className="space-y-1">
            {activity.feed.map((e) => (
              <li key={e.id} className="flex items-start gap-2.5 rounded-lg px-2 py-1">
                <ActivityIcon kind={e.kind} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11.5px] text-white">
                    {e.url ? (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {e.title}
                      </a>
                    ) : (
                      e.title
                    )}
                  </div>
                  {e.detail && (
                    <div className="truncate text-[10px] text-muted">{e.detail}</div>
                  )}
                </div>
                <div className="shrink-0 text-[9.5px] tabular-nums text-muted-soft">
                  {relativeTime(e.at)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---- Subcomponents ----

function CountTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "sky" | "amber" | "emerald";
}) {
  const toneClass =
    tone === "sky"
      ? "text-sky-300 border-sky-300/15 bg-sky-300/[0.04]"
      : tone === "amber"
      ? "text-amber-300 border-amber-300/15 bg-amber-300/[0.04]"
      : "text-emerald-300 border-emerald-300/15 bg-emerald-300/[0.04]";
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-lg border p-2", toneClass)}>
      <div className="flex items-center gap-1 text-[9.5px] uppercase tracking-wider opacity-90">
        {icon}
        {label}
      </div>
      <div className="text-[18px] font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

function IssueList({
  title,
  items,
  emptyMessage,
  iconKind,
}: {
  title: string;
  items?: IssueLike[];
  emptyMessage: string;
  iconKind: "pr" | "issue";
}) {
  return (
    <div>
      <div className="mono-tag mb-2">{title}</div>
      {!items?.length ? (
        <div className="text-[11.5px] text-muted">{emptyMessage}</div>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li
              key={it.id}
              className="group flex items-center gap-2.5 rounded-lg border border-white/[0.04] bg-white/[0.01] px-2 py-1.5"
            >
              {iconKind === "pr" ? (
                <GitPullRequest
                  className={cn(
                    "h-3 w-3 shrink-0",
                    it.draft ? "text-muted" : "text-sky-300"
                  )}
                  strokeWidth={1.8}
                />
              ) : (
                <CircleDot className="h-3 w-3 shrink-0 text-emerald-300" strokeWidth={1.8} />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11.5px] text-white">
                  {it.title}
                  {it.draft && (
                    <span className="ml-1.5 rounded border border-white/[0.08] bg-white/[0.02] px-1 text-[8.5px] uppercase tracking-wider text-muted-soft">
                      draft
                    </span>
                  )}
                </div>
                <div className="truncate text-[10px] text-muted">
                  {it.repo} · #{it.number} · {relativeTime(it.updatedAt)} ago
                </div>
              </div>
              <a
                href={it.url}
                target="_blank"
                rel="noreferrer"
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <ExternalLink className="h-3 w-3 text-muted hover:text-white" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HeatStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-white/[0.05] bg-white/[0.02] px-1.5 py-0.5 text-[10px] text-muted"
      title={`${value} ${label}`}
    >
      <span className="text-muted-soft">{icon}</span>
      <span className="tabular-nums text-white/85">{value}</span>
      <span className="tracking-wider text-muted-soft">{label}</span>
    </span>
  );
}

function ActivityIcon({ kind }: { kind: string }) {
  const cls = "h-3 w-3 shrink-0 mt-[2px]";
  if (kind.startsWith("push") || kind === "create")
    return <GitCommit className={cn(cls, "text-violet-300")} strokeWidth={1.8} />;
  if (kind.startsWith("pr_"))
    return (
      <GitPullRequest
        className={cn(cls, kind === "pr_merged" ? "text-violet-300" : "text-sky-300")}
        strokeWidth={1.8}
      />
    );
  if (kind.startsWith("issue"))
    return <CircleDot className={cn(cls, "text-emerald-300")} strokeWidth={1.8} />;
  if (kind === "release")
    return <Star className={cn(cls, "text-amber-300")} strokeWidth={1.8} />;
  if (kind === "fork")
    return <GitFork className={cn(cls, "text-muted")} strokeWidth={1.8} />;
  if (kind === "star")
    return <Star className={cn(cls, "text-amber-200")} strokeWidth={1.8} />;
  return <Github className={cn(cls, "text-muted")} strokeWidth={1.8} />;
}
