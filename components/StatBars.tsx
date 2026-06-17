import type { StatKey } from "@/lib/types";
import { useGameStore } from "@/store/game-store";

const STAT_LABELS: Record<StatKey, string> = {
  pace: "PAC",
  power: "POW",
  stamina: "STA",
  tackling: "TCK",
  passing: "PAS",
  gk: "GK",
};

interface StatBarsProps {
  playerName: string;
  stats: Record<StatKey, number>;
  compact?: boolean;
}

export function StatBars({ playerName, stats, compact }: StatBarsProps) {
  const isStatRevealed = useGameStore((s) => s.isStatRevealed);
  const keys = Object.keys(STAT_LABELS) as StatKey[];
  return (
    <div className={compact ? "grid grid-cols-3 gap-1.5" : "grid grid-cols-2 gap-2 md:grid-cols-3"}>
      {keys.map((key) => (
        <div key={key}>
          <div className="mb-0.5 flex justify-between text-[10px] uppercase tracking-wider text-slate-400">
            <span>{STAT_LABELS[key]}</span>
            <span className="text-broadcast-highlight">
              {isStatRevealed(playerName, key) ? stats[key] : "?"}
            </span>
          </div>
          <div className="stat-bar-track">
            <div
              className="stat-bar-fill transition-all duration-500"
              style={{ width: `${isStatRevealed(playerName, key) ? stats[key] : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
