"use client";

import type { LineupSlot, PlayerMatchStats } from "@/lib/types";

interface MatchSquadPanelProps {
  title: string;
  accent: string;
  lineup: LineupSlot[];
  stamina: Record<string, number>;
  playerStats?: Record<string, PlayerMatchStats>;
  captain?: string | null;
  compact?: boolean;
}

function StatCell({ value, highlight }: { value: number; highlight?: boolean }) {
  return (
    <span
      className={`inline-flex w-5 justify-center font-mono text-[10px] ${
        value > 0 ? (highlight ? "font-bold text-broadcast-highlight" : "text-slate-300") : "text-slate-700"
      }`}
    >
      {value > 0 ? value : "·"}
    </span>
  );
}

export function MatchSquadPanel({
  title,
  accent,
  lineup,
  stamina,
  playerStats = {},
  captain,
  compact = false,
}: MatchSquadPanelProps) {
  const rows = lineup.filter((s) => s.playerName);

  return (
    <div className="glass-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-broadcast-border px-2 py-2">
        <p className="broadcast-label truncate text-[10px]" style={{ color: accent }}>
          {title}
        </p>
        <div className="mt-1 grid grid-cols-[1.5rem_1fr_1rem_1rem_1rem_2.5rem] gap-0.5 text-[9px] uppercase tracking-wider text-slate-600">
          <span />
          <span>Player</span>
          <span className="text-center">G</span>
          <span className="text-center">A</span>
          <span className="text-center">Y</span>
          <span className="text-right">FIT</span>
        </div>
      </div>
      <ul className={`commentary-scroll flex-1 overflow-y-auto px-2 py-1 ${compact ? "text-[10px]" : ""}`}>
        {rows.map((slot) => {
          const name = slot.playerName!;
          const val = stamina[name] ?? 100;
          const ps = playerStats[name];
          const isCaptain = captain === name;

          return (
            <li key={slot.slotId} className="mb-2 border-b border-broadcast-border/40 pb-2 last:border-0">
              <div className="grid grid-cols-[1.5rem_1fr_1rem_1rem_1rem_2.5rem] items-center gap-0.5">
                <span className="font-display text-[9px] font-bold text-slate-500">{slot.role}</span>
                <span
                  className={`truncate font-display text-[10px] font-semibold uppercase leading-tight ${
                    isCaptain ? "text-broadcast-highlight" : ""
                  }`}
                  title={name}
                >
                  {isCaptain ? "★ " : ""}
                  {name}
                </span>
                <StatCell value={ps?.goals ?? 0} highlight />
                <StatCell value={ps?.assists ?? 0} />
                <StatCell value={ps?.yellowCards ?? 0} />
                <span className="text-right font-mono text-[9px] text-slate-500">{Math.round(val)}</span>
              </div>
              <div className="stat-bar-track mt-1 h-1.5">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${val}%`,
                    backgroundColor: val < 35 ? "#ef4444" : val < 60 ? accent : "#22c55e",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** @deprecated use MatchSquadPanel */
export const MatchStaminaPanel = MatchSquadPanel;
