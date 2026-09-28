import { NextResponse } from "next/server";
import { ghFetch, NotConnected } from "@/lib/integrations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Repo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  pushed_at: string;
  default_branch: string;
};

export async function GET() {
  try {
    const repos = await ghFetch<Repo[]>(
      "/user/repos?sort=pushed&per_page=20&affiliation=owner,collaborator"
    );
    return NextResponse.json({
      repos: repos.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        description: r.description,
        url: r.html_url,
        language: r.language,
        stars: r.stargazers_count,
        pushedAt: r.pushed_at,
        defaultBranch: r.default_branch,
      })),
    });
  } catch (e) {
    if (e instanceof NotConnected) {
      return NextResponse.json(
        { error: "github_not_connected" },
        { status: 424 }
      );
    }
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
