"use client";

import type { DragEvent } from "react";
import type { Formation, FormationSlot, Player } from "@/lib/types";
import type { LineupSlot } from "@/lib/types";
import type { FormationId } from "@/lib/types";
import { getPitchCoord } from "@/lib/pitch-layout";
import { getRoleKeyStats, STAT_SHORT } from "@/lib/stats";
import { readDragData, writeDragData } from "@/lib/pitch-dnd";
import { useGameStore } from "@/store/game-store";

interface PitchViewProps {
  formation: Formation;
  formationId: FormationId;
  lineup: LineupSlot[];
  accent: string;
  activeSlotId?: string | null;
  getPlayer: (name: string) => Player | undefined;
  onSlotClick?: (slotId: string) => void;
  /** Draft / substitution interactions */
  interactive?: boolean;
  onAssignPlayer?: (slotId: string, playerName: string) => void;
  onClearSlot?: (slotId: string) => void;
  onSwapSlots?: (fromSlotId: string, toSlotId: string) => void;
  changedSlotIds?: ReadonlySet<string>;
  subTargetSlotId?: string | null;
  stamina?: Record<string, number>;
  compact?: boolean;
  allowPitchDrag?: boolean;
}

function PitchSlotToken({
  slot,
  coord,
  player,
  accent,
  isActive,
  isChanged,
  isSubTarget,
  interactive,
  staminaVal,
  compact,
  allowPitchDrag = true,
  onClick,
  onClear,
  onDropPayload,
}: {
  slot: FormationSlot;
  coord: { x: number; y: number };
  player: Player | null;
  accent: string;
  isActive: boolean;
  isChanged: boolean;
  isSubTarget: boolean;
  interactive: boolean;
  staminaVal?: number;
  compact?: boolean;
  allowPitchDrag?: boolean;
  onClick?: () => void;
  onClear?: () => void;
  onDropPayload: (payload: ReturnType<typeof readDragData>) => void;
}) {
  const isPlayerFullyRevealed = useGameStore((s) => s.isPlayerFullyRevealed);
  const isStatRevealed = useGameStore((s) => s.isStatRevealed);
  const keyStats = getRoleKeyStats(slot.role);
  const fullyRevealed = player ? isPlayerFullyRevealed(player.name) : false;
  const width = compact ? "w-[4.25rem] sm:w-[4.75rem]" : "w-[4.75rem] sm:w-[5.5rem] md:w-[6.25rem]";

  function handleDragStart(e: DragEvent) {
    if (!interactive || !player || !allowPitchDrag) return;
    writeDragData(e, { kind: "slot", slotId: slot.id, playerName: player.name });
  }

  function handleDragOver(e: DragEvent) {
    if (!interactive) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: DragEvent) {
    if (!interactive) return;
    e.preventDefault();
    onDropPayload(readDragData(e));
  }

  return (
    <div
      className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 ${width} ${
        interactive ? "group" : ""
      }`}
      style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <button
        type="button"
        draggable={interactive && !!player && allowPitchDrag}
        onDragStart={handleDragStart}
        onClick={onClick}
        className={`relative w-full border text-left transition ${
          isSubTarget
        ? "border-2 border-broadcast-highlight bg-black/95 ring-2 ring-broadcast-highlight shadow-[0_0_10px_rgba(234,179,8,0.35)]"
          : isActive
            ? "border-2 border-broadcast-highlight bg-broadcast-highlight/15 ring-2 ring-broadcast-highlight/80"
            : isChanged
                ? "border-amber-400 bg-amber-950/40 ring-1 ring-amber-400/70"
                : player
                  ? "border-broadcast-border bg-black/85 hover:border-broadcast-highlight"
                  : "border-dashed border-slate-600 bg-black/60 hover:border-broadcast-highlight"
        }`}
      >
        {interactive && player && onClear ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Remove ${player.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
                onClear();
              }
            }}
            className="absolute -right-1.5 -top-1.5 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100"
          >
            ×
          </span>
        ) : null}

        <div
          className="flex items-center justify-between px-1 py-0.5 font-display text-[9px] font-bold uppercase tracking-wide"
          style={{ backgroundColor: accent, color: "#0a0a0a" }}
        >
          <span>{slot.label}</span>
          {player ? (
            <span>{fullyRevealed ? player.ovr : "??"}</span>
          ) : (
            <span className="opacity-70">+</span>
          )}
        </div>

        <div className={`px-1.5 ${compact ? "py-0.5" : "py-1"}`}>
          {player ? (
            <>
              <p className="truncate font-display text-[10px] font-semibold uppercase leading-tight tracking-wide sm:text-[11px]">
                {player.name}
              </p>
              {!compact ? (
                <div className="mt-1 grid grid-cols-3 gap-0.5">
                  {keyStats.map((key) => (
                    <div key={key} className="text-center">
                      <p className="text-[7px] uppercase text-slate-500">{STAT_SHORT[key]}</p>
                      <p className="font-mono text-[9px] font-semibold text-broadcast-highlight">
                        {isStatRevealed(player.name, key) ? player.stats[key] : "?"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : staminaVal === undefined ? (
                <p className="mt-0.5 truncate font-mono text-[9px] text-broadcast-highlight">
                  {keyStats
                    .map((key) => `${STAT_SHORT[key]} ${isStatRevealed(player.name, key) ? player.stats[key] : "?"}`)
                    .join(" · ")}
                </p>
              ) : staminaVal !== undefined ? (
                <p className="mt-0.5 font-mono text-[9px] text-slate-400">{Math.round(staminaVal)}% fit</p>
              ) : null}
            </>
          ) : (
            <p className="py-2 text-center font-display text-[9px] uppercase tracking-wider text-slate-500">
              Empty
            </p>
          )}
        </div>
      </button>
    </div>
  );
}

export function PitchView({
  formation,
  formationId,
  lineup,
  accent,
  activeSlotId = null,
  getPlayer,
  onSlotClick,
  interactive = false,
  onAssignPlayer,
  onClearSlot,
  onSwapSlots,
  changedSlotIds,
  subTargetSlotId = null,
  stamina,
  compact = false,
  allowPitchDrag = true,
}: PitchViewProps) {
  function handleDropOnSlot(slotId: string, payload: ReturnType<typeof readDragData>) {
    if (!payload) return;
    if (payload.kind === "bench") {
      onAssignPlayer?.(slotId, payload.playerName);
      return;
    }
    if (payload.kind === "slot") {
      if (payload.slotId === slotId) return;
      onSwapSlots?.(payload.slotId, slotId);
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden">
      <div
        className="relative aspect-[3/4] w-full max-h-full max-w-full border-2 border-green-800/80 overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, rgba(22,101,52,0.35) 0%, rgba(21,128,61,0.25) 45%, rgba(22,101,52,0.35) 100%)",
        }}
      >
        <div className="pointer-events-none absolute inset-2 border border-white/20" />
        <div className="pointer-events-none absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-white/20" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
        <div className="pointer-events-none absolute bottom-2 left-1/4 right-1/4 h-[14%] border border-t-white/20 border-white/20" />
        <div className="pointer-events-none absolute left-1/4 right-1/4 top-2 h-[14%] border border-b-white/20 border-white/20" />

        {formation.slots.map((slot) => {
          const assigned = lineup.find((l) => l.slotId === slot.id);
          const player = assigned?.playerName ? getPlayer(assigned.playerName) ?? null : null;
          const coord = getPitchCoord(formationId, slot.id);
          return (
            <PitchSlotToken
              key={slot.id}
              slot={slot}
              coord={coord}
              player={player}
              accent={accent}
              isActive={activeSlotId === slot.id}
              isChanged={changedSlotIds?.has(slot.id) ?? false}
              isSubTarget={subTargetSlotId === slot.id}
              interactive={interactive}
              compact={compact}
              allowPitchDrag={allowPitchDrag}
              staminaVal={player ? stamina?.[player.name] : undefined}
              onClick={() => onSlotClick?.(slot.id)}
              onClear={player && onClearSlot ? () => onClearSlot(slot.id) : undefined}
              onDropPayload={(payload) => handleDropOnSlot(slot.id, payload)}
            />
          );
        })}
      </div>
    </div>
  );
}
