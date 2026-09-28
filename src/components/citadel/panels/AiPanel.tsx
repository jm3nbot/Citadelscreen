"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, AlertTriangle, Zap, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAssistant } from "@/lib/ai-client";
import { AiCore } from "@/components/citadel/AiCore";
import { AiMarkdown } from "@/components/citadel/AiMarkdown";
import { cn } from "@/lib/utils";

// Side-panel chat. Same backend route as the dashboard assistant card so
// the user gets identical behaviour everywhere — including the personally-
// chosen agent name and email-context auto-injection.
//
// Today only Gemini is wired; the chip just shows which provider is
// "speaking" for clarity. ChatGPT / Claude nodes will route to BYOK once
// those paths land.
//
// `nodeId` lets us tailor the persona slightly per node (e.g. clicking the
// Gemini node makes it explicit; clicking ChatGPT shows a BYOK hint).
export function AiPanel({ name, nodeId }: { name: string; nodeId?: string }) {
  const { ask, loading, error, reply, name: agentName } = useAssistant();
  const [input, setInput] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 88) + "px";
  }, [input]);

  // ChatGPT / Claude nodes: surface the BYOK note since their call paths
  // aren't wired yet. Clicking still works (routes to Gemini under the
  // hood) so the panel never feels broken.
  const isByokProvider = nodeId === "chatgpt" || nodeId === "claude";

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    ask(text);
  };

  const suggestions = [
    "Summarize my latest emails",
    "What needs attention?",
    `Quick brief from ${name}`,
  ];

  return (
    <div className="space-y-4">
      {/* Header — animated core + agent identity */}
      <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#06070a] p-3">
        <AiCore state={loading ? "thinking" : error ? "error" : "idle"} size={56} />
        <div className="min-w-0 flex-1">
          <div className="mono-tag">ai · {name.toLowerCase()}</div>
          <div className="mt-0.5 text-[14px] tracking-tight text-white">
            {agentName}
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted">
            Powered by {name}. Asks email questions are auto-injected with
            context from your connected accounts.
          </p>
        </div>
      </div>

      {isByokProvider && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.04] p-2.5 text-[11px] text-amber-200/85">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />
          <div>
            <span className="text-white">{name}</span> is a BYOK provider.
            Your messages route through Gemini for now. Configure your{" "}
            {name} key in the assistant settings to switch.
          </div>
        </div>
      )}

      {/* Chat transcript */}
      <div className="min-h-[100px] rounded-lg border border-white/[0.05] bg-black/30 p-3 text-[12px] leading-relaxed">
        {error ? (
          <div className="text-rose-300">{error}</div>
        ) : reply ? (
          <>
            <AiMarkdown>{reply.reply}</AiMarkdown>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {reply.contextsUsed?.email && <CtxChip label="EMAIL" />}
              {reply.contextsUsed?.spotify && <CtxChip label="SPOTIFY" />}
              {reply.contextsUsed?.youtube && <CtxChip label="YOUTUBE" />}
              {reply.contextsUsed?.reminders && <CtxChip label="REMINDERS" />}
              {reply.contextsUsed?.stickers && <CtxChip label="STICKERS" />}
              {reply.contextsUsed?.settings && <CtxChip label="SETTINGS" />}
              {reply.appliedActions?.map((a, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/[0.10] px-1.5 py-px text-[9.5px] tracking-wider text-white"
                >
                  <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={2} />
                  APPLIED · {a.description.toUpperCase()}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="text-muted">
            Ask {agentName} anything — about your inbox, your day, or this node.
          </div>
        )}
      </div>

      {/* Suggestion chips */}
      {!reply && !error && !loading && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => {
                setInput(s);
                requestAnimationFrame(() => taRef.current?.focus());
              }}
              className="rounded-full border border-white/[0.06] bg-white/[0.015] px-2.5 py-1 text-[10.5px] tracking-tight text-muted transition-colors hover:border-accent/30 hover:text-white"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="flex items-end gap-2 rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2">
        <textarea
          ref={taRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={`Ask ${agentName}…`}
          rows={1}
          disabled={loading}
          className="max-h-[88px] flex-1 resize-none border-0 bg-transparent text-[12.5px] leading-relaxed text-white placeholder:text-muted-soft focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          aria-label="Send"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md border transition-colors",
            loading || !input.trim()
              ? "border-white/[0.05] bg-white/[0.02] text-muted-soft"
              : "border-accent/30 bg-accent/[0.10] text-white hover:bg-accent/[0.20]"
          )}
        >
          <Send className="h-3 w-3" strokeWidth={1.8} />
        </button>
      </div>

      <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3 text-[11px] text-muted">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-accent" />
          <span className="text-white">Open the main assistant</span>
        </div>
        <p className="leading-snug">
          Full-screen assistant lives on the dashboard. Same agent, same context.
        </p>
        <a href="/" className="mt-2 inline-block">
          <Button size="sm" variant="subtle" icon={<ExternalLink className="h-3 w-3" />}>
            Dashboard
          </Button>
        </a>
      </div>
    </div>
  );
}

function CtxChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300/15 bg-emerald-300/[0.05] px-1.5 py-px text-[9.5px] tracking-wider text-emerald-200">
      <Zap className="h-2.5 w-2.5" strokeWidth={2} />
      {label}
    </span>
  );
}
