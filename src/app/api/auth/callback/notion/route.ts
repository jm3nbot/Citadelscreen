import { notion } from "@/lib/providers/notion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// File-system route at /api/auth/callback/notion beats NextAuth's catch-all,
// same pattern as the GitHub and Spotify callbacks.
export const GET = notion.callbackHandler;
