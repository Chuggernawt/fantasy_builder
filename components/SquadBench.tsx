"use client";

import type { DragEvent } from "react";
import type { Player, Role } from "@/lib/types";
import { ALL_STAT_KEYS } from "@/lib/reveal";
import { STAT_SHORT } from "@/lib/stats";
import { writeDragData } from "@/lib/pitch-dnd";
import { useGameStore } from "@/store/game-store";

interface SquadBenchProps {
  players: Player[];
  role?: Role | null;
  roleLabel?: string | null;
  accent: string;
  assignedSlotPlayer?: string | null;
  onSelect?: (playerName: string) => void;
  onClearSlot?: () => void;
  draggable?: boolean;
}

export function SquadBench({
  players,
  role = null,
  roleLabel = null,
  accent,
  assignedSlotPlayer = null,
  onSelect,
  onClearSlot,
  draggable = false,
}: SquadBenchProps) {
  const isPlayerFullyRevealed = useGameStore((s) => s.isPlayerFullyRevealed);
  const isStatRevealed = useGameStore((s) => s.isStatRevealed);

  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="glass-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-broadcast-border px-2 py-1.5">
        <p className="broadcast-label text-[10px]">
          {roleLabel ? `Assign ${roleLabel}` : "Squad"}
        </p>
        {assignedSlotPlayer && onClearSlot ? (
          <button
            type="button"
            onClick={onClearSlot}
            className="mt-1 text-[10px] uppercase tracking-wider text-red-400 hover:text-red-300"
          >
            Clear slot
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {sorted.length === 0 ? (
          <p className="p-2 text-center text-xs text-slate-500">All players on pitch.</p>
        ) : (
          <ul className="space-y-0.5">
            {sorted.map((p) => {
              const isCurrent = p.name === assignedSlotPlayer;
              return (
                <li key={p.name}>
                  <button
                    type="button"
                    draggable={draggable}
                    onDragStart={(e: DragEvent) => {
                      if (!draggable) return;
                      writeDragData(e, { kind: "bench", playerName: p.name });
                    }}
                    onClick={() => onSelect?.(p.name)}
                    className={`flex w-full items-center gap-1.5 border px-1.5 py-1 text-left transition hover:border-broadcast-highlight ${
                      isCurrent
                        ? "border-broadcast-highlight bg-black/90"
                        : "border-broadcast-border bg-black/50"
                    } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center font-display text-[10px] font-bold"
                      style={{ backgroundColor: accent, color: "#0a0a0a" }}
                    >
                      {isPlayerFullyRevealed(p.name) ? p.ovr : "??"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[10px] font-semibold uppercase tracking-wide">
                        {p.name}
                      </p>
                      <div className="grid grid-cols-3 gap-x-1 gap-y-0.5">
                        {ALL_STAT_KEYS.map((key) => (
                          <span key={key} className="font-mono text-[8px] text-broadcast-highlight">
                            {STAT_SHORT[key]} {isStatRevealed(p.name, key) ? p.stats[key] : "?"}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
