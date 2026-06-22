"use client";

import { getUniverse } from "@/lib/squads";
import type { TournamentFinaleSummary } from "@/lib/tournament-finale";
import { SquadUnlockBanner } from "@/components/SquadUnlockBanner";

interface TournamentFinaleProps {
  summary: TournamentFinaleSummary;
  championUniverseId?: string | null;
  newlyUnlockedSquadIds?: string[];
}

export function TournamentFinale({
  summary,
  championUniverseId,
  newlyUnlockedSquadIds = [],
}: TournamentFinaleProps) {
  const championUni = championUniverseId ? getUniverse(championUniverseId) : null;
  const accent = championUni?.accentColor ?? "#eab308";

  return (
    <div
      className="glass-panel relative mb-6 overflow-hidden border-t-4 p-6 animate-slide-in"
      style={{ borderTopColor: accent }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(234,179,8,0.45) 0%, transparent 55%)",
        }}
      />

      <div className="relative text-center">
        <p className="broadcast-label mb-1 text-broadcast-highlight">Tournament Complete</p>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{summary.formatLabel}</p>

        <div className="my-4 text-5xl" aria-hidden>
          🏆
        </div>

        <h2 className="font-display text-3xl font-bold uppercase tracking-wide text-broadcast-highlight md:text-4xl">
          {summary.userWon ? "You Are Champions!" : `${summary.championName} Win`}
        </h2>

        <p className="mt-2 font-display text-lg uppercase" style={{ color: accent }}>
          {summary.championName}
        </p>

        {summary.userWon ? (
          <>
            <p className="mt-3 text-sm text-slate-300">
              The trophy is yours. Every round, every fixture — you came out on top.
            </p>
            <SquadUnlockBanner squadIds={newlyUnlockedSquadIds} />
          </>
        ) : summary.userReachedFinal ? (
          <p className="mt-3 text-sm text-slate-400">
            Runners-up after a gruelling final. A step short — but a tournament to be proud of.
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-400">
            {summary.championName} lift the trophy. Better luck in the next draw.
          </p>
        )}

        {summary.finalScoreline ? (
          <div className="mx-auto mt-5 max-w-md border border-broadcast-border/60 bg-black/40 px-4 py-3">
            <p className="broadcast-label mb-1 text-[10px]">The Final</p>
            <p className="font-display text-sm font-semibold uppercase tracking-wide text-slate-200">
              {summary.finalScoreline}
            </p>
          </div>
        ) : null}

        {summary.playOfTournament ? (
          <div className="mx-auto mt-4 max-w-md border border-broadcast-highlight/40 bg-broadcast-highlight/10 px-4 py-4">
            <p className="broadcast-label mb-1 text-broadcast-highlight">Player of the Tournament</p>
            <p className="font-display text-xl font-bold uppercase text-slate-100">
              {summary.playOfTournament.playerName}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {summary.playOfTournament.teamLabel}
              {" · "}
              <span className="font-mono text-broadcast-highlight">
                {summary.playOfTournament.rating.toFixed(1)}
              </span>{" "}
              avg rating
              {summary.playOfTournament.matches > 1 ? (
                <span> · {summary.playOfTournament.matches} matches</span>
              ) : null}
              {summary.playOfTournament.goals > 0 ? (
                <span>
                  {" · "}
                  {summary.playOfTournament.goals}G
                  {summary.playOfTournament.assists > 0
                    ? ` ${summary.playOfTournament.assists}A`
                    : ""}
                </span>
              ) : null}
            </p>
          </div>
        ) : null}

        {summary.topScorers.length || summary.topRated.length ? (
          <div className="mx-auto mt-4 max-w-lg text-left">
            <p className="broadcast-label mb-2 text-center">Tournament Leaders</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {summary.topScorers.length ? (
                <div className="border border-broadcast-border/50 bg-black/30 p-3">
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Golden boot</p>
                  <ul className="space-y-1 text-xs">
                    {summary.topScorers.map((row, i) => (
                      <li key={`${row.playerName}-${i}`} className="flex justify-between gap-2">
                        <span className="truncate">
                          {row.playerName}
                          <span className="text-slate-500"> ({row.entrantName})</span>
                        </span>
                        <span className="shrink-0 font-mono text-slate-300">{row.goals}G</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {summary.topRated.length ? (
                <div className="border border-broadcast-border/50 bg-black/30 p-3">
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Top ratings</p>
                  <ul className="space-y-1 text-xs">
                    {summary.topRated.map((row, i) => (
                      <li key={`${row.playerName}-rtg-${i}`} className="flex justify-between gap-2">
                        <span className="truncate">
                          {row.playerName}
                          <span className="text-slate-500"> ({row.entrantName})</span>
                        </span>
                        <span className="shrink-0 font-mono text-broadcast-highlight">
                          {row.rating.toFixed(1)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {summary.journey.length > 0 ? (
          <div className="mt-6 text-left">
            <p className="broadcast-label mb-2 text-center">Your Tournament Run</p>
            <ul className="mx-auto max-w-md space-y-1.5 text-xs">
              {summary.journey.map((leg, i) => (
                <li
                  key={`${leg.roundName}-${i}`}
                  className={`flex items-center justify-between gap-2 border px-3 py-2 ${
                    leg.won
                      ? "border-broadcast-highlight/40 bg-broadcast-highlight/5"
                      : "border-broadcast-border/50 bg-black/30"
                  }`}
                >
                  <span className="font-display uppercase text-slate-400">{leg.roundName}</span>
                  <span className="truncate font-mono text-slate-300">{leg.scoreline}</span>
                  <span className={leg.won ? "text-broadcast-highlight" : "text-red-400"}>
                    {leg.won ? "W" : "L"}
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
