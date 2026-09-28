// Shared per-brand chip styles. Used by both the node graph and Apps page so
// logos render with consistent backdrops everywhere.
//
// Why this exists: some brand SVGs default to black fill (OpenAI/ChatGPT, n8n,
// GitHub) or rely on a colored backdrop (Claude on white, Vapi on black) to
// look correct. The chip provides that backdrop + any inversion needed.
export const brandChip: Record<string, string> = {
  // White-chip brands — black-fill SVGs render naturally on white
  chatgpt: "bg-white border-white/40",
  openai: "bg-white border-white/40",
  github: "bg-white border-white/40",
  // Notion's monochrome glyph: white chip, force fill to black
  notion: "bg-white border-white/40 [&_img]:[filter:brightness(0)]",
  // n8n: real brand red (their "wildflower" pink-red). SVG ships with fill
  // baked-in as white so no filter is needed — the previous brightness+invert
  // chain didn't work because <img> can't apply CSS color to SVG paths.
  n8n: "bg-[#ea4b71] border-[#ea4b71]/60",
  // Claude: official Anthropic orange glyph on white (matches claude.ai)
  claude: "bg-white border-white/40",
  // Vercel wordmark is already white-on-transparent
  vercel: "bg-black border-white/15",
  // Vapi's SVG already has a black bg baked in
  vapi: "bg-black border-white/15 overflow-hidden",
  // Lucide-fallback brand tints (no SVG logo bundled). The chip backdrop nudges
  // the eye toward the brand color even though the icon itself is generic.
  linear: "bg-violet-500/[0.08] border-violet-300/30",
  figma: "bg-rose-500/[0.08] border-rose-300/30",
  discord: "bg-indigo-500/[0.10] border-indigo-300/30",
};
