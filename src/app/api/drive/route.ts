import { NextResponse } from "next/server";
import { google } from "googleapis";
import { authedClient, getAccessTokenOrThrow, NotAuthenticated } from "@/lib/google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  iconLink?: string;
  size?: string;
  ownedByMe?: boolean;
};

export async function GET(req: Request) {
  try {
    const token = await getAccessTokenOrThrow();
    const auth = authedClient(token);
    const drive = google.drive({ version: "v3", auth });

    const url = new URL(req.url);
    const filter = url.searchParams.get("type"); // "docs" | "sheets" | "slides" | "pdf" | undefined
    const term = url.searchParams.get("q")?.trim();
    const pageSize = Math.min(50, Number(url.searchParams.get("limit") ?? 20));

    let q = "trashed=false";
    if (filter === "docs") {
      q += " and mimeType='application/vnd.google-apps.document'";
    } else if (filter === "sheets") {
      q += " and mimeType='application/vnd.google-apps.spreadsheet'";
    } else if (filter === "slides") {
      q += " and mimeType='application/vnd.google-apps.presentation'";
    } else if (filter === "pdf") {
      q += " and mimeType='application/pdf'";
    }
    if (term) {
      // Escape single quotes for the Drive query DSL.
      const safe = term.replace(/'/g, "\\'");
      q += ` and (name contains '${safe}' or fullText contains '${safe}')`;
    }

    const res = await drive.files.list({
      pageSize,
      q,
      orderBy: term ? undefined : "modifiedTime desc",
      fields:
        "files(id, name, mimeType, modifiedTime, webViewLink, iconLink, size, ownedByMe)",
    });

    const files: DriveFile[] = (res.data.files ?? []).map((f) => ({
      id: f.id!,
      name: f.name ?? "(untitled)",
      mimeType: f.mimeType ?? "",
      modifiedTime: f.modifiedTime ?? new Date().toISOString(),
      webViewLink: f.webViewLink ?? undefined,
      iconLink: f.iconLink ?? undefined,
      size: f.size ?? undefined,
      ownedByMe: f.ownedByMe ?? undefined,
    }));

    return NextResponse.json({ files });
  } catch (e) {
    if (e instanceof NotAuthenticated) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }
    const msg = e instanceof Error ? e.message : "unknown_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
