import { createApiKeyProvider } from "@/lib/apikey-utils";

// Vapi (voice AI) API: https://docs.vapi.ai/
// Get a key at: https://dashboard.vapi.ai/keys
// Use the **Private** key — public keys are for browser tracking pixels.
// Auth: Bearer.
export const vapi = createApiKeyProvider({
  id: "vapi",
  label: "Vapi",
  defaultBaseUrl: "https://api.vapi.ai",
  authStyle: "bearer",
  validate: async (apiFetch) => {
    // /assistant?limit=1 lists assistants under the org — fastest auth check.
    type Resp = Array<{ id: string; name?: string }>;
    const r = await apiFetch<Resp>("/assistant?limit=1");
    return {
      name: "Vapi org",
      extra: { assistantsSampled: r?.length ?? 0 },
    };
  },
});
