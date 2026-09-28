import { NextResponse } from "next/server";
import { githubFetch, githubGraphql, GithubNotConnected } from "@/lib/github";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---- GitHub REST shapes (only the fields we read) ----
type GhUser = {
  login: string;
  name?: string | null;
  avatar_url?: string;
  html_url?: string;
  bio?: string | null;
  followers?: number;
  following?: number;
  public_repos?: number;
  company?: string | null;
  location?: string | null;
};

type GhRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
  updated_at: string;
  default_branch: string;
  archived?: boolean;
  fork?: boolean;
  owner?: { login: string };
};

type GhSearchIssue = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  created_at: string;
  updated_at: string;
  repository_url: string;
  pull_request?: unknown;
  draft?: boolean;
  user?: { login: string; avatar_url?: string };
};

type GhSearchResp = {
  total_count: number;
  items: GhSearchIssue[];
};

// ---- GraphQL response shape for contributions ----
type GqlContributions = {
  viewer: {
    login: string;
    contributionsCollection: {
      totalCommitContributions: number;
      totalPullRequestContributions: number;
      totalIssueContributions: number;
      totalPullRequestReviewContributions: number;
      contributionCalendar: {
        totalContributions: number;
        weeks: Array<{
          contributionDays: Array<{
            date: string;
            contributionCount: number;
            color: string;
          }>;
        }>;
      };
    };
  };
};

// ---- Window math: maps the term selector to a date range and a label. ----
type Term = "short_term" | "medium_term" | "long_term";

function windowFor(term: Term): { since: Date; sinceISO: string } {
  const now = new Date();
  const since = new Date(now);
  if (term === "short_term") since.setDate(since.getDate() - 28); // 4 weeks
  else if (term === "medium_term") since.setMonth(since.getMonth() - 6); // 6 months
  else since.setFullYear(since.getFullYear() - 5); // "all time" capped at 5y for relevance
  return { since, sinceISO: since.toISOString() };
}

