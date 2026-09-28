/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Drop dev-mode compile cost by tree-shaking barrel imports. Without this,
  // `import { Home } from "lucide-react"` pulls in every icon module (~1k+).
  // Next.js rewrites these imports per-symbol so only the icons we actually
  // use get compiled. Largest win is on lucide-react; framer-motion and
  // reactflow also benefit on cold compile.
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "reactflow"],
  },
};

module.exports = (phase) => ({
  ...nextConfig,
  // Keep the everyday production build separate from hot-reload output.
  distDir: phase === "phase-development-server" ? ".next" : ".next-production",
});
