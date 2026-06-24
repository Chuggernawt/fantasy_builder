"use client";

import type { DragEvent } from "react";
import type { Player, Role } from "@/lib/types";
import { ALL_STAT_KEYS } from "@/lib/reveal";
import { STAT_SHORT } from "@/lib/stats";
import { writeDragData } from "@/lib/pitch-dnd";
import { useGameStore } from "@/store/game-store";
import {
  FormColorBar,
  FitnessPct,
  InjuryBadge,
  PersistentMatchKey,
} from "@/components/PlayerFormLegend";

interface SquadBenchProps {
  players: Player[];
  role?: Role | null;
  roleLabel?: string | null;
  accent: string;
  assignedSlotPlayer?: string | null;
  onSelect?: (playerName: string) => void;
  onClearSlot?: () => void;
  draggable?: boolean;
  /** Per-player form (-5..+5) when in season/tournament draft. */
  playerForm?: Record<string, number>;
  /** Carried squad fitness (0–100) in season/tournament. */
  playerStamina?: Record<string, number>;
  /** Player name → sideline label e.g. "Out 3 matches". */
  injuryLabels?: Record<string, string>;
  showFormLegend?: boolean;
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
  playerForm,
  playerStamina,
  injuryLabels,
  showFormLegend = false,
}: SquadBenchProps) {
  const isPlayerFullyRevealed = useGameStore((s) => s.isPlayerFullyRevealed);
  const isStatRevealed = useGameStore((s) => s.isStatRevealed);

  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));
  const showForm = playerForm !== undefined;
  const showFitness = playerStamina !== undefined;

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
        {showFormLegend ? (
          <div className="mt-2">
            <PersistentMatchKey />
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {sorted.length === 0 ? (
          <p className="p-2 text-center text-xs text-slate-500">All players on pitch.</p>
        ) : (
          <ul className="space-y-1">
            {sorted.map((p) => {
              const isCurrent = p.name === assignedSlotPlayer;
              const injured = injuryLabels?.[p.name];
              const formVal = playerForm?.[p.name];
              const staminaVal = playerStamina?.[p.name];
              return (
                <li key={p.name}>
                  <button
                    type="button"
                    draggable={draggable && !injured}
                    onDragStart={(e: DragEvent) => {
                      if (!draggable || injured) return;
                      writeDragData(e, { kind: "bench", playerName: p.name });
                    }}
                    onClick={() => !injured && onSelect?.(p.name)}
                    disabled={!!injured}
                    className={`flex w-full flex-col overflow-hidden border text-left transition ${
                      injured
                        ? "cursor-not-allowed border-red-900/60 bg-red-950/30 opacity-70"
                        : "hover:border-broadcast-highlight"
                    } ${
                      isCurrent
                        ? "border-broadcast-highlight bg-black/90"
                        : "border-broadcast-border bg-black/50"
                    } ${draggable && !injured ? "cursor-grab active:cursor-grabbing" : ""}`}
                  >
                    <div className="flex w-full items-stretch gap-1.5 px-1.5 py-1.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center font-display text-xs font-bold"
                        style={{ backgroundColor: accent, color: "#0a0a0a" }}
                      >
                        {isPlayerFullyRevealed(p.name) ? p.ovr : "??"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="min-w-0 flex-1 truncate font-display text-[11px] font-semibold uppercase tracking-wide">
                            {p.name}
                          </p>
                          {injured ? <InjuryBadge label={injured} /> : null}
                        </div>
                        {injured ? (
                          <p className="truncate text-[10px] text-red-300">{injured}</p>
                        ) : null}
                        <div className="mt-0.5 grid grid-cols-3 gap-x-1 gap-y-0.5">
                          {ALL_STAT_KEYS.map((key) => (
                            <span key={key} className="font-mono text-[9px] text-broadcast-highlight">
                              {STAT_SHORT[key]} {isStatRevealed(p.name, key) ? p.stats[key] : "?"}
                            </span>
                          ))}
                        </div>
                      </div>
                      {showFitness && staminaVal !== undefined ? (
                        <FitnessPct value={staminaVal} />
                      ) : null}
                    </div>
                    {showForm && formVal !== undefined ? (
                      <FormColorBar value={formVal} height="h-2" />
                    ) : null}
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
