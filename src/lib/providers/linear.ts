import { createOAuthProvider } from "@/lib/oauth-utils";

// Linear OAuth 2.0: https://developers.linear.app/docs/oauth/authentication
// Dashboard: https://linear.app/settings/api/applications
// Linear uses comma-delimited scopes and a GraphQL profile endpoint.
export const linear = createOAuthProvider({
  id: "linear",
  label: "Linear",
  authorizeUrl: "https://linear.app/oauth/authorize",
  tokenUrl: "https://api.linear.app/oauth/token",
  scopes: ["read"],
  scopeDelimiter: ",",
  extraAuthorizeParams: {
    response_type: "code",
    // Issue an actor=user token so we can read personal issues / PRs.
    actor: "user",
  },
  fetchProfile: async (apiFetch) => {
    type LinearResp = {
      data?: {
        viewer?: {
          id: string;
          name?: string;
          email?: string;
          avatarUrl?: string;
          displayName?: string;
        };
      };
      errors?: Array<{ message: string }>;
    };
    const r = await apiFetch<LinearResp>("https://api.linear.app/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query:
          "{ viewer { id name displayName email avatarUrl } }",
      }),
    });
    if (r.errors?.length) {
      throw new Error(`linear_graphql: ${r.errors[0].message}`);
    }
    const v = r.data?.viewer;
    return {
      id: v?.id,
      name: v?.displayName ?? v?.name,
      email: v?.email,
      avatarUrl: v?.avatarUrl,
    };
  },
});
