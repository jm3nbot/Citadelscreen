import { createOAuthProvider } from "@/lib/oauth-utils";

// Slack OAuth v2: https://api.slack.com/authentication/oauth-v2
// Dashboard: https://api.slack.com/apps (create app → OAuth & Permissions)
// Slack returns a non-standard token payload (authed_user, team, etc.) that
// the factory passes through verbatim via TokenBundle.meta. We re-fetch the
// auth.test endpoint for the canonical profile.
export const slack = createOAuthProvider({
  id: "slack",
  label: "Slack",
  authorizeUrl: "https://slack.com/oauth/v2/authorize",
  tokenUrl: "https://slack.com/api/oauth.v2.access",
  // User scopes — we want personal access, not workspace-bot access. Adjust
  // to match what you need from your app's OAuth scopes pane.
  scopes: ["identity.basic", "identity.email", "identity.avatar", "identity.team"],
  extraAuthorizeParams: {
    // user_scope must match `scopes` for Slack to issue an xoxp- user token.
    // We mirror them here so a single env doesn't need to be re-typed.
    user_scope:
      "identity.basic identity.email identity.avatar identity.team",
    response_type: "code",
  },
  fetchProfile: async (apiFetch) => {
    type SlackIdentity = {
      ok: boolean;
      user?: { id: string; name?: string; email?: string; image_192?: string };
      team?: { id: string; name?: string };
      error?: string;
    };
    const r = await apiFetch<SlackIdentity>(
      "https://slack.com/api/users.identity"
    );
    if (!r.ok) {
      throw new Error(`slack_${r.error ?? "unknown"}`);
    }
    return {
      id: r.user?.id,
      name: r.user?.name,
      email: r.user?.email,
      avatarUrl: r.user?.image_192,
      extra: { team: r.team?.name, teamId: r.team?.id },
    };
  },
});
