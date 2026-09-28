"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useCitadel } from "@/lib/store";

const NodeGraph = dynamic(() => import("./NodeGraph").then((m) => m.NodeGraph), {
  ssr: false,
});
const DashboardMode = dynamic(
  () => import("./DashboardMode").then((m) => m.DashboardMode),
  { ssr: false }
);

export function CitadelHome() {
  const viewMode = useCitadel((s) => s.prefs.viewMode);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-full w-full bg-citadel" />;

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0">
        {viewMode === "node" ? <NodeGraph /> : <DashboardMode />}
      </div>
    </div>
  );
}
