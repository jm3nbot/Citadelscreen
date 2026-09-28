"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Key,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { brandChip } from "@/lib/brand";
import { cn } from "@/lib/utils";

// Per-provider metadata for the modal: where to grab the key, what the
// fields are called, any pre-fill hints. The factory's POST /connect endpoint
// is generic — this modal is the user-facing layer.
export type ApiKeyProviderMeta = {
  id: string;
  name: string;
  icon: string;
  keyDashboardUrl: string;
  keyName: string; // "API key", "Secret token", etc.
  keyPlaceholder?: string;
  // For self-hosted instances (n8n)
  needsBaseUrl?: boolean;
  baseUrlPlaceholder?: string;
  // Short copy shown above the form.
  description: string;
};

export const API_KEY_PROVIDERS: Record<string, ApiKeyProviderMeta> = {
  claude: {
    id: "claude",
    name: "Claude",
    icon: "claude",
    keyDashboardUrl: "https://console.anthropic.com/settings/keys",
    keyName: "API key",
    keyPlaceholder: "sk-ant-...",
    description:
      "Anthropic's Claude API. Paste a key from the Anthropic console; we'll encrypt it before storing.",
  },
  chatgpt: {
    id: "openai",
    name: "ChatGPT",
    icon: "openai",
    keyDashboardUrl: "https://platform.openai.com/api-keys",
    keyName: "API key",
    keyPlaceholder: "sk-...",
    description:
      "OpenAI's API powers ChatGPT and GPT-4 access. Use a project key, not your account-wide key, if possible.",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    icon: "openai",
    keyDashboardUrl: "https://platform.openai.com/api-keys",
    keyName: "API key",
    keyPlaceholder: "sk-...",
    description:
      "OpenAI's API powers ChatGPT and GPT-4 access. Use a project key, not your account-wide key, if possible.",
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    icon: "gemini",
    keyDashboardUrl: "https://aistudio.google.com/apikey",
    keyName: "API key",
    keyPlaceholder: "AIza...",
    description:
      "Google AI Studio key (the free path). Distinct from the Vertex/ADC setup the production assistant uses.",
  },
  n8n: {
    id: "n8n",
    name: "n8n",
    icon: "n8n",
    keyDashboardUrl: "https://docs.n8n.io/api/authentication/",
    keyName: "API key",
    keyPlaceholder: "n8n_api_...",
    needsBaseUrl: true,
    baseUrlPlaceholder: "https://n8n.example.com",
    description:
      "n8n is self-hosted, so we need both your instance URL and an API key from Settings → API.",
  },
  vapi: {
    id: "vapi",
    name: "Vapi",
    icon: "vapi",
    keyDashboardUrl: "https://dashboard.vapi.ai/keys",
    keyName: "Private key",
    keyPlaceholder: "vapi_...",
    description:
      "Vapi voice AI. Use the Private key (the Public key is for browser-side tracking only).",
  },
  vercel: {
    id: "vercel",
    name: "Vercel",
    icon: "vercel",
    keyDashboardUrl: "https://vercel.com/account/tokens",
    keyName: "Personal token",
    keyPlaceholder: "vercel_...",
    description:
      "Generate a personal access token at Vercel → Account → Tokens. Scope it to read-only for safety.",
  },
};

type ConnectResp = {
  ok?: boolean;
  account?: { name?: string; login?: string; email?: string };
  error?: string;
  detail?: string;
};

