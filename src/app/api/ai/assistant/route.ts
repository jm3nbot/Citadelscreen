import { NextResponse } from "next/server";
import {
  generateWithGemini,
  GeminiConfigError,
  type GeminiUsage,
} from "@/lib/ai/gemini";
import { detectIntents } from "@/lib/ai/intent";
import {
  fetchRecentEmailContext,
  formatEmailContextForPrompt,
} from "@/lib/ai/email-context";
import { fetchSpotifyContext } from "@/lib/ai/spotify-context";
import { fetchYouTubeContext } from "@/lib/ai/youtube-context";
import { fetchGithubContext } from "@/lib/ai/github-context";
import { buildActionInstructions } from "@/lib/ai/actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Main assistant endpoint. Pipeline:
//   1. Detect intents (email / spotify / youtube / reminder / sticker / settings).
//   2. Fetch server-side contexts for the things we own server-side
//      (Gmail via OAuth tokens, Spotify via cookie, YouTube via Google).
//   3. Trust the client-supplied `clientContext` for things that live in
//      the Zustand store (reminders + stickers + current prefs snapshot).
//      That data already came from the same browser so re-fetching it would
//      be a waste.
//   4. Build the system prompt + dispatch to provider.

type ClientContext = {
  reminders?: Array<{
    title: string;
    description?: string;
    priority: string;
    dueAt?: string;
    complete: boolean;
  }>;
  stickers?: Array<{
    kind: "text" | "image" | "sticky" | "todo";
    text?: string;
    title?: string;
    color?: string;
    itemCount?: number;
    openCount?: number;
  }>;
  resolvedTodos?: number;
  currentPrefs?: {
    accent?: string;
    customAccent?: string;
    gridIntensity?: string;
    minimalNodes?: boolean;
    animateEdges?: boolean;
    showMinimap?: boolean;
    viewMode?: string;
    sidebarCollapsed?: boolean;
  };
  operatorName?: string;
};

type Body = {
  message?: string;
  provider?: "gemini" | "openai" | "claude";
  assistantName?: string;
  clientContext?: ClientContext;
};

function formatRemindersContext(c: ClientContext): string {
  const rs = c.reminders ?? [];
  if (rs.length === 0) return "";
  const open = rs.filter((r) => !r.complete);
  const done = rs.filter((r) => r.complete);
  return [
    "<REMINDERS_CONTEXT>",
    `total=${rs.length} open=${open.length} done=${done.length} resolved_todos_archived=${c.resolvedTodos ?? 0}`,
    ...open
      .slice(0, 15)
      .map(
        (r, i) =>
          `[O${i + 1}] priority=${r.priority}${r.dueAt ? ` due=${r.dueAt}` : ""} | ${r.title}${r.description ? ` — ${r.description}` : ""}`
      ),
    ...(done.length > 0
      ? [
          "--- DONE ---",
          ...done
            .slice(0, 5)
            .map((r, i) => `[D${i + 1}] ${r.title}`),
        ]
      : []),
    "</REMINDERS_CONTEXT>",
  ].join("\n");
}

function formatStickersContext(c: ClientContext): string {
  const sks = c.stickers ?? [];
  if (sks.length === 0) return "";
  return [
    "<STICKERS_CONTEXT>",
    `total=${sks.length}`,
    ...sks.slice(0, 20).map((s, i) => {
      if (s.kind === "todo") {
        return `[S${i + 1}] todo-panel "${s.title ?? "untitled"}" items=${s.itemCount ?? 0} open=${s.openCount ?? 0}`;
      }
      if (s.kind === "sticky") {
        return `[S${i + 1}] sticky-note color=${s.color ?? "yellow"} text="${(s.text ?? "").slice(0, 200)}"`;
      }
      if (s.kind === "text") {
        return `[S${i + 1}] text-note text="${(s.text ?? "").slice(0, 200)}"`;
      }
      return `[S${i + 1}] image-sticker`;
    }),
    "</STICKERS_CONTEXT>",
  ].join("\n");
}

function formatSettingsContext(c: ClientContext): string {
  const p = c.currentPrefs ?? {};
  return [
    "<CURRENT_SETTINGS>",
    `accent=${p.accent ?? "?"}${p.customAccent ? ` (custom=${p.customAccent})` : ""}`,
    `grid=${p.gridIntensity ?? "?"}`,
    `minimal_nodes=${p.minimalNodes ?? false}`,
    `animate_edges=${p.animateEdges ?? false}`,
    `show_minimap=${p.showMinimap ?? false}`,
    `view_mode=${p.viewMode ?? "?"}`,
    `sidebar_collapsed=${p.sidebarCollapsed ?? false}`,
    "</CURRENT_SETTINGS>",
  ].join("\n");
}

