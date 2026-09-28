"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Hexagon,
  Home,
  Network,
  AppWindow,
  Workflow,
  Mail,
  Calendar,
  Bell,
  Settings,
  FileText,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCitadel } from "@/lib/store";

// Per-nav-item hover micro-animations. The class is added to the link wrapper
// and animates the inner <svg> on :hover (~300-600ms).
const navItems: Array<{
  label: string;
  href: string;
  icon: typeof Home;
  hover?: string;
}> = [
  { label: "Home", href: "/", icon: Home, hover: "icon-hover-lift" },
  { label: "Network", href: "/network", icon: Network, hover: "icon-hover-spin" },
  { label: "Apps", href: "/apps", icon: AppWindow, hover: "icon-hover-lift" },
  { label: "Documents", href: "/documents", icon: FileText, hover: "icon-hover-lift" },
  { label: "Automations", href: "/automations", icon: Workflow, hover: "icon-hover-spin" },
  { label: "Inbox", href: "/inbox", icon: Mail, hover: "icon-hover-lift" },
  { label: "Calendar", href: "/calendar", icon: Calendar, hover: "icon-hover-lift" },
  { label: "Reminders", href: "/reminders", icon: Bell, hover: "icon-hover-bell" },
  { label: "Settings", href: "/settings", icon: Settings, hover: "icon-hover-gear" },
];

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useCitadel((s) => s.prefs.sidebarCollapsed);
  const toggleSidebar = useCitadel((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "relative z-20 hidden shrink-0 border-r border-white/[0.06] bg-ink-50/60 md:flex md:flex-col",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-[68px]" : "w-[224px]"
      )}
    >
      <div
        className={cn(
          "flex items-center px-3 pt-6 pb-5",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {collapsed ? (
          <button
            onClick={toggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-white/[0.08] to-white/[0.02] hairline transition-colors hover:from-white/[0.14] hover:to-white/[0.04]"
            title="Expand sidebar"
          >
            <Hexagon className="h-4 w-4 text-accent" strokeWidth={1.6} />
          </button>
        ) : (
          <>
            <Link href="/" className="flex items-center gap-2 px-2">
              <div className="relative flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-white/[0.08] to-white/[0.02] hairline">
                <Hexagon className="h-4 w-4 text-accent" strokeWidth={1.6} />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[15px] font-semibold tracking-[-0.02em] text-white">
                  Citadel
                </span>
                <span className="mono-tag mt-1 text-[9px]">command center</span>
              </div>
            </Link>
            <button
              onClick={toggleSidebar}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted transition-colors hover:border-white/[0.12] hover:text-white"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={1.7} />
            </button>
          </>
        )}
      </div>

      <nav className={cn("flex flex-col gap-0.5", collapsed ? "px-2" : "px-3")}>
        {navItems.map((item) => {
          const ItemIcon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group relative flex items-center rounded-lg transition-all",
                collapsed
                  ? "h-10 w-full justify-center"
                  : "gap-3 px-3 py-2 text-[13px]",
                active
                  ? "bg-white/[0.04] text-white"
                  : "text-muted hover:bg-white/[0.025] hover:text-white",
                item.hover
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 -translate-y-1/2 w-[2px] rounded-full bg-accent shadow-glow-sm" />
              )}
              <ItemIcon
                className={cn(
                  "h-[15px] w-[15px] shrink-0 transition-colors",
                  active ? "text-accent" : "text-muted-soft group-hover:text-white"
                )}
                strokeWidth={1.6}
              />
              {!collapsed && (
                <span className="tracking-tight">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Build / prototype chip removed — sidebar tail is just the collapse
          button on either layout. Keeps the chrome quiet. */}
      {!collapsed ? (
        <div className="mt-auto flex justify-end px-3 pb-4">
          <button
            onClick={toggleSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted transition-colors hover:border-white/[0.12] hover:text-white"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={1.7} />
          </button>
        </div>
      ) : (
        <div className="mt-auto flex justify-center pb-4">
          <button
            onClick={toggleSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-muted transition-colors hover:border-white/[0.12] hover:text-white"
            title="Expand sidebar"
          >
            <PanelLeft className="h-3.5 w-3.5" strokeWidth={1.7} />
          </button>
        </div>
      )}
    </aside>
  );
}
