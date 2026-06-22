"use client";

import { getActiveFixture, getEntrant } from "@/lib/tournament";
import type { TournamentFixture, TournamentState } from "@/lib/tournament-types";

interface TournamentKnockoutBracketProps {
  tournament: TournamentState;
  compact?: boolean;
  offline?: boolean;
}

function entrantName(tournament: TournamentState, id: string): string {
  if (!id) return "TBD";
  return getEntrant(tournament, id)?.displayName ?? "TBD";
}

export function MatchCard({
  tournament,
  fixture,
  active,
  compact,
}: {
  tournament: TournamentState;
  fixture: TournamentFixture;
  active: boolean;
  compact?: boolean;
}) {
  const home = entrantName(tournament, fixture.homeEntrantId);
  const away = entrantName(tournament, fixture.awayEntrantId);
  const done = fixture.status === "finished";
  const live = fixture.status === "live";
  const score =
    done && fixture.homeScore != null
      ? `${fixture.homeScore}-${fixture.awayScore}${
          fixture.pensHome != null ? ` (${fixture.pensHome}-${fixture.pensAway}p)` : ""
        }`
      : null;

  function rowClass(side: "home" | "away") {
    const id = side === "home" ? fixture.homeEntrantId : fixture.awayEntrantId;
    const winner = fixture.winnerEntrantId === id;
    const base = compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";
    return `${base} truncate ${winner ? "bg-broadcast-highlight/15 font-semibold text-broadcast-highlight" : "text-slate-200"}`;
  }

  return (
    <div
      className={`min-w-[7.5rem] border ${
        active
          ? "border-broadcast-highlight bg-broadcast-highlight/10 shadow-[0_0_12px_rgba(234,179,8,0.15)]"
          : "border-broadcast-border/70 bg-black/50"
      } ${live ? "ring-1 ring-red-500/60" : ""}`}
      title={fixture.roundName}
    >
      <p className="border-b border-broadcast-border/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-500">
        {fixture.roundName}
        {live ? " · live" : ""}
      </p>
      <div className={rowClass("home")}>{home}</div>
      <div className="border-y border-broadcast-border/40 px-1.5 py-0.5 text-center text-[9px] text-slate-500">
        {score ?? "vs"}
      </div>
      <div className={rowClass("away")}>{away}</div>
    </div>
  );
}

export function TournamentKnockoutBracket({ tournament, compact, offline }: TournamentKnockoutBracketProps) {
  const active = getActiveFixture(tournament);
  const rounds = [...new Set(tournament.fixtures.map((f) => f.round))].sort((a, b) => a - b);

  if (!tournament.fixtures.length) {
    return (
      <p className="text-xs text-slate-500">
        {offline ? "Bracket will appear here." : "Bracket appears after the host runs the draw."}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-min items-stretch gap-3 py-1">
        {rounds.map((round, colIdx) => {
          const roundFixtures = tournament.fixtures.filter((f) => f.round === round);
          const isLast = colIdx === rounds.length - 1;
          return (
            <div key={round} className="flex items-stretch gap-2">
              <div
                className="flex flex-col justify-around gap-3"
                style={{ minHeight: roundFixtures.length === 1 ? "auto" : `${roundFixtures.length * 4.5}rem` }}
              >
                {roundFixtures.map((fixture) => (
                  <MatchCard
                    key={fixture.id}
                    tournament={tournament}
                    fixture={fixture}
                    active={active?.id === fixture.id}
                    compact={compact}
                  />
                ))}
              </div>
              {!isLast ? (
                <div className="flex w-3 shrink-0 flex-col justify-center">
                  <div className="h-px flex-1 border-r border-broadcast-border/50" />
                </div>
              ) : null}
            </div>
          );
        })}
        {tournament.championId ? (
          <div className="flex items-center">
            <div className="border border-broadcast-highlight/60 bg-broadcast-highlight/10 px-3 py-2 text-center">
              <p className="text-[9px] uppercase tracking-wide text-slate-500">Champion</p>
              <p className={`font-semibold text-broadcast-highlight ${compact ? "text-xs" : "text-sm"}`}>
                {entrantName(tournament, tournament.championId)}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