export function ApiKeyModal({
  meta,
  open,
  onClose,
  onConnected,
}: {
  meta: ApiKeyProviderMeta | null;
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    name?: string;
    email?: string;
  } | null>(null);

  // Reset state on open.
  useEffect(() => {
    if (open) {
      setApiKey("");
      setBaseUrl("");
      setShowKey(false);
      setSubmitting(false);
      setError(null);
      setSuccess(null);
    }
  }, [open, meta?.id]);

  // ESC / scroll lock.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!meta) return null;

  const submit = async () => {
    setError(null);
    if (!apiKey.trim()) {
      setError("Paste a key to continue.");
      return;
    }
    if (meta.needsBaseUrl && !baseUrl.trim()) {
      setError("Instance URL is required for self-hosted providers.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/${meta.id}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          baseUrl: meta.needsBaseUrl ? baseUrl.trim() : undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as ConnectResp;
      if (!res.ok || !body.ok) {
        // 422 = key valid format but provider rejected it; everything else
        // is a real error.
        const msg =
          body.detail ??
          body.error ??
          (res.status === 422
            ? `${meta.name} rejected that key. Double-check you copied it fully and that it has the scopes you need.`
            : `Request failed (${res.status})`);
        setError(msg);
        return;
      }
      setSuccess({
        name: body.account?.name,
        email: body.account?.email ?? body.account?.login,
      });
      // Give the user a beat to see the success state, then close + refresh
      // the parent's status query.
      setTimeout(() => {
        onConnected();
        onClose();
      }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "network_error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[min(540px,95vw)] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#06070a] shadow-panel"
          >
            <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] bg-black/40 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border p-1.5",
                    brandChip[meta.icon.toLowerCase()] ??
                      "border-white/[0.08] bg-white/[0.02]"
                  )}
                >
                  <Icon name={meta.icon} className="h-full w-full" />
                </div>
                <div className="min-w-0">
                  <div className="mono-tag">connect</div>
                  <h2 className="mt-0.5 truncate text-[15px] font-medium tracking-tight text-white">
                    {meta.name}
                  </h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted hover:border-white/[0.12] hover:text-white"
                title="Close (Esc)"
                aria-label="Close modal"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </header>

            <div className="space-y-4 px-5 py-5">
              <p className="text-[12px] leading-relaxed text-muted">
                {meta.description}
              </p>

              {/* Where-to-get-key link */}
              <a
                href={meta.keyDashboardUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.015] px-2.5 py-1.5 text-[11.5px] tracking-tight text-muted hover:border-accent/30 hover:text-white"
              >
                Get a key →
                <ExternalLink className="h-3 w-3" strokeWidth={1.7} />
              </a>

              {/* Optional baseUrl field (n8n) */}
              {meta.needsBaseUrl && (
                <div>
                  <label className="mb-1.5 block text-[11.5px] tracking-tight text-white">
                    Instance URL
                  </label>
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={meta.baseUrlPlaceholder ?? "https://..."}
                    disabled={submitting || !!success}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] text-white placeholder:text-muted-soft focus:border-accent/40 focus:outline-none disabled:opacity-50"
                  />
                </div>
              )}

              {/* API key field with show/hide */}
              <div>
                <label className="mb-1.5 block text-[11.5px] tracking-tight text-white">
                  {meta.keyName}
                </label>
                <div className="relative">
                  <input
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={meta.keyPlaceholder ?? "Paste your key"}
                    disabled={submitting || !!success}
                    type={showKey ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 pr-9 font-mono text-[12px] text-white placeholder:text-muted-soft focus:border-accent/40 focus:outline-none disabled:opacity-50"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submit();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-muted hover:text-white"
                    aria-label={showKey ? "Hide key" : "Show key"}
                  >
                    {showKey ? (
                      <EyeOff className="h-3 w-3" strokeWidth={1.7} />
                    ) : (
                      <Eye className="h-3 w-3" strokeWidth={1.7} />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-muted-soft">
                  <Key className="h-2.5 w-2.5" strokeWidth={1.8} />
                  Stored encrypted (AES-256-GCM) in an httpOnly cookie. Never
                  written to disk, never sent anywhere except {meta.name}.
                </p>
              </div>

              {/* Error / success banner */}
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-300/20 bg-rose-300/[0.04] p-2.5 text-[11.5px] text-rose-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.7} />
                  <div className="break-words">{error}</div>
                </div>
              )}
              {success && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/[0.05] p-2.5 text-[11.5px] text-emerald-200">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.7} />
                  <div>
                    Connected to {meta.name}
                    {success.name ? ` as ${success.name}` : ""}
                    {success.email ? ` (${success.email})` : ""}.
                  </div>
                </div>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-white/[0.06] bg-black/30 px-5 py-3">
              <Button variant="subtle" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={submit}
                disabled={submitting || !!success || !apiKey.trim()}
                icon={
                  submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )
                }
              >
                {submitting
                  ? "Validating…"
                  : success
                  ? "Connected"
                  : "Connect"}
              </Button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
