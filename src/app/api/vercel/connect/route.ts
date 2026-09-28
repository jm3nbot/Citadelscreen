import { vercel } from "@/lib/providers/vercel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = vercel.connectHandler;
