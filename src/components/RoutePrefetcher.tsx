"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ROUTES = ["/", "/network", "/apps", "/documents", "/automations", "/inbox", "/calendar", "/reminders", "/settings"];

export function RoutePrefetcher() {
  const router = useRouter();

  // Force the canonical origin to 127.0.0.1. Spotify rejects localhost as a
  // redirect URI and browsers treat the two hostnames as separate cookie
  // origins, so if the user opens localhost:3000 their NextAuth session +
  // Spotify cookie are silently invisible and every API call returns 401.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hostname === "localhost") {
      const next = new URL(window.location.href);
      next.hostname = "127.0.0.1";
      window.location.replace(next.toString());
    }
  }, []);

  useEffect(() => {
    const ids: number[] = [];

    // In dev, real route warmups made Next compile several pages at once,
    // stealing CPU from clicks and React Flow. Production still benefits from
    // cheap client chunk prefetching because routes are already compiled.
    if (process.env.NODE_ENV !== "production") return;

    ROUTES.forEach((path, i) => {
      const id = window.setTimeout(() => {
        try {
          router.prefetch(path);
        } catch {}
      }, 1500 + i * 500);
      ids.push(id);
    });

    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [router]);

  return null;
}
