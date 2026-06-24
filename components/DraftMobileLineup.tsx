"use client";

import type { Formation, LineupSlot, Player } from "@/lib/types";
import { FormColorBar, FitnessPct, InjuryBadge } from "@/components/PlayerFormLegend";
import { useGameStore } from "@/store/game-store";

interface DraftMobileLineupProps {
  formation: Formation;
  lineup: LineupSlot[];
  accent: string;
  activeSlotId: string | null;
  getPlayer: (name: string) => Player | undefined;
  playerForm?: Record<string, number>;
  playerStamina?: Record<string, number>;
  injuryLabels?: Record<string, string>;
  onSlotPress: (slotId: string) => void;
  onClearSlot: (slotId: string) => void;
}

export function DraftMobileLineup({
  formation,
  lineup,
  accent,
  activeSlotId,
  getPlayer,
  playerForm,
  playerStamina,
  injuryLabels,
  onSlotPress,
  onClearSlot,
}: DraftMobileLineupProps) {
  const isPlayerFullyRevealed = useGameStore((s) => s.isPlayerFullyRevealed);

  return (
    <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <p className="broadcast-label shrink-0 border-b border-broadcast-border px-3 py-2 text-[11px]">
        Starting XI — tap a slot to assign
      </p>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {formation.slots.map((slot) => {
          const assigned = lineup.find((l) => l.slotId === slot.id);
          const name = assigned?.playerName ?? null;
          const player = name ? getPlayer(name) : undefined;
          const injured = name ? injuryLabels?.[name] : undefined;
          const isActive = activeSlotId === slot.id;
          const formVal = name && playerForm ? playerForm[name] : undefined;
          const staminaVal = name && playerStamina ? playerStamina[name] : undefined;

          return (
            <li key={slot.id} className="border-b border-broadcast-border/60 last:border-0">
              <div className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => onSlotPress(slot.id)}
                  className={`flex min-h-[3.25rem] flex-1 items-center gap-2 px-3 py-2 text-left transition ${
                    isActive ? "bg-broadcast-highlight/10" : "active:bg-black/60"
                  }`}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center font-display text-[11px] font-bold"
                    style={{ backgroundColor: accent, color: "#0a0a0a" }}
                  >
                    {slot.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    {name && player ? (
                      <>
                        <p className="truncate font-display text-sm font-semibold uppercase tracking-wide">
                          {name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="font-mono text-[11px] text-slate-400">
                            OVR {isPlayerFullyRevealed(name) ? player.ovr : "??"}
                          </span>
                          {injured ? <InjuryBadge label={injured} /> : null}
                        </div>
                      </>
                    ) : (
                      <p className="font-display text-sm uppercase tracking-wide text-slate-500">
                        Empty — tap to pick
                      </p>
                    )}
                  </div>
                  {staminaVal !== undefined ? (
                    <FitnessPct value={staminaVal} compact />
                  ) : null}
                </button>
                {name ? (
                  <button
                    type="button"
                    aria-label={`Clear ${slot.label}`}
                    onClick={() => onClearSlot(slot.id)}
                    className="shrink-0 border-l border-broadcast-border px-3 text-lg text-red-400 active:bg-red-950/40"
                  >
                    ×
                  </button>
                ) : null}
              </div>
              {formVal !== undefined ? <FormColorBar value={formVal} height="h-1.5" /> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
