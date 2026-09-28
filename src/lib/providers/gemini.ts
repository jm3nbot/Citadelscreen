import { createApiKeyProvider } from "@/lib/apikey-utils";

// Google AI Studio / Gemini API: https://ai.google.dev/api
// Get a key at: https://aistudio.google.com/apikey
//
// NOTE: this is the AI Studio paste-key path, distinct from the production
// Vertex/ADC path used by lib/ai/gemini.ts. The AI assistant card continues
// to use ADC when available; the Apps page Connect button gives the user a
// simpler dev-mode option that doesn't require gcloud setup.
export const gemini = createApiKeyProvider({
  id: "gemini",
  label: "Gemini",
  defaultBaseUrl: "https://generativelanguage.googleapis.com",
  authStyle: "x-goog",
  validate: async (apiFetch) => {
    type Resp = {
      models?: Array<{
        name: string;
        displayName?: string;
        supportedGenerationMethods?: string[];
      }>;
    };
    const r = await apiFetch<Resp>("/v1beta/models");
    // Pick the first generation-capable model for the status pill.
    const gen = r.models?.find((m) =>
      m.supportedGenerationMethods?.includes("generateContent")
    );
    return {
      name: "Google AI Studio",
      extra: {
        models: r.models?.length ?? 0,
        latestModel: gen?.name?.replace(/^models\//, ""),
      },
    };
  },
});
