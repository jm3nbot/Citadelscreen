import { NextResponse } from "next/server";
import { vercelFetch, NotConnected } from "@/lib/integrations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Deployment = {
  uid: string;
  name?: string;
  url?: string;
  state?: string;
  readyState?: string;
  createdAt?: number;
  target?: string;
  meta?: { githubCommitMessage?: string; githubCommitRef?: string };
};

export async function GET() {
  try {
    const j = await vercelFetch<{ deployments?: Deployment[] }>(
      "/v6/deployments?limit=15"
    );
    return NextResponse.json({
      deployments: (j.deployments ?? []).map((d) => ({
        id: d.uid,
        name: d.name,
        url: d.url ? `https://${d.url}` : undefined,
        state: d.readyState ?? d.state,
        createdAt: d.createdAt,
        target: d.target,
        commitMessage: d.meta?.githubCommitMessage,
        commitRef: d.meta?.githubCommitRef,
      })),
    });
  } catch (e) {
    if (e instanceof NotConnected) {
      return NextResponse.json(
        { error: "vercel_not_connected" },
        { status: 424 }
      );
    }
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
