import { NextResponse } from "next/server";
import { githubFetch, GithubNotConnected } from "@/lib/github";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The "now working on" equivalent of Spotify's now-playing. We hit the user's
// own events feed (which includes private events authed as the token owner)
// and surface the most recent push as the headline, plus the next few mixed
// events as a feed.

type GhEvent = {
  id: string;
  type: string;
  actor: { login: string; avatar_url?: string };
  repo: { id: number; name: string; url: string };
  payload: Record<string, unknown>;
  created_at: string;
};

type PushPayload = {
  ref?: string;
  size?: number;
  commits?: Array<{ sha: string; message: string; url: string }>;
};

type PrPayload = {
  action?: string;
  pull_request?: { number: number; title: string; html_url: string; merged?: boolean };
};

type IssuePayload = {
  action?: string;
  issue?: { number: number; title: string; html_url: string };
};

type ReleasePayload = {
  action?: string;
  release?: { tag_name: string; name?: string; html_url: string };
};

function shortMessage(msg: string): string {
  const firstLine = msg.split("\n")[0];
  return firstLine.length > 80 ? firstLine.slice(0, 77) + "…" : firstLine;
}

function summarise(e: GhEvent): {
  kind: string;
  title: string;
  detail?: string;
  url?: string;
} {
  switch (e.type) {
    case "PushEvent": {
      const p = e.payload as PushPayload;
      const branch = p.ref?.replace("refs/heads/", "") ?? "";
      const top = p.commits?.[p.commits.length - 1];
      return {
        kind: "push",
        title: top ? shortMessage(top.message) : `pushed ${p.size ?? 0} commits`,
        detail: branch ? `${e.repo.name} · ${branch}` : e.repo.name,
        url: top
          ? `https://github.com/${e.repo.name}/commit/${top.sha}`
          : `https://github.com/${e.repo.name}`,
      };
    }
    case "PullRequestEvent": {
      const p = e.payload as PrPayload;
      const merged = p.pull_request?.merged;
      return {
        kind: merged ? "pr_merged" : `pr_${p.action ?? "updated"}`,
        title: p.pull_request?.title ?? "Pull request",
        detail: `${e.repo.name} · #${p.pull_request?.number}`,
        url: p.pull_request?.html_url,
      };
    }
    case "PullRequestReviewEvent": {
      const p = e.payload as PrPayload;
      return {
        kind: "pr_review",
        title: `Reviewed: ${p.pull_request?.title ?? ""}`,
        detail: `${e.repo.name} · #${p.pull_request?.number}`,
        url: p.pull_request?.html_url,
      };
    }
    case "IssuesEvent": {
      const p = e.payload as IssuePayload;
      return {
        kind: `issue_${p.action ?? "updated"}`,
        title: p.issue?.title ?? "Issue",
        detail: `${e.repo.name} · #${p.issue?.number}`,
        url: p.issue?.html_url,
      };
    }
    case "IssueCommentEvent": {
      const p = e.payload as IssuePayload;
      return {
        kind: "issue_comment",
        title: `Commented on: ${p.issue?.title ?? ""}`,
        detail: `${e.repo.name} · #${p.issue?.number}`,
        url: p.issue?.html_url,
      };
    }
    case "ReleaseEvent": {
      const p = e.payload as ReleasePayload;
      return {
        kind: "release",
        title: p.release?.name ?? p.release?.tag_name ?? "Release",
        detail: `${e.repo.name} · ${p.release?.tag_name ?? ""}`,
        url: p.release?.html_url,
      };
    }
    case "CreateEvent":
      return {
        kind: "create",
        title: "Created branch/tag",
        detail: e.repo.name,
        url: `https://github.com/${e.repo.name}`,
      };
    case "WatchEvent":
      return {
        kind: "star",
        title: "Starred a repo",
        detail: e.repo.name,
        url: `https://github.com/${e.repo.name}`,
      };
    case "ForkEvent":
      return {
        kind: "fork",
        title: "Forked a repo",
        detail: e.repo.name,
        url: `https://github.com/${e.repo.name}`,
      };
    default:
      return {
        kind: e.type.replace(/Event$/, "").toLowerCase(),
        title: e.type,
        detail: e.repo.name,
        url: `https://github.com/${e.repo.name}`,
      };
  }
}

export async function GET() {
  try {
    // Resolve the authed login so we can hit the events feed for "us".
    // We cache the user lookup separately at 5 min; events at 30s for freshness.
    const me = await githubFetch<{ login: string }>("/user", 300);
    const events = await githubFetch<GhEvent[]>(
      `/users/${me.login}/events?per_page=20`,
      30
    );

    const latestPush = events.find((e) => e.type === "PushEvent");
    const headline = latestPush ? summarise(latestPush) : null;

    return NextResponse.json({
      login: me.login,
      // Headline = the "now-playing" equivalent. Null when there's no recent push.
      headline: headline && {
        ...headline,
        at: latestPush?.created_at,
      },
      feed: events.slice(0, 10).map((e) => ({
        id: e.id,
        at: e.created_at,
        repo: e.repo.name,
        ...summarise(e),
      })),
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
