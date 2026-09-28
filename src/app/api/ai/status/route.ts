import { NextResponse } from "next/server";
import { checkGeminiEnv } from "@/lib/ai/gemini";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Cheap precheck: returns env-config readiness without actually pinging the
// Vertex API. The configure modal hits this so it can show "ready" vs
// "missing env" without burning a Gemini call on every render.
export async function GET() {
  const env = checkGeminiEnv();
  return NextResponse.json({
    providers: {
      gemini: {
        configured: env.ok,
        project: env.project,
        location: env.location,
        model: env.model,
        missing: env.missing,
      },
      openai: { configured: false, byok: true },
      claude: { configured: false, byok: true },
    },
  });
}
