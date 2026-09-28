"use client";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { SidePanel } from "@/components/citadel/SidePanel";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="relative min-h-0 flex-1 overflow-hidden">
          {children}
        </main>
      </div>
      <SidePanel />
    </div>
  );
}
