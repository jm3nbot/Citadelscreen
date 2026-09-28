import { NextResponse } from "next/server";
import { listAccounts } from "@/lib/account-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// YouTube connection check. We piggyback on the multi-Google-accounts flow —
// any account whose stored scopes include youtube.readonly counts as
// "connected." That way users don't have to OAuth a separate provider.
export async function GET() {
  const accounts = await listAccounts();
  const youtubeAccounts = accounts.filter((a) =>
    a.scopes.some((s) => s.includes("youtube"))
  );
  return NextResponse.json({
    connected: youtubeAccounts.length > 0,
    accounts: youtubeAccounts.map((a) => ({
      id: a.id,
      email: a.email,
      displayName: a.displayName,
      picture: a.picture,
    })),
  });
}
