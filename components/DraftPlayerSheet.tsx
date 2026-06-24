"use client";

import { useMemo, useState } from "react";
import type { Player, Role } from "@/lib/types";
import { FormColorBar, FitnessPct, InjuryBadge } from "@/components/PlayerFormLegend";
import { useGameStore } from "@/store/game-store";

interface DraftPlayerSheetProps {
  open: boolean;
  slotLabel: string;
  role: Role;
  accent: string;
  players: Player[];
  playerForm?: Record<string, number>;
  playerStamina?: Record<string, number>;
  injuryLabels?: Record<string, string>;
  onPick: (playerName: string) => void;
  onClose: () => void;
}

export function DraftPlayerSheet({
  open,
  slotLabel,
  role,
  accent,
  players,
  playerForm,
  playerStamina,
  injuryLabels,
  onPick,
  onClose,
}: DraftPlayerSheetProps) {
  const [query, setQuery] = useState("");
  const isPlayerFullyRevealed = useGameStore((s) => s.isPlayerFullyRevealed);

  const sorted = useMemo(() => {
    let list = [...players].sort((a, b) => a.name.localeCompare(b.name));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [players, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
      <button
        type="button"
        aria-label="Close player picker"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div className="relative flex max-h-[min(72dvh,32rem)] flex-col border-t-2 border-broadcast-highlight bg-stadium shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-broadcast-border px-3 py-3">
          <div>
            <p className="broadcast-label text-[10px]">Assign player</p>
            <p className="font-display text-base font-bold uppercase tracking-wide text-slate-100">
              {slotLabel} <span className="text-slate-500">({role})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-broadcast px-3 py-2 text-xs"
          >
            Close
          </button>
        </div>
        <div className="shrink-0 px-3 py-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search squad…"
            className="w-full border border-broadcast-border bg-black/80 px-3 py-2.5 text-sm outline-none focus:border-broadcast-highlight"
            autoFocus
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {sorted.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-slate-500">No players available.</li>
          ) : (
            sorted.map((p) => {
              const injured = injuryLabels?.[p.name];
              const formVal = playerForm?.[p.name];
              const staminaVal = playerStamina?.[p.name];
              return (
                <li key={p.name} className="mb-1">
                  <button
                    type="button"
                    disabled={!!injured}
                    onClick={() => {
                      onPick(p.name);
                      setQuery("");
                    }}
                    className={`flex w-full flex-col overflow-hidden border text-left transition ${
                      injured
                        ? "cursor-not-allowed border-red-900/50 bg-red-950/20 opacity-70"
                        : "border-broadcast-border bg-black/50 active:border-broadcast-highlight"
                    }`}
                  >
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center font-display text-xs font-bold"
                        style={{ backgroundColor: accent, color: "#0a0a0a" }}
                      >
                        {isPlayerFullyRevealed(p.name) ? p.ovr : "??"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm font-semibold uppercase tracking-wide">
                          {p.name}
                        </p>
                        {injured ? (
                          <p className="truncate text-[11px] text-red-300">{injured}</p>
                        ) : null}
                      </div>
                      {staminaVal !== undefined ? (
                        <FitnessPct value={staminaVal} compact />
                      ) : null}
                      {injured ? <InjuryBadge label={injured} /> : null}
                    </div>
                    {formVal !== undefined ? <FormColorBar value={formVal} height="h-1.5" /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
