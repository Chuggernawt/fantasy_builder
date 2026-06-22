"use client";

import { getUniverse } from "@/lib/squads";
import {
  getUserTablePosition,
  getUserTeamRow,
  getUserTeamScorers,
  sortTable,
} from "@/lib/season";
import { isUserInRelegationZone, canContinueSeasonCampaign } from "@/lib/season-continue";
import type { SeasonState } from "@/lib/season-types";
import { SquadUnlockBanner } from "@/components/SquadUnlockBanner";

interface SeasonFinaleProps {
  season: SeasonState;
  newlyUnlockedSquadIds?: string[];
  onContinueSeason?: () => void;
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function SeasonFinale({
  season,
  newlyUnlockedSquadIds = [],
  onContinueSeason,
}: SeasonFinaleProps) {
  const userUniverse = getUniverse(season.userUniverseId);
  const championUni = season.championId ? getUniverse(season.championId) : null;
  const userWon = season.championId === season.userUniverseId;
  const relegated = isUserInRelegationZone(season);
  const canContinue = canContinueSeasonCampaign(season);
  const position = getUserTablePosition(season);
  const userRow = getUserTeamRow(season);
  const topScorers = getUserTeamScorers(season.playerStats, season.userUniverseId, 5);
  const sortedTable = sortTable(season.table).slice(0, 5);

  const headline = relegated
    ? "Relegated"
    : userWon
      ? "Champions!"
      : `Finished ${ordinal(position)}`;

  const borderColor = relegated
    ? "#ef4444"
    : userWon
      ? "#eab308"
      : (userUniverse?.accentColor ?? "#64748b");

  return (
    <div
      className="glass-panel mb-6 overflow-hidden border-t-4 p-5 animate-slide-in"
      style={{ borderTopColor: borderColor }}
    >
      <p className="broadcast-label mb-1">Season {season.seasonNumber} — Final Standings</p>
      <h2
        className={`font-display text-2xl font-bold uppercase tracking-wide md:text-3xl ${
          relegated ? "text-red-400" : "text-broadcast-highlight"
        }`}
      >
        {headline}
      </h2>
      <p className="mt-2 text-sm text-slate-300">
        {userUniverse?.name} · {season.length}-game league
        {userRow ? (
          <>
            {" "}
            — {userRow.won}W {userRow.drawn}D {userRow.lost}L · {userRow.points} pts ·{" "}
            {userRow.goalsFor}–{userRow.goalsAgainst} GD
          </>
        ) : null}
      </p>

      {relegated ? (
        <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 p-3">
          <p className="text-sm font-display uppercase tracking-wide text-red-400">
            Relegation confirmed
          </p>
          <p className="mt-1 text-sm text-slate-300">
            You finished in the bottom three. This save cannot continue into the next season — start
            a new campaign when you are ready.
          </p>
        </div>
      ) : userWon ? (
        <div className="mt-4 rounded border border-broadcast-highlight/40 bg-broadcast-highlight/10 p-3">
          <p className="text-sm font-display uppercase tracking-wide text-broadcast-highlight">
            Trophy reward unlocked
          </p>
          <p className="mt-1 text-sm text-slate-300">
            {season.length === 38
              ? "Your full 22-man squad stats are now revealed."
              : "11 random squad members have been fully revealed."}
          </p>
          <SquadUnlockBanner squadIds={newlyUnlockedSquadIds} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">
          {championUni?.name ?? "The league"} lift the trophy.
          {canContinue ? " Continue your campaign into the next season when ready." : null}
        </p>
      )}

      {canContinue && onContinueSeason ? (
        <button
          type="button"
          className="btn-broadcast-solid mt-4 w-full sm:w-auto"
          onClick={onContinueSeason}
        >
          Continue into Season {season.seasonNumber + 1}
        </button>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <p className="broadcast-label mb-2">Top of the Table</p>
          <ul className="space-y-1 text-xs">
            {sortedTable.map((row, i) => {
              const uni = getUniverse(row.universeId);
              const isUser = row.universeId === season.userUniverseId;
              return (
                <li
                  key={row.universeId}
                  className={`flex justify-between gap-2 ${isUser ? "font-bold text-broadcast-highlight" : "text-slate-400"}`}
                >
                  <span>
                    {i + 1}. {uni?.name ?? row.universeId}
                    {i === 0 ? " 🏆" : ""}
                  </span>
                  <span className="font-mono">{row.points} pts</span>
                </li>
              );
            })}
          </ul>
        </div>

        {topScorers.length > 0 ? (
          <div>
            <p className="broadcast-label mb-2">Your Top Scorers</p>
            <ul className="space-y-1 text-xs text-slate-400">
              {topScorers.map((r) => (
                <li key={r.key} className="flex justify-between gap-2">
                  <span className="font-display uppercase">{r.playerName}</span>
                  <span className="font-mono text-broadcast-highlight">
                    {r.goals}G{r.assists > 0 ? ` · ${r.assists}A` : ""}
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