function extractOwnerRepo(repositoryUrl: string): { owner: string; repo: string } | null {
  // repository_url is the API URL: https://api.github.com/repos/owner/repo
  const m = repositoryUrl.match(/repos\/([^/]+)\/([^/]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const term = ((url.searchParams.get("term") as Term) ?? "short_term") as Term;
  const { since, sinceISO } = windowFor(term);

  try {
    // ---- Profile + repo list run in parallel ----
    // We fetch up to 100 repos sorted by pushed_at; that's plenty for both
    // "top repos in window" and "top languages" without paginating.
    const [user, repos] = await Promise.all([
      githubFetch<GhUser>("/user", 300),
      githubFetch<GhRepo[]>(
        "/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator",
        60
      ),
    ]);

    // ---- Top repos: filter to the window, drop archived/forks for signal ----
    const inWindow = repos.filter(
      (r) => !r.archived && !r.fork && new Date(r.pushed_at) >= since
    );
    const topRepos = inWindow.slice(0, 8).map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      private: r.private,
      description: r.description,
      url: r.html_url,
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      openIssues: r.open_issues_count,
      pushedAt: r.pushed_at,
      defaultBranch: r.default_branch,
    }));

    // ---- Top languages: weight by repo count in window. Cheap and accurate
    // enough; using byte counts would require N extra requests for /languages.
    const langCounts = new Map<string, number>();
    for (const r of inWindow) {
      if (!r.language) continue;
      langCounts.set(r.language, (langCounts.get(r.language) ?? 0) + 1);
    }
    const langTotal = Array.from(langCounts.values()).reduce((a, b) => a + b, 0) || 1;
    const topLanguages = Array.from(langCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 9)
      .map(([name, count]) => ({
        name,
        count,
        percent: Math.round((count / langTotal) * 100),
      }));

    // ---- Totals across the (window) repo set for the profile chip ----
    const totalStars = inWindow.reduce((sum, r) => sum + r.stargazers_count, 0);

    // ---- Search-based queries: open PRs authored, review requests, recent issues ----
    // Search API allows up to 30 req/min — well within our use.
    const login = user.login;
    const [openPrs, reviewRequests, recentIssues] = await Promise.all([
      githubFetch<GhSearchResp>(
        `/search/issues?q=${encodeURIComponent(
          `is:open is:pr author:${login} archived:false`
        )}&per_page=10&sort=updated`,
        60
      ).catch(() => ({ total_count: 0, items: [] as GhSearchIssue[] })),
      githubFetch<GhSearchResp>(
        `/search/issues?q=${encodeURIComponent(
          `is:open is:pr review-requested:${login} archived:false`
        )}&per_page=10&sort=updated`,
        60
      ).catch(() => ({ total_count: 0, items: [] as GhSearchIssue[] })),
      githubFetch<GhSearchResp>(
        `/search/issues?q=${encodeURIComponent(
          `is:open is:issue author:${login} archived:false`
        )}&per_page=10&sort=updated`,
        60
      ).catch(() => ({ total_count: 0, items: [] as GhSearchIssue[] })),
    ]);

    const mapIssue = (i: GhSearchIssue) => {
      const or = extractOwnerRepo(i.repository_url);
      return {
        id: i.id,
        number: i.number,
        title: i.title,
        url: i.html_url,
        state: i.state,
        repo: or ? `${or.owner}/${or.repo}` : "",
        updatedAt: i.updated_at,
        draft: !!i.draft,
        author: i.user?.login,
      };
    };

    // ---- Contribution heatmap via GraphQL ----
    // We tolerate this failing (e.g. fine-grained PAT without GraphQL scope)
    // so the rest of the dashboard still renders.
    let heatmap: GqlContributions["viewer"]["contributionsCollection"] | null = null;
    try {
      const data = await githubGraphql<GqlContributions>(
        `query($from: DateTime!) {
          viewer {
            login
            contributionsCollection(from: $from) {
              totalCommitContributions
              totalPullRequestContributions
              totalIssueContributions
              totalPullRequestReviewContributions
              contributionCalendar {
                totalContributions
                weeks {
                  contributionDays {
                    date
                    contributionCount
                    color
                  }
                }
              }
            }
          }
        }`,
        { from: sinceISO }
      );
      heatmap = data.viewer.contributionsCollection;
    } catch {
      heatmap = null;
    }

    return NextResponse.json({
      term,
      profile: {
        login: user.login,
        name: user.name ?? user.login,
        bio: user.bio ?? "",
        avatar: user.avatar_url,
        url: user.html_url,
        followers: user.followers ?? 0,
        following: user.following ?? 0,
        publicRepos: user.public_repos ?? 0,
        company: user.company ?? "",
        location: user.location ?? "",
        totalStars,
      },
      counts: {
        openPrs: openPrs.total_count,
        reviewRequests: reviewRequests.total_count,
        openIssues: recentIssues.total_count,
      },
      topRepos,
      topLanguages,
      openPrs: openPrs.items.slice(0, 5).map(mapIssue),
      reviewRequests: reviewRequests.items.slice(0, 5).map(mapIssue),
      recentIssues: recentIssues.items.slice(0, 5).map(mapIssue),
      heatmap: heatmap && {
        total: heatmap.contributionCalendar.totalContributions,
        commits: heatmap.totalCommitContributions,
        prs: heatmap.totalPullRequestContributions,
        issues: heatmap.totalIssueContributions,
        reviews: heatmap.totalPullRequestReviewContributions,
        weeks: heatmap.contributionCalendar.weeks.map((w) =>
          w.contributionDays.map((d) => ({
            date: d.date,
            count: d.contributionCount,
            color: d.color,
          }))
        ),
      },
    });
  } catch (e) {
    if (e instanceof GithubNotConnected) {
      return NextResponse.json(
        { error: "github_not_connected" },
        { status: 401 }
      );
    }
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
