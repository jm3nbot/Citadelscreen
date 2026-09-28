import { createApiKeyProvider } from "@/lib/apikey-utils";

// n8n is self-hosted, so we need BOTH a base URL and an API key.
// Docs: https://docs.n8n.io/api/authentication/
// Get a key at: <your-n8n-instance>/settings/api
//
// Auth header: X-N8N-API-KEY (n8n-specific custom header, not Bearer).
export const n8n = createApiKeyProvider({
  id: "n8n",
  label: "n8n",
  needsBaseUrl: true,
  authStyle: "custom",
  customHeaderName: "X-N8N-API-KEY",
  validate: async (apiFetch) => {
    // /workflows is the canonical "is this key live" ping. We cap at 1
    // result to keep it cheap on big instances.
    type Resp = { data?: Array<{ id: string }> };
    const r = await apiFetch<Resp>("/api/v1/workflows?limit=1");
    return {
      name: "n8n instance",
      extra: { workflowsSampled: r.data?.length ?? 0 },
    };
  },
});
