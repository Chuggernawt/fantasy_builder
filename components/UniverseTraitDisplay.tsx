"use client";

import { getUniverseTrait } from "@/lib/universe-traits";

interface UniverseTraitDisplayProps {
  universeId: string;
  accent?: string;
  /** card = picker/squad page · strip = draft/match headers · inline = single flowing line */
  variant?: "card" | "strip" | "inline";
  prefix?: string;
  className?: string;
}

export function UniverseTraitDisplay({
  universeId,
  accent,
  variant = "strip",
  prefix,
  className = "",
}: UniverseTraitDisplayProps) {
  const trait = getUniverseTrait(universeId);
  const borderColor = accent ?? "#eab308";

  if (variant === "card") {
    return (
      <div
        className={`mt-2 border-l-[3px] pl-2.5 ${className}`}
        style={{ borderColor }}
      >
        <p className="font-display text-xs font-bold uppercase tracking-wide text-slate-200">
          {prefix ? `${prefix} · ` : ""}
          {trait.label}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-slate-400">{trait.description}</p>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <p className={`text-xs leading-snug text-slate-400 ${className}`}>
        {prefix ? (
          <span className="font-display text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {prefix}{" "}
          </span>
        ) : null}
        <span className="font-display font-semibold uppercase tracking-wide text-slate-200">
          {trait.label}
        </span>
        <span> — {trait.description}</span>
      </p>
    );
  }

  return (
    <div
      className={`border border-broadcast-border/80 bg-black/40 px-2.5 py-1.5 ${className}`}
      style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
    >
      <p className="text-xs leading-snug text-slate-300">
        {prefix ? (
          <span className="mr-1.5 font-display text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {prefix}
          </span>
        ) : null}
        <span className="font-display font-semibold uppercase tracking-wide text-slate-100">
          {trait.label}
        </span>
        <span className="text-slate-400"> — {trait.description}</span>
      </p>
    </div>
  );
}
