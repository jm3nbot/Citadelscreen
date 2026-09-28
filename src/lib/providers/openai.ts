import { createApiKeyProvider } from "@/lib/apikey-utils";

// OpenAI / ChatGPT API: https://platform.openai.com/docs/api-reference
// Get a key at: https://platform.openai.com/api-keys
// Auth: Bearer token. /v1/models lists available models + verifies the key.
export const openai = createApiKeyProvider({
  id: "openai",
  label: "ChatGPT",
  defaultBaseUrl: "https://api.openai.com",
  authStyle: "bearer",
  validate: async (apiFetch) => {
    type Resp = { data?: Array<{ id: string; owned_by?: string }> };
    const r = await apiFetch<Resp>("/v1/models");
    // Pick a chat-capable model id for the status display, otherwise the
    // first one.
    const preferred =
      r.data?.find((m) => /^gpt-/.test(m.id) && !/embedding|audio|image/.test(m.id)) ??
      r.data?.[0];
    return {
      name: "OpenAI",
      extra: {
        models: r.data?.length ?? 0,
        latestModel: preferred?.id,
      },
    };
  },
});
