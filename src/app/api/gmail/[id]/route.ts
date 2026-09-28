import { NextResponse } from "next/server";
import { google } from "googleapis";
import { authedClient, getAccessTokenOrThrow, NotAuthenticated } from "@/lib/google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Mutations on a Gmail message. POST /api/gmail/{id} with `{ action }`:
//   - "trash"   → move to Bin
//   - "untrash" → restore from Bin
//   - "star"    → add STARRED label
//   - "unstar"  → remove STARRED label
//
// Requires gmail.modify scope (broader than gmail.readonly). If the user
// signed in before that scope was added they'll get a 403 — surfacing
// `needsReauth: true` so the inbox UI can prompt re-consent.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getAccessTokenOrThrow();
    const auth = authedClient(token);
    const gmail = google.gmail({ version: "v1", auth });
    const { id } = params;

    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const action = body.action;

    if (action === "trash") {
      await gmail.users.messages.trash({ userId: "me", id });
    } else if (action === "untrash") {
      await gmail.users.messages.untrash({ userId: "me", id });
    } else if (action === "star") {
      await gmail.users.messages.modify({
        userId: "me",
        id,
        requestBody: { addLabelIds: ["STARRED"] },
      });
    } else if (action === "unstar") {
      await gmail.users.messages.modify({
        userId: "me",
        id,
        requestBody: { removeLabelIds: ["STARRED"] },
      });
    } else {
      return NextResponse.json({ error: "unknown_action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof NotAuthenticated) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }
    const err = e as {
      message?: string;
      code?: number;
      errors?: Array<{ message?: string; reason?: string }>;
    };
    const code = err.code;
    const reason = err.errors?.[0]?.reason;
    const msg = err.errors?.[0]?.message ?? err.message ?? "unknown_error";
    const needsReauth =
      reason === "insufficientPermissions" ||
      reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT" ||
      code === 401;
    const apiDisabled =
      reason === "accessNotConfigured" || reason === "SERVICE_DISABLED";
    console.error("[/api/gmail/:id] failure:", { code, reason, msg, raw: e });
    return NextResponse.json(
      { error: msg, code, reason, needsReauth, apiDisabled },
      { status: code ?? 500 }
    );
  }
}
