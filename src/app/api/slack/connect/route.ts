import { slack } from "@/lib/providers/slack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = slack.connectHandler;
