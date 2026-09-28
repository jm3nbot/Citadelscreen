import { createApiKeyProvider } from "@/lib/apikey-utils";

// Vercel API: https://vercel.com/docs/rest-api
// Get a token at: https://vercel.com/account/tokens
// Auth: Bearer. Note this replaces the env-var fallback in lib/integrations.ts
// for user-facing surfaces (the env-var path stays available for cron jobs).
export const vercel = createApiKeyProvider({
  id: "vercel",
  label: "Vercel",
  defaultBaseUrl: "https://api.vercel.com",
  authStyle: "bearer",
  validate: async (apiFetch) => {
    type Resp = {
      user?: {
        id?: string;
        username?: string;
        name?: string;
        email?: string;
        avatar?: string;
      };
    };
    const r = await apiFetch<Resp>("/v2/user");
    return {
      id: r.user?.id,
      login: r.user?.username,
      name: r.user?.name ?? r.user?.username,
      email: r.user?.email,
      avatarUrl: r.user?.avatar
        ? `https://vercel.com/api/www/avatar/${r.user.avatar}?s=64`
        : undefined,
    };
  },
});
