import { createOAuthProvider } from "@/lib/oauth-utils";

// Notion OAuth: https://developers.notion.com/docs/authorization
// Dashboard: https://www.notion.so/profile/integrations
// Redirect URI must match exactly. Scopes are configured on the integration
// settings page, not in the authorize URL — so we send an empty scopes array.
export const notion = createOAuthProvider({
  id: "notion",
  label: "Notion",
  authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
  tokenUrl: "https://api.notion.com/v1/oauth/token",
  scopes: [],
  tokenAuth: "basic",
  extraAuthorizeParams: {
    owner: "user",
    response_type: "code",
  },
  fetchProfile: async (apiFetch) => {
    type NotionUser = {
      id: string;
      name?: string;
      avatar_url?: string;
      person?: { email?: string };
      bot?: { workspace_name?: string };
    };
    const user = await apiFetch<NotionUser>("https://api.notion.com/v1/users/me", {
      headers: { "Notion-Version": "2022-06-28" },
    });
    return {
      id: user.id,
      name: user.name,
      email: user.person?.email,
      avatarUrl: user.avatar_url,
      extra: { workspace: user.bot?.workspace_name },
    };
  },
});
