"use client";

import type { ReactNode } from "react";

interface PageInstructionsProps {
  label?: string;
  children: ReactNode;
  accent?: string;
}

/** Instruction block — always placed at the top of the main content area. */
export function PageInstructions({
  label = "How it works",
  children,
  accent,
}: PageInstructionsProps) {
  return (
    <section
      className="mb-6 border border-broadcast-border bg-black/40 p-4 md:p-5"
      style={{ borderLeftWidth: 4, borderLeftColor: accent ?? "var(--broadcast-highlight, #facc15)" }}
    >
      <p className="broadcast-label mb-2">{label}</p>
      <div className="text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}
