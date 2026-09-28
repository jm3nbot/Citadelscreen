import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isConfigured } from "@/lib/google";
import { checkSpotifyConnection } from "@/lib/spotify";
import { checkGithubConnection } from "@/lib/github";
import { notion } from "@/lib/providers/notion";
import { slack } from "@/lib/providers/slack";
import { linear } from "@/lib/providers/linear";
import { figma } from "@/lib/providers/figma";
import { discord } from "@/lib/providers/discord";
import { claude } from "@/lib/providers/claude";
import { openai } from "@/lib/providers/openai";
import { gemini } from "@/lib/providers/gemini";
import { n8n } from "@/lib/providers/n8n";
import { vapi } from "@/lib/providers/vapi";
import { vercel } from "@/lib/providers/vercel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Single source of truth for whether each external service is actually
// reachable with the credentials we have. Used by the Apps page to label
// connection state honestly — no "connected" badges for stuff that isn't.
export async function GET() {
  const session = await getServerSession(authOptions);
  const googleSignedIn = Boolean(
    (session as { accessToken?: string } | null)?.accessToken
  );
  const googleEmail =
    (session as { user?: { email?: string } } | null)?.user?.email;

  // All non-Google providers run their per-user cookie check in parallel.
  // OAuth providers go via their own helpers; BYOK providers go via the
  // shared apikey-utils factory's checkConnection(). The shape is the same.
  const [
    github,
    spotify,
    notionStatus,
    slackStatus,
    linearStatus,
    figmaStatus,
    discordStatus,
    claudeStatus,
    openaiStatus,
    geminiStatus,
    n8nStatus,
    vapiStatus,
    vercelStatus,
  ] = await Promise.all([
    checkGithubConnection(),
    checkSpotifyConnection(),
    notion.checkConnection(),
    slack.checkConnection(),
    linear.checkConnection(),
    figma.checkConnection(),
    discord.checkConnection(),
    claude.checkConnection(),
    openai.checkConnection(),
    gemini.checkConnection(),
    n8n.checkConnection(),
    vapi.checkConnection(),
    vercel.checkConnection(),
  ]);

  return NextResponse.json({
    google: {
      // True "connected" requires both: app credentials configured AND a live
      // OAuth session. Either alone leaves us unable to call Google APIs.
      configured: isConfigured(),
      connected: googleSignedIn,
      account: googleEmail ? { email: googleEmail } : undefined,
    },
    github,
    spotify,
    // OAuth providers (cookie-based per-user)
    notion: notionStatus,
    slack: slackStatus,
    linear: linearStatus,
    figma: figmaStatus,
    discord: discordStatus,
    // BYOK providers (encrypted-cookie per-user API key)
    claude: claudeStatus,
    openai: openaiStatus,
    gemini: geminiStatus,
    n8n: n8nStatus,
    vapi: vapiStatus,
    vercel: vercelStatus,
  });
}
