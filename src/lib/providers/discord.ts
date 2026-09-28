import { createOAuthProvider } from "@/lib/oauth-utils";

// Discord OAuth 2.0: https://discord.com/developers/docs/topics/oauth2
// Dashboard: https://discord.com/developers/applications (create app → OAuth2)
// Add the same callback URL there as we register here.
export const discord = createOAuthProvider({
  id: "discord",
  label: "Discord",
  authorizeUrl: "https://discord.com/api/oauth2/authorize",
  tokenUrl: "https://discord.com/api/oauth2/token",
  scopes: ["identify", "email", "guilds"],
  extraAuthorizeParams: {
    response_type: "code",
    prompt: "consent",
  },
  fetchProfile: async (apiFetch) => {
    type DiscordUser = {
      id: string;
      username?: string;
      global_name?: string;
      email?: string;
      avatar?: string;
    };
    const u = await apiFetch<DiscordUser>(
      "https://discord.com/api/users/@me"
    );
    // Discord avatars need to be assembled from CDN: cdn.discordapp.com/avatars/<id>/<hash>.png
    const avatarUrl = u.avatar
      ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`
      : undefined;
    return {
      id: u.id,
      name: u.global_name ?? u.username,
      email: u.email,
      avatarUrl,
    };
  },
});
