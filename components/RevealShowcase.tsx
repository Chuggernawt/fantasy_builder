"use client";

import type { Player } from "@/lib/types";
import { getPlayer } from "@/lib/squads";
import { StatBars } from "@/components/StatBars";
import { STAT_SHORT } from "@/lib/stats";
import type { RevealHighlight } from "@/lib/reveal";

function RevealCard({
  player,
  accent,
  highlight,
}: {
  player: Player;
  accent: string;
  highlight: RevealHighlight;
}) {
  return (
    <div className="reveal-card animate-slide-in border border-broadcast-highlight/50 bg-black/80 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="broadcast-label text-[10px]">Unlocked</p>
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-broadcast-highlight">
            {player.name}
          </h3>
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center font-display text-lg font-bold"
          style={{ backgroundColor: accent, color: "#0a0a0a" }}
        >
          {highlight.mode === "full" ? player.ovr : "?"}
        </div>
      </div>
      {highlight.mode === "full" ? (
        <StatBars playerName={player.name} stats={player.stats} compact />
      ) : highlight.stat ? (
        <div className="rounded border border-broadcast-border bg-black/60 p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">
            {STAT_SHORT[highlight.stat]} revealed
          </p>
          <p className="mt-1 font-display text-3xl font-bold text-broadcast-highlight">
            {player.stats[highlight.stat]}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function RevealShowcase({
  highlights,
  accent,
}: {
  highlights: RevealHighlight[];
  accent?: string;
}) {
  if (!highlights.length) return null;

  return (
    <div className={`mt-4 grid gap-3 ${highlights.length > 1 ? "md:grid-cols-2" : ""}`}>
      {highlights.map((h) => {
        const player = getPlayer(h.universeId, h.playerName);
        if (!player) return null;
        return (
          <RevealCard
            key={`${h.universeId}-${h.playerName}-${h.stat ?? "full"}`}
            player={player}
            accent={accent ?? "#eab308"}
            highlight={h}
          />
        );
      })}
    </div>
  );
}
