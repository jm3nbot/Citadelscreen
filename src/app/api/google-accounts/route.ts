import { NextResponse } from "next/server";
import { listAccounts } from "@/lib/account-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/google-accounts — list every connected Google account.
// Tokens are NEVER serialized; only public metadata leaves the server.
export async function GET() {
  try {
    const accounts = await listAccounts();
    return NextResponse.json({ accounts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "list_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
