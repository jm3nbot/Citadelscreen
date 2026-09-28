"use client";

import dynamic from "next/dynamic";

const NodeGraph = dynamic(
  () => import("@/components/citadel/NodeGraph").then((m) => m.NodeGraph),
  { ssr: false }
);

export default function NetworkPage() {
  return (
    <div className="relative h-full w-full">
      <NodeGraph />
    </div>
  );
}
