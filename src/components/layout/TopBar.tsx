"use client";

import { useEffect, useState } from "react";
import { Search, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { useAuthStatus } from "@/lib/hooks";
import { Icon } from "@/components/ui/Icon";
import { AmbientStrip } from "@/components/citadel/AmbientStrip";
import { QuoteTicker } from "@/components/citadel/QuoteTicker";
import { SpotifyNowPlaying } from "@/components/citadel/SpotifyNowPlaying";
import { SearchModal } from "@/components/citadel/SearchModal";

export function TopBar() {
  const { signedIn, user } = useAuthStatus();
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd/Ctrl-K opens the global search modal from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="relative z-20 flex h-14 items-center justify-between border-b border-white/[0.06] bg-ink-50/40 px-5 backdrop-blur-md">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <AmbientStrip />
        <SpotifyNowPlaying />
        <QuoteTicker className="hidden flex-1 lg:flex" />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setSearchOpen(true)}
          // Explicit h-8 + matching padding so the chip lines up exactly with
          // the Connect / Settings / Avatar chips on either side. Previously
          // the vertical paddings differed and it sat a pixel taller.
          className="icon-hover-lift hidden h-8 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-[12px] text-muted transition-colors hover:border-white/[0.12] hover:text-white md:flex"
          title="Search emails + documents (Cmd/Ctrl-K)"
          aria-label="Open search"
        >
          <Search className="h-[14px] w-[14px]" strokeWidth={1.7} />
          <span>Search</span>
          <kbd className="ml-1 rounded border border-white/[0.08] bg-white/[0.02] px-1.5 py-0.5 text-[10px] leading-none text-muted-soft">
            ⌘K
          </kbd>
        </button>
        <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

        {signedIn ? (
          <div className="hidden items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.04] px-2.5 py-1 md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.8)]" />
            <span className="max-w-[140px] truncate text-[11px] tracking-tight text-emerald-200">
              {user?.email ?? "Connected"}
            </span>
          </div>
        ) : (
          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="hidden items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[11.5px] text-muted transition-colors hover:border-accent/30 hover:bg-accent/[0.04] hover:text-white md:flex"
            title="Connect Google"
          >
            <Icon name="google" className="h-[13px] w-[13px]" />
            <span>Connect</span>
          </button>
        )}

        <Link
          href="/settings"
          className="icon-hover-gear flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-muted transition-colors hover:border-white/[0.12] hover:text-white"
          title="Settings"
        >
          <SettingsIcon className="h-[14px] w-[14px]" strokeWidth={1.7} />
        </Link>

        {signedIn && user?.image ? (
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="relative h-8 w-8 overflow-hidden rounded-full border border-white/[0.08]"
            title={`Signed in as ${user.email} — click to sign out`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={user.image} alt="" className="h-full w-full object-cover" />
          </button>
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] text-[10px] font-medium tracking-wider text-white"
            title="You"
          >
            OP
          </div>
        )}
      </div>
    </header>
  );
}
