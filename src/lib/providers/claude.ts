import { createApiKeyProvider } from "@/lib/apikey-utils";

// Anthropic / Claude API: https://docs.anthropic.com/en/api/
// Get a key at: https://console.anthropic.com/settings/keys
// Auth: x-api-key header + anthropic-version pinned to a known release.
export const claude = createApiKeyProvider({
  id: "claude",
  label: "Claude",
  defaultBaseUrl: "https://api.anthropic.com",
  authStyle: "x-api-key",
  extraHeaders: {
    "anthropic-version": "2023-06-01",
  },
  validate: async (apiFetch) => {
    // /v1/models is the cheapest auth test — it lists available models.
    type Resp = { data?: Array<{ id: string; display_name?: string }> };
    const r = await apiFetch<Resp>("/v1/models");
    const first = r.data?.[0];
    return {
      name: "Anthropic Claude",
      extra: {
        models: r.data?.length ?? 0,
        latestModel: first?.id,
      },
    };
  },
});
