import { createOAuthProvider } from "@/lib/oauth-utils";

// Figma OAuth 2.0: https://www.figma.com/developers/api#authentication
// Dashboard: https://www.figma.com/developers/apps (create app)
// Comma-delimited scopes. Files-read covers what we need for a dashboard.
export const figma = createOAuthProvider({
  id: "figma",
  label: "Figma",
  authorizeUrl: "https://www.figma.com/oauth",
  tokenUrl: "https://www.figma.com/api/oauth/token",
  scopes: ["file_read"],
  scopeDelimiter: ",",
  extraAuthorizeParams: {
    response_type: "code",
  },
  fetchProfile: async (apiFetch) => {
    type FigmaUser = {
      id: string;
      handle?: string;
      email?: string;
      img_url?: string;
    };
    const u = await apiFetch<FigmaUser>("https://api.figma.com/v1/me");
    return {
      id: u.id,
      name: u.handle,
      email: u.email,
      avatarUrl: u.img_url,
    };
  },
});
