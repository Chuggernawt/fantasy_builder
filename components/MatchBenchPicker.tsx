"use client";

import type { Player } from "@/lib/types";
import { MATCH_BENCH_SIZE } from "@/lib/constants";
import { useGameStore } from "@/store/game-store";
import { FormColorBar, FitnessPct } from "@/components/PlayerFormLegend";

interface MatchBenchPickerProps {
  reserves: Player[];
  accent: string;
  compact?: boolean;
  matchBench?: string[];
  onTogglePlayer?: (playerName: string) => void;
  onAutoPick?: () => void;
  playerForm?: Record<string, number>;
  playerStamina?: Record<string, number>;
  injuryLabels?: Record<string, string>;
}

export function MatchBenchPicker({
  reserves,
  accent,
  compact = false,
  matchBench: matchBenchProp,
  onTogglePlayer,
  onAutoPick,
  playerForm,
  playerStamina,
  injuryLabels,
}: MatchBenchPickerProps) {
  const storeBench = useGameStore((s) => s.matchBench);
  const storeToggle = useGameStore((s) => s.toggleMatchBenchPlayer);
  const storeAutoPick = useGameStore((s) => s.autoPickMatchBench);
  const matchBench = matchBenchProp ?? storeBench;
  const toggleMatchBenchPlayer = onTogglePlayer ?? storeToggle;
  const autoPickMatchBench = onAutoPick ?? storeAutoPick;
  const isPlayerFullyRevealed = useGameStore((s) => s.isPlayerFullyRevealed);

  const sorted = [...reserves].sort((a, b) => a.name.localeCompare(b.name));
  const complete = matchBench.length === MATCH_BENCH_SIZE;
  const showForm = playerForm !== undefined;
  const showFitness = playerStamina !== undefined;

  if (compact) {
    return (
      <div className="glass-panel shrink-0 p-2">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="broadcast-label text-[10px]" style={{ color: accent }}>
            Match subs {matchBench.length}/{MATCH_BENCH_SIZE}
          </p>
          <button type="button" className="text-[10px] uppercase text-slate-400 hover:text-broadcast-highlight" onClick={autoPickMatchBench}>
            Random
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {sorted.map((p) => {
            const selected = matchBench.includes(p.name);
            const injured = injuryLabels?.[p.name];
            const formVal = playerForm?.[p.name];
            const staminaVal = playerStamina?.[p.name];
            return (
              <button
                key={p.name}
                type="button"
                disabled={!!injured}
                onClick={() => !injured && toggleMatchBenchPlayer(p.name)}
                className={`relative flex min-h-[3.25rem] flex-col overflow-hidden border text-left transition ${
                  injured
                    ? "cursor-not-allowed border-red-900/50 bg-red-950/30 opacity-70"
                    : selected
                    ? "border-broadcast-highlight bg-broadcast-highlight/10"
                    : "border-broadcast-border bg-black/50 hover:border-slate-500"
                }`}
                title={injured ?? p.name}
              >
                <div className="flex flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1">
                  {showFitness && staminaVal !== undefined ? (
                    <FitnessPct value={staminaVal} compact />
                  ) : null}
                  <span className="w-full truncate text-center font-display text-[9px] font-semibold uppercase leading-tight text-slate-200">
                    {p.name.split(" ").pop()}
                  </span>
                </div>
                {showForm && formVal !== undefined ? (
                  <FormColorBar value={formVal} height="h-2" />
                ) : null}
              </button>
            );
          })}
        </div>
        {!complete ? (
          <p className="mt-1 text-[9px] text-amber-400">Pick {MATCH_BENCH_SIZE - matchBench.length} more</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="glass-panel mt-4 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="broadcast-label" style={{ color: accent }}>
            Match Bench — {matchBench.length}/{MATCH_BENCH_SIZE}
          </p>
        </div>
        <button type="button" className="btn-broadcast text-xs" onClick={autoPickMatchBench}>
          Random Bench
        </button>
      </div>

      {sorted.length < MATCH_BENCH_SIZE ? (
        <p className="text-sm text-red-400">Not enough squad players left for a full bench.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {sorted.map((p) => {
            const selected = matchBench.includes(p.name);
            const formVal = playerForm?.[p.name];
            const staminaVal = playerStamina?.[p.name];
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => toggleMatchBenchPlayer(p.name)}
                className={`flex flex-col overflow-hidden border transition ${
                  selected
                    ? "border-broadcast-highlight bg-broadcast-highlight/10"
                    : "border-broadcast-border bg-black/50 hover:border-slate-500"
                }`}
              >
                <div className="flex items-start gap-2 px-2 py-2">
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center font-display text-xs font-bold"
                    style={{ backgroundColor: accent, color: "#0a0a0a" }}
                  >
                    {isPlayerFullyRevealed(p.name) ? p.ovr : "??"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[11px] font-semibold uppercase tracking-wide">
                      {p.name}
                    </p>
                    {showFitness && staminaVal !== undefined ? (
                      <div className="mt-1">
                        <FitnessPct value={staminaVal} compact />
                      </div>
                    ) : null}
                  </div>
                </div>
                {showForm && formVal !== undefined ? (
                  <FormColorBar value={formVal} height="h-2.5" />
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {!complete ? (
        <p className="mt-3 text-xs text-amber-400">
          Select {MATCH_BENCH_SIZE - matchBench.length} more substitute
          {MATCH_BENCH_SIZE - matchBench.length === 1 ? "" : "s"} to kick off.
        </p>
      ) : null}
    </div>
  );
}
