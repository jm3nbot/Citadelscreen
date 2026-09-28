import { openai } from "@/lib/providers/openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = openai.statusHandler;
