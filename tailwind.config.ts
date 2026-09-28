import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          0: "#000000",
          50: "#050507",
          100: "#0a0a0c",
          200: "#0f0f12",
          300: "#16161a",
          400: "#1c1c22",
          500: "#26262d",
          600: "#3a3a44",
        },
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          glow: "rgb(var(--accent-rgb) / <alpha-value>)",
          deep: "rgb(var(--accent-rgb) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "#8a8a93",
          soft: "#5a5a63",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgb(var(--accent-rgb) / 0.18)",
        "glow-sm": "0 0 12px rgb(var(--accent-rgb) / 0.14)",
        panel: "0 8px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
      },
      backgroundImage: {
        "grid-dots": "radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)",
        "subtle-gradient": "radial-gradient(1200px 600px at 50% -10%, rgba(56,189,248,0.06), transparent 60%), radial-gradient(900px 500px at 100% 100%, rgba(125,211,252,0.04), transparent 60%)",
      },
      animation: {
        "pulse-slow": "pulseSlow 3.6s ease-in-out infinite",
        "breathe": "breathe 5s ease-in-out infinite",
        "edge-flow": "edgeFlow 3s linear infinite",
        "fade-up": "fadeUp 0.6s ease-out forwards",
      },
      keyframes: {
        pulseSlow: {
          "0%, 100%": { opacity: "0.85", boxShadow: "0 0 0 rgb(var(--accent-rgb) / 0)" },
          "50%": { opacity: "1", boxShadow: "0 0 24px rgb(var(--accent-rgb) / 0.16)" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.015)" },
        },
        edgeFlow: {
          "0%": { strokeDashoffset: "20" },
          "100%": { strokeDashoffset: "0" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
