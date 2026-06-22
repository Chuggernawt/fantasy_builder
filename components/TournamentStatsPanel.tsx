"use client";

import type { TournamentAccumulatedStats } from "@/lib/tournament-types";
import {
  formatTournamentPlayerLine,
  playerAverageRating,
  topTournamentRatings,
  topTournamentScorers,
} from "@/lib/tournament-stats";

interface TournamentStatsPanelProps {
  stats: TournamentAccumulatedStats | null | undefined;
  compact?: boolean;
  title?: string;
}

export function TournamentStatsPanel({
  stats,
  compact = false,
  title = "Tournament stats",
}: TournamentStatsPanelProps) {
  if (!stats?.matchesPlayed) return null;

  const scorers = topTournamentScorers(stats, compact ? 3 : 5);
  const rated = topTournamentRatings(stats, compact ? 3 : 5, 1);

  if (!scorers.length && !rated.length) return null;

  return (
    <div className="glass-panel p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="broadcast-label">{title}</p>
        <p className="text-[10px] text-slate-500">
          {stats.matchesPlayed} fixture{stats.matchesPlayed === 1 ? "" : "s"} · {stats.totalGoals} goals
        </p>
      </div>

      <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2"}>
        {scorers.length ? (
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-500">Top scorers</p>
            <ul className="space-y-1">
              {scorers.map((row, i) => (
                <li
                  key={row.key}
                  className="flex items-center justify-between gap-2 border border-broadcast-border/40 px-2 py-1 text-xs"
                >
                  <span className="truncate">
                    <span className="mr-1 font-mono text-[10px] text-broadcast-highlight">
                      {i + 1}.
                    </span>
                    {row.playerName}
                    <span className="ml-1 text-slate-500">({row.entrantName})</span>
                  </span>
                  <span className="shrink-0 font-mono text-slate-300">
                    {formatTournamentPlayerLine(row)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {rated.length ? (
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-500">Top ratings</p>
            <ul className="space-y-1">
              {rated.map((row, i) => (
                <li
                  key={`${row.key}-rtg`}
                  className="flex items-center justify-between gap-2 border border-broadcast-border/40 px-2 py-1 text-xs"
                >
                  <span className="truncate">
                    <span className="mr-1 font-mono text-[10px] text-broadcast-highlight">
                      {i + 1}.
                    </span>
                    {row.playerName}
                    <span className="ml-1 text-slate-500">({row.entrantName})</span>
                  </span>
                  <span className="shrink-0 font-mono text-broadcast-highlight">
                    {playerAverageRating(row).toFixed(1)}
                    {row.goals > 0 ? (
                      <span className="ml-1 text-slate-400">· {row.goals}G</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
