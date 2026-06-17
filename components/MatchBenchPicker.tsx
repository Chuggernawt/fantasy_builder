"use client";

import type { Player } from "@/lib/types";
import { MATCH_BENCH_SIZE } from "@/lib/constants";
import { useGameStore } from "@/store/game-store";

interface MatchBenchPickerProps {
  reserves: Player[];
  accent: string;
  compact?: boolean;
  matchBench?: string[];
  onTogglePlayer?: (playerName: string) => void;
  onAutoPick?: () => void;
}

export function MatchBenchPicker({
  reserves,
  accent,
  compact = false,
  matchBench: matchBenchProp,
  onTogglePlayer,
  onAutoPick,
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
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => toggleMatchBenchPlayer(p.name)}
                className={`truncate border px-1 py-1 text-left font-display text-[9px] font-semibold uppercase ${
                  selected
                    ? "border-broadcast-highlight bg-broadcast-highlight/10 text-broadcast-highlight"
                    : "border-broadcast-border bg-black/50 text-slate-300 hover:border-slate-500"
                }`}
                title={p.name}
              >
                {p.name.split(" ").pop()}
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
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => toggleMatchBenchPlayer(p.name)}
                className={`border px-2 py-2 text-left transition ${
                  selected
                    ? "border-broadcast-highlight bg-broadcast-highlight/10"
                    : "border-broadcast-border bg-black/50 hover:border-slate-500"
                }`}
              >
                <span
                  className="mb-1 inline-flex h-7 w-7 items-center justify-center font-display text-xs font-bold"
                  style={{ backgroundColor: accent, color: "#0a0a0a" }}
                >
                  {isPlayerFullyRevealed(p.name) ? p.ovr : "??"}
                </span>
                <p className="truncate font-display text-[10px] font-semibold uppercase tracking-wide">
                  {p.name}
                </p>
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
