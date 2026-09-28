// Type + metadata definitions for the AI Assistant providers. Gemini is the
// only one fully implemented this turn (via Vertex AI + ADC). OpenAI and
// Claude are first-class options in the UI but need BYOK before their call
// paths land.

export type AIProvider = "gemini" | "openai" | "claude";

export type ProviderMeta = {
  id: AIProvider;
  label: string;
  // Short blurb shown in the configure modal.
  description: string;
  // True if this provider is fully wired up — others render a "configure
  // your API key" affordance instead of a Test button.
  implemented: boolean;
  // Display name for the active model. For Gemini we read GEMINI_MODEL at
  // request time so we can't bake it in here; others have hardcoded defaults.
  defaultModelLabel?: string;
};

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "gemini",
    label: "Gemini",
    description:
      "Google's flagship multimodal model, served via Vertex AI with your local Application Default Credentials.",
    implemented: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    description:
      "GPT-class models. Requires a personal API key — bring your own and we'll store it encrypted server-side.",
    implemented: false,
    defaultModelLabel: "gpt-4.1-mini",
  },
  {
    id: "claude",
    label: "Claude",
    description:
      "Anthropic's Claude family. Requires a personal Anthropic API key — same storage pattern as OpenAI.",
    implemented: false,
    defaultModelLabel: "claude-sonnet-4",
  },
];

export const DEFAULT_ASSISTANT_NAME = "Sentinel";

// Suggested names the configure modal can offer as one-click pills. We
// don't enforce these — the input is free-text.
export const NAME_SUGGESTIONS = ["Sentinel", "Oracle", "Aegis", "Citadel Agent"];
