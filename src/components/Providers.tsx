"use client";

import { SessionProvider } from "next-auth/react";
import { SWRConfig } from "swr";
import { ThemeBridge } from "./ThemeBridge";
import { RoutePrefetcher } from "./RoutePrefetcher";
import { WelcomeModal } from "./citadel/WelcomeModal";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  // Always try to parse the body — even on !ok — so callers can see the API
  // route's structured error (e.g. { error, reason, needsReauth }). Without
  // this, SWR's `error` is just a generic "fetch_failed" with no detail.
  let body: unknown = null;
  try {
    body = await r.json();
  } catch {}
  if (!r.ok) {
    const err: Error & { status?: number; body?: unknown } = new Error(
      (body as { error?: string })?.error ?? `fetch_failed_${r.status}`
    );
    err.status = r.status;
    err.body = body;
    throw err;
  }
  return body;
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SWRConfig
        value={{
          fetcher,
          revalidateOnFocus: false,
          shouldRetryOnError: false,
          dedupingInterval: 30_000,
        }}
      >
        <ThemeBridge />
        <RoutePrefetcher />
        <WelcomeModal />
        {children}
      </SWRConfig>
    </SessionProvider>
  );
}
