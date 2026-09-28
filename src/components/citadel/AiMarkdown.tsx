"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

// Lightweight markdown renderer tuned for AI replies inside Citadel's dark
// surfaces. All HTML is React-rendered (no dangerouslySetInnerHTML) and
// react-markdown sanitises by default, so model output can't inject script
// tags or arbitrary HTML.
//
// Why we need this: Gemini reliably emits `**bold**`, `## headings`, and
// `- bullets`. Rendering its text via plain whitespace-pre-wrap meant
// `**Needs Response**` showed the literal asterisks instead of bolding.

export function AiMarkdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Base text colour + tight line-height for chat-like density.
        "text-[13px] leading-relaxed text-white",
        className
      )}
    >
      <ReactMarkdown
        // Map every element to dark-theme-tuned styling. We do this with
        // components= instead of a global stylesheet so the AI surfaces stay
        // visually distinct from the rest of the app's typography.
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-white/90">{children}</em>
          ),
          // Headings get gradually-smaller treatment with a subtle accent.
          h1: ({ children }) => (
            <h2 className="mb-2 mt-2 text-[15px] font-semibold tracking-tight text-white">
              {children}
            </h2>
          ),
          h2: ({ children }) => (
            <h3 className="mb-1.5 mt-2 text-[14px] font-semibold tracking-tight text-white">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="mb-1 mt-2 text-[13px] font-semibold tracking-tight text-accent">
              {children}
            </h4>
          ),
          ul: ({ children }) => (
            <ul className="mb-2 ml-4 list-disc space-y-1 marker:text-accent/60">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 ml-4 list-decimal space-y-1 marker:text-accent/60">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="pl-1 text-white/90">{children}</li>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline underline-offset-2 hover:text-white"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-px font-mono text-[11.5px] text-white">
              {children}
            </code>
          ),
          // Block code = fenced ``` blocks; render as a small scroll panel.
          pre: ({ children }) => (
            <pre className="mb-2 overflow-x-auto rounded-lg border border-white/[0.06] bg-black/40 p-2.5 font-mono text-[11.5px] text-white/90">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-accent/30 pl-3 text-muted">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-white/[0.06]" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
