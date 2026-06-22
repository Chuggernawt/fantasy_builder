"use client";

import type { TeamTactics } from "@/lib/types";
import {
  BUILD_UP_OPTIONS,
  CHANCE_CREATION_OPTIONS,
  DEFENSIVE_SHAPE_OPTIONS,
  defaultTeamTactics,
} from "@/lib/tactics";

interface TacticsPreMatchSelectProps {
  value: TeamTactics | null | undefined;
  onChange: (tactics: TeamTactics) => void;
  disabled?: boolean;
}

const selectClass =
  "max-w-[6.5rem] border border-broadcast-border bg-black/80 px-1.5 py-1 text-[10px] text-slate-200 md:max-w-none md:px-2 md:text-xs";

export function TacticsPreMatchSelect({
  value,
  onChange,
  disabled = false,
}: TacticsPreMatchSelectProps) {
  const tactics = value ?? defaultTeamTactics();

  function patch(axis: keyof TeamTactics, next: string) {
    onChange({ ...tactics, [axis]: next } as TeamTactics);
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1 border-broadcast-border/60 md:gap-1.5 md:border-l md:pl-2"
      title="Pre-set your match tactics"
    >
      <span className="hidden font-display text-[9px] font-bold uppercase tracking-wider text-slate-500 lg:inline">
        Tactics
      </span>
      <label className="flex items-center gap-0.5">
        <span className="text-[9px] uppercase text-slate-500 md:text-[10px]">Build</span>
        <select
          aria-label="Build-up tactic"
          disabled={disabled}
          value={tactics.buildUp}
          onChange={(e) => patch("buildUp", e.target.value)}
          className={selectClass}
        >
          {BUILD_UP_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-0.5">
        <span className="text-[9px] uppercase text-slate-500 md:text-[10px]">Chance</span>
        <select
          aria-label="Chance creation tactic"
          disabled={disabled}
          value={tactics.chanceCreation}
          onChange={(e) => patch("chanceCreation", e.target.value)}
          className={selectClass}
        >
          {CHANCE_CREATION_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-0.5">
        <span className="text-[9px] uppercase text-slate-500 md:text-[10px]">Defend</span>
        <select
          aria-label="Defensive shape"
          disabled={disabled}
          value={tactics.defensiveShape}
          onChange={(e) => patch("defensiveShape", e.target.value)}
          className={selectClass}
        >
          {DEFENSIVE_SHAPE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
