import { NextResponse } from "next/server";
import { checkGithubConnection } from "@/lib/github";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Mirrors /api/spotify/status. Reads the per-user cookie via checkGithubConnection.
export async function GET() {
  return NextResponse.json(await checkGithubConnection());
}
