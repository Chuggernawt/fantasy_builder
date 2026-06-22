"use client";

import { useMemo } from "react";
import { buildSeasonHubCommentary } from "@/lib/season-hub-commentary";
import type { SeasonState } from "@/lib/season-types";

const TONE_CLASS: Record<
  ReturnType<typeof buildSeasonHubCommentary>[number]["tone"],
  string
> = {
  neutral: "text-slate-300",
  positive: "text-emerald-400/90",
  negative: "text-red-400/90",
  highlight: "text-broadcast-highlight",
};

interface SeasonHubCommentaryProps {
  season: SeasonState;
  className?: string;
}

export function SeasonHubCommentary({ season, className = "" }: SeasonHubCommentaryProps) {
  const lines = useMemo(() => buildSeasonHubCommentary(season), [season]);

  if (!lines.length) return null;

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <p className="broadcast-label mb-2 shrink-0">Season Desk</p>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 text-[11px] leading-relaxed">
        {lines.map((line) => (
          <li
            key={line.id}
            className={`border-l-2 border-broadcast-border/60 py-0.5 pl-2 ${TONE_CLASS[line.tone]}`}
          >
            {line.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