function buildSystemPrompt(
  assistantName: string,
  operatorName: string | undefined,
  contextBlocks: string[],
  enableActions: boolean,
  accountCount: number
): string {
  const sections: string[] = [
    `You are ${assistantName}, an AI assistant living inside Citadel — a personal command center for ${operatorName ?? "the operator"}.`,
    `Style: concise, direct, helpful. Skip greetings. Skip filler. Skip "As an AI…" disclaimers. Use short paragraphs and bullets when listing.`,
    `Today's date: ${new Date().toISOString().slice(0, 10)}.`,
    accountCount > 0
      ? `Connected Google accounts: ${accountCount}.`
      : "No Google accounts connected.",
    "",
    "CONTEXT NOTES:",
    "- EMAIL_CONTEXT entries show 'to:<account>' for the receiving account, plus from/date/subject/snippet. Cite emails as [N].",
    "- SPOTIFY_CONTEXT shows what's currently playing + recent top tracks/artists.",
    "- YOUTUBE_CONTEXT shows the user's channel + subscriptions + recent activity from subscriptions.",
    "- GITHUB_CONTEXT shows the user's GitHub profile, top recent repos with languages, open pull requests, review requests, and recent activity (pushes/PRs/issues/releases). Cite repos as `name` or `owner/name`.",
    "- REMINDERS_CONTEXT shows the user's open + recently-done reminders. Cite as [O1]/[D1].",
    "- STICKERS_CONTEXT shows the user's sticky notes / text notes / todo panels on the network canvas.",
    "- CURRENT_SETTINGS shows the user's current Citadel preferences.",
    "",
    "Never invent emails, songs, videos, reminders, or settings not present in the contexts. If a relevant context block is missing for the user's question, say so plainly and tell them which connection to wire up in Settings.",
  ];
  if (enableActions) {
    sections.push("", buildActionInstructions());
  }
  sections.push("", ...contextBlocks);
  return sections.join("\n");
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "empty_message" }, { status: 400 });
  }
  const provider = body.provider ?? "gemini";
  const assistantName = (body.assistantName ?? "Sentinel").slice(0, 64);
  const clientContext = body.clientContext ?? {};

  if (provider === "openai" || provider === "claude") {
    return NextResponse.json(
      {
        error: "provider_not_implemented",
        provider,
        hint: `${provider === "openai" ? "OpenAI" : "Claude"} is a bring-your-own-key provider — paste your API key in the configure dialog once that surface lands. For now switch back to Gemini.`,
      },
      { status: 501 }
    );
  }

  const intents = detectIntents(message);

  // ----- Server-side context fetches (parallel) -----
  let emailBlock = "";
  let accountCount = 0;
  let spotifyBlock = "";
  let youtubeBlock = "";
  let githubBlock = "";

  const fetches: Array<Promise<void>> = [];
  if (intents.email) {
    fetches.push(
      fetchRecentEmailContext()
        .then(({ emails, accountCount: n }) => {
          accountCount = n;
          emailBlock = formatEmailContextForPrompt(emails);
        })
        .catch((e) => {
          console.error("[ai/assistant] email context failed:", e);
        })
    );
  }
  if (intents.spotify) {
    fetches.push(
      fetchSpotifyContext()
        .then((s) => {
          if (s) spotifyBlock = s;
        })
        .catch(() => {})
    );
  }
  if (intents.youtube) {
    fetches.push(
      fetchYouTubeContext()
        .then((s) => {
          if (s) youtubeBlock = s;
        })
        .catch(() => {})
    );
  }
  if (intents.github) {
    fetches.push(
      fetchGithubContext()
        .then((s) => {
          if (s) githubBlock = s;
        })
        .catch(() => {})
    );
  }
  await Promise.all(fetches);

  // ----- Client-supplied context blocks -----
  const remindersBlock = intents.reminder ? formatRemindersContext(clientContext) : "";
  const stickersBlock = intents.sticker ? formatStickersContext(clientContext) : "";
  // CURRENT_SETTINGS is included WHENEVER actions are enabled so the model
  // can avoid re-applying a setting that's already in the desired state.
  const settingsBlock = intents.settings ? formatSettingsContext(clientContext) : "";

  const contextBlocks = [
    emailBlock,
    spotifyBlock,
    youtubeBlock,
    githubBlock,
    remindersBlock,
    stickersBlock,
    settingsBlock,
  ].filter(Boolean);

  // Short-circuit: user asked an email question with zero accounts AND no
  // other context to lean on — skip the LLM round-trip.
  if (intents.email && accountCount === 0 && contextBlocks.length === 0) {
    return NextResponse.json({
      reply:
        "Connect a Google account first so your assistant can access email context. Settings → Core Account → Connect Google.",
      provider: "gemini",
      model: process.env.GEMINI_MODEL,
      usage: undefined,
      contextsUsed: [],
      accountCount: 0,
    });
  }

  const systemPrompt = buildSystemPrompt(
    assistantName,
    clientContext.operatorName,
    contextBlocks,
    intents.settings,
    accountCount
  );

  try {
    const result = await generateWithGemini(systemPrompt, message);
    return NextResponse.json({
      reply: result.text,
      provider: "gemini",
      model: result.model,
      usage: result.usage as GeminiUsage,
      truncated: result.truncated,
      finishReason: result.finishReason,
      contextsUsed: {
        email: !!emailBlock,
        spotify: !!spotifyBlock,
        youtube: !!youtubeBlock,
        github: !!githubBlock,
        reminders: !!remindersBlock,
        stickers: !!stickersBlock,
        settings: !!settingsBlock,
      },
      accountCount,
    });
  } catch (e) {
    if (e instanceof GeminiConfigError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: 503 }
      );
    }
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[ai/assistant] gemini failure:", e);
    return NextResponse.json({ error: "gemini_failed", message: msg }, { status: 502 });
  }
}
