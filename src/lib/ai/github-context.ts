import { githubFetch, GithubNotConnected } from "@/lib/github";

// Compact GitHub context for prompt injection. Mirrors lib/ai/spotify-context.ts.
// We pull a profile + a small slice of repos + open PRs + recent activity so the
// model can answer "what am I working on" / "what's on my plate in code" /
// "summarise my recent commits" without exhausting the context window.
//
// Returns null when GitHub isn't connected — caller surfaces that to the user
// as "connect GitHub first" if their question depended on it.

type GhUser = {
  login: string;
  name?: string | null;
  followers?: number;
  public_repos?: number;
};

type GhRepo = {
  name: string;
  full_name: string;
  private: boolean;
  language: string | null;
  stargazers_count: number;
  pushed_at: string;
  fork?: boolean;
  archived?: boolean;
  description?: string | null;
};

type GhSearchItem = {
  number: number;
  title: string;
  state: string;
  draft?: boolean;
  repository_url: string;
  updated_at: string;
};

type GhEvent = {
  type: string;
  repo: { name: string };
  payload: Record<string, unknown>;
  created_at: string;
};

function repoFromUrl(url: string): string {
  const m = url.match(/repos\/([^/]+\/[^/]+)$/);
  return m ? m[1] : "";
}

function eventSummary(e: GhEvent): string {
  switch (e.type) {
    case "PushEvent": {
      const p = e.payload as {
        ref?: string;
        commits?: Array<{ message?: string }>;
      };
      const branch = p.ref?.replace("refs/heads/", "") ?? "";
      const last = p.commits?.[p.commits.length - 1]?.message?.split("\n")[0] ?? "";
      return `push ${e.repo.name}${branch ? `@${branch}` : ""}: "${last.slice(0, 80)}"`;
    }
    case "PullRequestEvent": {
      const p = e.payload as {
        action?: string;
        pull_request?: { title?: string; number?: number; merged?: boolean };
      };
      const tag = p.pull_request?.merged ? "merged" : p.action ?? "updated";
      return `pr-${tag} ${e.repo.name}#${p.pull_request?.number}: "${p.pull_request?.title}"`;
    }
    case "IssuesEvent": {
      const p = e.payload as {
        action?: string;
        issue?: { title?: string; number?: number };
      };
      return `issue-${p.action} ${e.repo.name}#${p.issue?.number}: "${p.issue?.title}"`;
    }
    case "IssueCommentEvent": {
      const p = e.payload as { issue?: { number?: number } };
      return `comment ${e.repo.name}#${p.issue?.number}`;
    }
    case "ReleaseEvent": {
      const p = e.payload as { release?: { tag_name?: string } };
      return `release ${e.repo.name} ${p.release?.tag_name}`;
    }
    default:
      return `${e.type.replace(/Event$/, "").toLowerCase()} ${e.repo.name}`;
  }
}

export async function fetchGithubContext(): Promise<string | null> {
  try {
    // Resolve identity first so we can use login in search queries.
    const me = await githubFetch<GhUser>("/user", 300);
    const [repos, openPrs, reviewReqs, events] = await Promise.all([
      githubFetch<GhRepo[]>(
        "/user/repos?sort=pushed&per_page=10&affiliation=owner,collaborator",
        60
      ),
      githubFetch<{ items?: GhSearchItem[]; total_count?: number }>(
        `/search/issues?q=${encodeURIComponent(
          `is:open is:pr author:${me.login} archived:false`
        )}&per_page=5&sort=updated`,
        60
      ).catch(() => ({ items: [] as GhSearchItem[], total_count: 0 })),
      githubFetch<{ items?: GhSearchItem[]; total_count?: number }>(
        `/search/issues?q=${encodeURIComponent(
          `is:open is:pr review-requested:${me.login} archived:false`
        )}&per_page=5&sort=updated`,
        60
      ).catch(() => ({ items: [] as GhSearchItem[], total_count: 0 })),
      githubFetch<GhEvent[]>(`/users/${me.login}/events?per_page=10`, 60).catch(
        () => [] as GhEvent[]
      ),
    ]);

    const activeRepos = repos
      .filter((r) => !r.archived && !r.fork)
      .slice(0, 6);

    const lines: string[] = [];
    lines.push(
      `profile: @${me.login}${me.name ? ` (${me.name})` : ""}${
        me.public_repos != null ? ` · ${me.public_repos} public repos` : ""
      }${me.followers != null ? ` · ${me.followers} followers` : ""}`
    );
    if (activeRepos.length) {
      lines.push(
        `top_repos: ${activeRepos
          .map(
            (r) =>
              `${r.name}${r.language ? `[${r.language}]` : ""}${
                r.stargazers_count ? ` ★${r.stargazers_count}` : ""
              }`
          )
          .join(" | ")}`
      );
    }
    if (openPrs.items?.length) {
      lines.push(
        `open_prs (${openPrs.total_count ?? openPrs.items.length}): ${openPrs.items
          .map(
            (p) =>
              `${repoFromUrl(p.repository_url)}#${p.number}${p.draft ? " (draft)" : ""} "${p.title.slice(
                0,
                70
              )}"`
          )
          .join(" | ")}`
      );
    } else {
      lines.push(`open_prs: 0`);
    }
    if (reviewReqs.items?.length) {
      lines.push(
        `review_requested (${reviewReqs.total_count ?? reviewReqs.items.length}): ${reviewReqs.items
          .map(
            (p) =>
              `${repoFromUrl(p.repository_url)}#${p.number} "${p.title.slice(0, 70)}"`
          )
          .join(" | ")}`
      );
    }
    if (events.length) {
      lines.push(
        `recent_activity: ${events.slice(0, 8).map(eventSummary).join(" | ")}`
      );
    }
    return `<GITHUB_CONTEXT>\n${lines.join("\n")}\n</GITHUB_CONTEXT>`;
  } catch (e) {
    if (e instanceof GithubNotConnected) return null;
    return null;
  }
}
