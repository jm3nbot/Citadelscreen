import { NextResponse } from "next/server";
import { deleteAccount } from "@/lib/account-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// DELETE /api/google-accounts/:id — disconnect a single connected account.
// Just drops the local record; we don't bother calling Google's
// /revoke endpoint because the user can do that themselves on
// https://myaccount.google.com/permissions if they want to fully nuke it,
// and refresh tokens we have stored will stop working anyway once we
// delete them locally.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const removed = await deleteAccount(params.id);
    if (!removed) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "delete_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
