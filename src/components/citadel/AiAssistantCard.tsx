"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  Send,
  Settings2,
  AlertTriangle,
  Cpu,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCitadel } from "@/lib/store";
import { AiCore, type AiCoreState } from "./AiCore";
import { AiAssistantConfigModal } from "./AiAssistantConfigModal";
import { AiMarkdown } from "./AiMarkdown";
import { PROVIDERS, DEFAULT_ASSISTANT_NAME } from "@/lib/ai/providers";
import { useAssistant } from "@/lib/ai-client";

// One-turn chat history slot. We keep just the most recent exchange visible
// so the dashboard card stays compact — full multi-turn conversation could
// land in a /assistant route later.
type Exchange = {
  user: string;
  reply?: string;
  error?: string;
  usage?: {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
  };
  model?: string;
  contextsUsed?: {
    email?: boolean;
    spotify?: boolean;
    youtube?: boolean;
    github?: boolean;
    reminders?: boolean;
    stickers?: boolean;
    settings?: boolean;
  };
  appliedActions?: Array<{ description: string }>;
  truncated?: boolean;
};

type StatusResp = {
  providers?: {
    gemini?: {
      configured?: boolean;
      project?: string;
      location?: string;
      model?: string;
      missing?: string[];
    };
  };
};

export function AiAssistantCard() {
  const assistant = useCitadel((s) => s.prefs.assistant);
  const setAssistant = useCitadel((s) => s.setAssistant);
  const addChatExchange = useCitadel((s) => s.addChatExchange);
  const name = assistant?.name ?? DEFAULT_ASSISTANT_NAME;
  const provider = assistant?.provider ?? "gemini";
  const providerMeta = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];

  const [configOpen, setConfigOpen] = useState(false);
  const [input, setInput] = useState("");
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [pending, setPending] = useState(false);
  // Session counters — live for this tab only, cleared on refresh.
  const [sessionTotals, setSessionTotals] = useState({
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  });

  const { data: status } = useSWR<StatusResp>("/api/ai/status", {
    refreshInterval: 5 * 60_000,
  });
  const geminiConfigured = status?.providers?.gemini?.configured ?? null;
  const missing = status?.providers?.gemini?.missing ?? [];
  const model = status?.providers?.gemini?.model;

  // Auto-grow textarea up to a small max so the card height stays predictable.
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 96) + "px";
  }, [input]);

  // Use the shared hook — it owns clientContext assembly + action
  // application. We just thread the result into our local Exchange.
  const ai = useAssistant();
  const send = async () => {
    const text = input.trim();
    if (!text || pending) return;
    setPending(true);
    setExchange({ user: text });
    setInput("");
    const body = await ai.ask(text);
    if (!body) {
      setExchange((p) => ({
        user: p?.user ?? text,
        error: ai.error ?? "ai_failed",
      }));
    } else {
      setExchange({
        user: text,
        reply: body.reply,
        usage: body.usage,
        model: body.model,
        contextsUsed: body.contextsUsed,
        appliedActions: body.appliedActions,
        truncated: body.truncated,
      });
      setSessionTotals((s) => ({
        requests: s.requests + 1,
        inputTokens: s.inputTokens + (body.usage?.promptTokens ?? 0),
        outputTokens: s.outputTokens + (body.usage?.candidatesTokens ?? 0),
        totalTokens: s.totalTokens + (body.usage?.totalTokens ?? 0),
      }));
      // Persist to history — available later in the Configure modal's History tab.
      addChatExchange({
        user: text,
        reply: body.reply,
        provider: body.provider,
        model: body.model,
        promptTokens: body.usage?.promptTokens,
        completionTokens: body.usage?.candidatesTokens,
        totalTokens: body.usage?.totalTokens,
        contextsUsed: body.contextsUsed,
      });
    }
    setPending(false);
  };

  const coreState: AiCoreState = pending
    ? "thinking"
    : exchange?.error
    ? "error"
    : "idle";

  // Suggestion chips. Show a few canned prompts when nothing's been sent yet.
  const suggestions = [
    "Summarize my latest emails",
    "What needs attention today?",
    "Show newest important emails",
  ];

  return (
    <>
      <motion.div
        // Black panel with thin border + accent glow. The glow intensifies
        // while the assistant is thinking via state-driven shadow swap.
        initial={false}
        animate={{
          boxShadow: pending
            ? "0 0 0 1px rgb(var(--accent-rgb) / 0.30), 0 0 60px rgb(var(--accent-rgb) / 0.20)"
            : "0 0 0 1px rgb(var(--accent-rgb) / 0.12), 0 0 30px rgb(var(--accent-rgb) / 0.06)",
        }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#06070a] p-5"
      >
        {/* Faint mesh-grid background — gives the panel that techy depth. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(rgb(var(--accent-rgb)) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="relative grid grid-cols-12 gap-5">
          {/* Left rail — animated AI core + identity */}
          <div className="col-span-12 flex flex-col items-center gap-3 sm:col-span-4">
            <AiCore state={coreState} size={120} />
            <div className="text-center">
              <div className="mono-tag">ai assistant</div>
              <div className="mt-0.5 text-[16px] font-medium tracking-tight text-white">
                {name}
              </div>
              <div className="mt-0.5 inline-flex items-center gap-1.5 text-[10.5px] text-muted">
                <Cpu className="h-3 w-3" strokeWidth={1.7} />
                <span>{providerMeta.label}</span>
                {model && (
                  <>
                    <span className="text-muted-soft">·</span>
                    <span className="font-mono text-[10px]">{model}</span>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={() => setConfigOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[10.5px] tracking-tight text-muted transition-colors hover:border-accent/30 hover:text-white"
            >
              <Settings2 className="h-3 w-3" strokeWidth={1.7} />
              Configure
            </button>
          </div>

          {/* Right side — chat */}
          <div className="col-span-12 flex flex-col gap-3 sm:col-span-8">
            {/* Status / config-error banner */}
            {geminiConfigured === false && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300/25 bg-amber-300/[0.04] p-3 text-[11.5px] text-amber-200/90">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                <div>
                  <div className="text-white">Gemini not yet configured.</div>
                  <div className="mt-0.5 leading-snug">
                    Missing: <code className="text-white">{missing.join(", ")}</code>.
                    Set in <code className="text-white">.env.local</code> and restart the dev server. ADC must be set up via <code className="text-white">gcloud auth application-default login</code>.
                  </div>
                </div>
              </div>
            )}

            {/* Exchange transcript — just the latest turn */}
            <div className="min-h-[120px] rounded-lg border border-white/[0.04] bg-black/30 p-3 text-[12.5px] leading-relaxed">
              {!exchange ? (
                <div className="text-muted">
                  Ask {name} anything — about your inbox, your day, your priorities.
                </div>
              ) : (
                <>
                  <div className="text-muted-soft">
                    <span className="text-muted">You</span> · {exchange.user}
                  </div>
                  <div className="mt-2 text-white">
                    {exchange.error ? (
                      <span className="text-rose-300">{exchange.error}</span>
                    ) : exchange.reply ? (
                      <AiMarkdown>{exchange.reply}</AiMarkdown>
                    ) : (
                      <span className="text-muted-soft italic">
                        {name} is thinking…
                      </span>
                    )}
                  </div>
                  {/* Context + action badges. One row, multiple chips. */}
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {exchange.contextsUsed?.email && <ContextChip label="EMAIL" />}
                    {exchange.contextsUsed?.spotify && <ContextChip label="SPOTIFY" />}
                    {exchange.contextsUsed?.youtube && <ContextChip label="YOUTUBE" />}
                    {exchange.contextsUsed?.github && <ContextChip label="GITHUB" />}
                    {exchange.contextsUsed?.reminders && (
                      <ContextChip label="REMINDERS" />
                    )}
                    {exchange.contextsUsed?.stickers && (
                      <ContextChip label="STICKERS" />
                    )}
                    {exchange.contextsUsed?.settings && (
                      <ContextChip label="SETTINGS" />
                    )}
                    {exchange.appliedActions?.map((a, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/[0.10] px-1.5 py-px text-[9.5px] tracking-wider text-white"
                      >
                        <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={2} />
                        APPLIED · {a.description.toUpperCase()}
                      </span>
                    ))}
                    {exchange.truncated && (
                      <span
                        className="inline-flex items-center gap-1 rounded-md border border-amber-300/25 bg-amber-300/[0.06] px-1.5 py-px text-[9.5px] tracking-wider text-amber-200"
                        title="Hit the output-token cap — ask 'continue' to extend."
                      >
                        TRUNCATED
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Suggestion chips */}
            {!exchange && (
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
                placeholder={`Ask ${name}…`}
                rows={1}
                disabled={pending}
                className="max-h-[96px] flex-1 resize-none border-0 bg-transparent text-[12.5px] leading-relaxed text-white placeholder:text-muted-soft focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={send}
                disabled={pending || !input.trim()}
                title="Send (Enter)"
                aria-label="Send message to assistant"
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md border transition-colors",
                  pending || !input.trim()
                    ? "border-white/[0.05] bg-white/[0.02] text-muted-soft"
                    : "border-accent/30 bg-accent/[0.10] text-white hover:bg-accent/[0.20]"
                )}
              >
                <Send className="h-3 w-3" strokeWidth={1.8} />
              </button>
            </div>

            {/* Session usage footer */}
            <div className="flex items-center justify-between gap-3 text-[10px] tracking-tight text-muted-soft">
              <div className="flex items-center gap-3">
                <span>
                  Session:{" "}
                  <span className="tabular-nums text-muted">
                    {sessionTotals.requests}
                  </span>{" "}
                  req
                </span>
                {sessionTotals.totalTokens > 0 && (
                  <>
                    <span>·</span>
                    <span>
                      <span className="tabular-nums text-muted">
                        {sessionTotals.totalTokens.toLocaleString()}
                      </span>{" "}
                      tokens
                    </span>
                  </>
                )}
              </div>
              <span title="Use Google Cloud Billing for exact spend">
                Cloud credit tracking available in Google Cloud Billing
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Reusable context badge — emerald-tinted to read as "data injected". */}
      <AiAssistantConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        name={name}
        provider={provider}
        onSave={(patch) => {
          setAssistant(patch);
          setConfigOpen(false);
        }}
      />
    </>
  );
}

function ContextChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300/15 bg-emerald-300/[0.05] px-1.5 py-px text-[9.5px] tracking-wider text-emerald-200">
      <Zap className="h-2.5 w-2.5" strokeWidth={2} />
      {label}
    </span>
  );
}
