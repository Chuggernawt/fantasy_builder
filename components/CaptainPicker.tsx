"use client";

import type { LineupSlot } from "@/lib/types";
import { getPlayer } from "@/lib/squads";

import { useGameStore } from "@/store/game-store";

interface CaptainPickerProps {
  universeId: string;
  lineup: LineupSlot[];
  value: string | null;
  disabled: boolean;
  accent: string;
  onSelect: (playerName: string) => void;
  prominent?: boolean;
}

export function CaptainPicker({
  universeId,
  lineup,
  value,
  disabled,
  accent,
  onSelect,
  prominent = false,
}: CaptainPickerProps) {
  const isPlayerFullyRevealed = useGameStore((s) => s.isPlayerFullyRevealed);
  const onPitch = lineup
    .map((s) => {
      const p = s.playerName ? getPlayer(universeId, s.playerName) : null;
      return p ? { name: p.name, ovr: p.ovr, role: s.role } : null;
    })
    .filter(Boolean) as { name: string; ovr: number; role: string }[];

  return (
    <div className={prominent ? "" : "mt-4"}>
      {!prominent && (
        <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">
          Captain&apos;s Call (once per half)
        </p>
      )}
      <div className={`grid gap-2 ${prominent ? "grid-cols-2 sm:grid-cols-3" : "flex flex-wrap"}`}>
        {onPitch.map((p) => (
          <button
            key={p.name}
            type="button"
            disabled={disabled || value === p.name}
            onClick={() => onSelect(p.name)}
            className={`border text-left transition active:scale-[0.98] ${
              prominent ? "flex items-center gap-2 px-3 py-2.5" : "px-2 py-1.5"
            } ${
              value === p.name
                ? "border-broadcast-highlight bg-broadcast-highlight/15"
                : "border-broadcast-border bg-black/60 hover:border-broadcast-highlight disabled:opacity-50"
            }`}
          >
            <span
              className={`inline-flex shrink-0 items-center justify-center font-display font-bold ${
                prominent ? "h-8 w-8 text-sm" : "h-5 w-5 text-[10px]"
              }`}
              style={{ backgroundColor: accent, color: "#0a0a0a" }}
            >
              {isPlayerFullyRevealed(p.name) ? p.ovr : "??"}
            </span>
            <span
              className={`font-display font-semibold uppercase ${
                prominent ? "text-xs" : "text-[11px]"
              }`}
            >
              {p.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
