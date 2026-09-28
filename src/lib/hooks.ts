"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import type { Email, CalendarEvent } from "@/lib/types";
import type { DriveFile } from "@/app/api/drive/route";
// No sample-data imports — unsigned-in users see real empty states + a
// "Connect Google" CTA, not seeded placeholder emails / events.

export function useAuthStatus() {
  // NextAuth handles ONLY Google now. Spotify connection state lives in its
  // own cookie and is surfaced via /api/spotify/status, NOT via useSession.
  const { data, status } = useSession();
  const s = data as
    | {
        user?: { name?: string | null; email?: string | null; image?: string | null };
        googleError?: string;
        error?: string;
      }
    | null;
  return {
    signedIn: status === "authenticated",
    loading: status === "loading",
    user: s?.user,
    error: s?.googleError ?? s?.error,
  };
}

type GmailMeta = { profileEmail?: string; query?: string; resultSizeEstimate?: number };
type GmailResp = { emails?: Email[]; error?: string; meta?: GmailMeta };
type CalendarResp = { events?: CalendarEvent[]; error?: string };
type DriveResp = { files?: DriveFile[]; error?: string };

// Error shape thrown by the SWR fetcher (see Providers.tsx).
export type ApiError = Error & {
  status?: number;
  body?: {
    error?: string;
    code?: number;
    reason?: string;
    needsReauth?: boolean;
    apiDisabled?: boolean;
    projectId?: string;
  };
};

export function useGmail() {
  const { signedIn } = useAuthStatus();
  const { data, error, isLoading, mutate } = useSWR<GmailResp, ApiError>(
    signedIn ? "/api/gmail" : null
  );
  return {
    emails: data?.emails ?? [],
    live: signedIn && Array.isArray(data?.emails),
    loading: signedIn && isLoading,
    meta: data?.meta,
    error,
    refresh: mutate,
  };
}

export function useCalendar() {
  const { signedIn } = useAuthStatus();
  const { data, error, isLoading, mutate } = useSWR<CalendarResp>(
    signedIn ? "/api/calendar" : null
  );
  return {
    events: data?.events ?? [],
    live: signedIn && !!data?.events,
    loading: signedIn && isLoading,
    error,
    refresh: mutate,
  };
}

// Loose shape — every provider block at minimum reports {configured?, connected}.
// Specific account fields vary by provider but consumers only care whether
// the connection is live for the badge / Connect button.
type ProviderBlock = {
  configured?: boolean;
  connected: boolean;
  account?: Record<string, unknown>;
  error?: string;
  needsBaseUrl?: boolean;
};
type IntegrationStatus = Record<string, ProviderBlock>;

// Reads the real connection state for every integration. Powers the Apps
// page so we can stop labeling things "connected" when they aren't.
export function useIntegrationStatus() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(() => setEnabled(true), { timeout: 1200 });
      return () => win.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setEnabled(true), 800);
    return () => window.clearTimeout(id);
  }, []);

  const { data, isLoading, mutate } = useSWR<IntegrationStatus>(
    enabled ? "/api/integrations/status" : null,
    { refreshInterval: 60_000 }
  );
  return { status: data, loading: enabled && isLoading, refresh: mutate };
}

export function useDrive(type?: "docs" | "sheets") {
  const { signedIn } = useAuthStatus();
  const key = signedIn
    ? type
      ? `/api/drive?type=${type}`
      : "/api/drive"
    : null;
  const { data, error, isLoading, mutate } = useSWR<DriveResp>(key);
  return {
    files: data?.files ?? [],
    live: signedIn && !!data?.files,
    loading: signedIn && isLoading,
    error,
    refresh: mutate,
  };
}
