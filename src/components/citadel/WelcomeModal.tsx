"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hexagon, ArrowRight, Cpu } from "lucide-react";
import { useCitadel } from "@/lib/store";
import { AiCore } from "./AiCore";
import { NAME_SUGGESTIONS } from "@/lib/ai/providers";
import { cn } from "@/lib/utils";

// First-launch onboarding. Two-step flow:
//   1. Operator name — who are you?
//   2. AI agent name — what should we call your assistant?
// Both write into the Zustand store and persist. We only ever show this
// when operatorName is undefined; once it's set, you'd have to clear state
// (Settings → Danger Zone) to see it again.

type Step = "operator" | "agent";

export function WelcomeModal() {
  const operatorName = useCitadel((s) => s.prefs.operatorName);
  const assistant = useCitadel((s) => s.prefs.assistant);
  const setOperatorName = useCitadel((s) => s.setOperatorName);
  const setAssistant = useCitadel((s) => s.setAssistant);

  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<Step>("operator");
  const [opDraft, setOpDraft] = useState("");
  const [agentDraft, setAgentDraft] = useState("");

  useEffect(() => setHydrated(true), []);

  const open = hydrated && operatorName === undefined;

  // Step 1: capture operator name → advance to step 2.
  const submitOperator = () => {
    const v = opDraft.trim();
    if (!v) return;
    setOperatorName(v);
    // Pre-populate the agent name with a sensible default. User can replace.
    setAgentDraft(assistant?.name ?? "Sentinel");
    setStep("agent");
  };

  // Step 2: capture AI agent name → close the modal.
  const submitAgent = () => {
    const v = agentDraft.trim() || "Sentinel";
    setAssistant({ name: v, provider: "gemini" });
    // operatorName is already set; that closes the modal next render.
  };

  // Allow Enter to advance. Step 1's onKeyDown lives on the input; step 2
  // uses its own handler so the agent picker chips don't accidentally fire.
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-ink-50/95 backdrop-blur-xl"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(800px 500px at 50% 0%, rgb(var(--accent-rgb) / 0.10), transparent 60%), " +
                "radial-gradient(700px 400px at 100% 100%, rgb(var(--accent-rgb) / 0.06), transparent 70%)",
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-[min(520px,92vw)] px-6 text-center"
          >
            {step === "operator" ? (
              <OperatorStep
                draft={opDraft}
                setDraft={setOpDraft}
                onSubmit={submitOperator}
              />
            ) : (
              <AgentStep
                draft={agentDraft}
                setDraft={setAgentDraft}
                operatorName={opDraft}
                onSubmit={submitAgent}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OperatorStep({
  draft,
  setDraft,
  onSubmit,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.6 }}
        className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.01] shadow-glow-sm"
      >
        <Hexagon className="h-6 w-6 text-accent" strokeWidth={1.5} />
      </motion.div>

      <div className="mono-tag mb-2">first-time setup · 1 of 2</div>
      <h1 className="text-[32px] font-medium tracking-tight text-white">
        Welcome to Citadel.
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        Your living command center. Let's start with the basics —
      </p>

      <div className="mt-9">
        <label className="mb-3 block text-[12px] tracking-tight text-white/85">
          What should we call you, operator?
        </label>
        <div className="group relative">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit();
            }}
            maxLength={64}
            placeholder="Your name…"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-center text-[16px] tracking-tight text-white placeholder:text-muted-soft focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <div className="pointer-events-none absolute inset-x-6 -bottom-2 h-2 rounded-full bg-accent/40 blur-md opacity-0 transition-opacity group-focus-within:opacity-100" />
        </div>

        <button
          onClick={onSubmit}
          disabled={!draft.trim()}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/[0.10] px-5 py-2 text-[12.5px] tracking-tight text-white shadow-glow-sm transition-all hover:border-accent/55 hover:bg-accent/[0.18] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent/[0.10]"
        >
          Continue
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>

        <div className="mt-4 text-[10.5px] text-muted-soft">
          Press <kbd className="rounded border border-white/[0.10] bg-white/[0.04] px-1.5 py-0.5">Enter</kbd> to continue
        </div>
      </div>
    </>
  );
}

function AgentStep({
  draft,
  setDraft,
  operatorName,
  onSubmit,
}: {
  draft: string;
  setDraft: (v: string) => void;
  operatorName: string;
  onSubmit: () => void;
}) {
  return (
    <>
      {/* Animated AI core, ties this step visually to the assistant card
          the user will see right after. */}
      <div className="mx-auto mb-7 flex items-center justify-center">
        <AiCore state="idle" size={88} />
      </div>

      <div className="mono-tag mb-2">first-time setup · 2 of 2</div>
      <h1 className="text-[28px] font-medium tracking-tight text-white">
        Now name your AI agent.
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        Pick something personal — {operatorName || "Operator"}'s assistant deserves a name with character. You can change this any time from the dashboard.
      </p>

      <div className="mt-7">
        <label className="mb-3 block text-[12px] tracking-tight text-white/85">
          <Cpu className="mr-1 inline h-3.5 w-3.5 -translate-y-0.5 text-accent" strokeWidth={1.7} />
          Your agent's name
        </label>
        <div className="group relative">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit();
            }}
            maxLength={64}
            placeholder="Sentinel, Oracle, Aegis…"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-center text-[16px] tracking-tight text-white placeholder:text-muted-soft focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <div className="pointer-events-none absolute inset-x-6 -bottom-2 h-2 rounded-full bg-accent/40 blur-md opacity-0 transition-opacity group-focus-within:opacity-100" />
        </div>

        {/* Suggestion pills — one click prefills the input. Encourages the
            user to actually customise rather than accept the default. */}
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {NAME_SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setDraft(s)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10.5px] tracking-tight transition-colors",
                draft === s
                  ? "border-accent/40 bg-accent/[0.08] text-white"
                  : "border-white/[0.06] bg-white/[0.015] text-muted hover:border-white/[0.16] hover:text-white"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <button
          onClick={onSubmit}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/[0.10] px-5 py-2 text-[12.5px] tracking-tight text-white shadow-glow-sm transition-all hover:border-accent/55 hover:bg-accent/[0.18]"
        >
          Enter Citadel
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>

        <div className="mt-4 text-[10.5px] text-muted-soft">
          Press <kbd className="rounded border border-white/[0.10] bg-white/[0.04] px-1.5 py-0.5">Enter</kbd> to finish
        </div>
      </div>
    </>
  );
}
