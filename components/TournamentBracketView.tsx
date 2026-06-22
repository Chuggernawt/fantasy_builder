"use client";

import {
  fixtureLabel,
  getActiveFixture,
  getEntrant,
  sortedRoundRobinTable,
} from "@/lib/tournament";
import type { TournamentFixture, TournamentState } from "@/lib/tournament-types";
import { tournamentFormatLabel } from "@/lib/tournament-types";
import { TournamentKnockoutBracket, MatchCard } from "@/components/TournamentKnockoutBracket";

interface TournamentBracketViewProps {
  tournament: TournamentState;
  compact?: boolean;
  /** When true, only show the visual bracket (no duplicate fixture list). */
  graphicOnly?: boolean;
  /** Solo offline tournament — no host/lobby copy. */
  offline?: boolean;
}

function phaseLabel(phase: TournamentState["phase"]): string {
  if (phase === "lobby") return "Lobby";
  if (phase === "draw") return "Draw";
  if (phase === "between_rounds") return "Between rounds";
  if (phase === "finished") return "Finished";
  return "In progress";
}

function FixtureRow({
  tournament,
  fixture,
  active,
}: {
  tournament: TournamentState;
  fixture: TournamentFixture;
  active: boolean;
}) {
  const home = getEntrant(tournament, fixture.homeEntrantId)?.displayName ?? "TBD";
  const away = getEntrant(tournament, fixture.awayEntrantId)?.displayName ?? "TBD";
  const done = fixture.status === "finished";
  const live = fixture.status === "live";

  return (
    <li
      className={`border px-2 py-1.5 text-xs ${
        active
          ? "border-broadcast-highlight bg-broadcast-highlight/10"
          : "border-broadcast-border/60"
      } ${fixture.winnerEntrantId && done ? "opacity-90" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          {fixture.roundName}
          {live ? " · LIVE" : ""}
        </span>
        <span className="text-[10px] text-slate-500">{fixture.status}</span>
      </div>
      <p className="mt-1 font-medium">
        <span className={fixture.winnerEntrantId === fixture.homeEntrantId ? "text-broadcast-highlight" : ""}>
          {home}
        </span>
        {done && fixture.homeScore != null ? (
          <span className="mx-1 font-mono">
            {fixture.homeScore}-{fixture.awayScore}
            {fixture.pensHome != null ? ` (${fixture.pensHome}-${fixture.pensAway}p)` : ""}
          </span>
        ) : (
          <span className="mx-1 text-slate-500">vs</span>
        )}
        <span className={fixture.winnerEntrantId === fixture.awayEntrantId ? "text-broadcast-highlight" : ""}>
          {away}
        </span>
      </p>
      {!done && !fixture.homeEntrantId && !fixture.awayEntrantId ? (
        <p className="text-[10px] text-slate-500">{fixtureLabel(tournament, fixture)}</p>
      ) : null}
    </li>
  );
}

export function TournamentBracketView({ tournament, compact, graphicOnly, offline }: TournamentBracketViewProps) {
  const active = getActiveFixture(tournament);
  const rounds = [...new Set(tournament.fixtures.map((f) => f.round))].sort((a, b) => a - b);
  const champion = tournament.championId
    ? getEntrant(tournament, tournament.championId)?.displayName
    : null;
  const isKnockout = tournament.format === "cup4" || tournament.format === "cup8";

  if (graphicOnly && isKnockout) {
    return <TournamentKnockoutBracket tournament={tournament} compact={compact} />;
  }

  return (
    <div className={`space-y-3 ${compact ? "text-xs" : ""}`}>
      {!graphicOnly ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="broadcast-label">{tournamentFormatLabel(tournament.format)}</span>
          <span className="text-slate-500">· {phaseLabel(tournament.phase)}</span>
          <span className="text-slate-500">
            · Pens: {tournament.penaltyMode === "sim" ? "Simulated" : "Interactive"}
          </span>
        </div>
      ) : null}

      {tournament.drawRevealed ? (
        <div>
          {!graphicOnly ? (
            <p className="broadcast-label mb-1 text-[10px]">Draw order</p>
          ) : null}
          <p className={`text-slate-300 ${compact ? "text-[10px]" : "text-xs"}`}>
            {tournament.drawOrder
              .map(
                (slot) =>
                  tournament.entrants.find((e) => e.slot === slot)?.displayName ??
                  `Slot ${slot + 1}`
              )
              .join(" → ")}
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          {offline
            ? "Setting up bracket…"
            : "Draw not run yet — bracket appears after the host runs the draw."}
        </p>
      )}

      {isKnockout && tournament.drawRevealed && tournament.fixtures.length ? (
        <div>
          <p className="broadcast-label mb-2 text-[10px]">Bracket</p>
          <TournamentKnockoutBracket tournament={tournament} compact={compact} offline={offline} />
        </div>
      ) : null}

      {tournament.format === "round_robin" && tournament.drawRevealed && tournament.fixtures.length ? (
        <div>
          <p className="broadcast-label mb-2 text-[10px]">Fixtures</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {tournament.fixtures.map((fixture) => (
              <MatchCard
                key={fixture.id}
                tournament={tournament}
                fixture={fixture}
                active={active?.id === fixture.id}
                compact={compact}
              />
            ))}
          </div>
        </div>
      ) : null}

      {tournament.format === "round_robin" && tournament.table.length ? (
        <div>
          <p className="broadcast-label mb-1 text-[10px]">Table</p>
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="text-slate-500">
                <th className="py-0.5">Team</th>
                <th className="py-0.5">P</th>
                <th className="py-0.5">Pts</th>
                <th className="py-0.5">GD</th>
              </tr>
            </thead>
            <tbody>
              {sortedRoundRobinTable(tournament).map((row) => (
                <tr key={row.entrantId} className="border-t border-broadcast-border/40">
                  <td className="py-0.5">
                    {getEntrant(tournament, row.entrantId)?.displayName ?? "?"}
                  </td>
                  <td>{row.played}</td>
                  <td>{row.points}</td>
                  <td>{row.goalsFor - row.goalsAgainst}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!graphicOnly && !isKnockout && tournament.fixtures.length ? (
        <div className="space-y-3">
          {rounds.map((round) => (
            <div key={round}>
              <p className="broadcast-label mb-1 text-[10px]">
                {tournament.fixtures.find((f) => f.round === round)?.roundName ?? `Round ${round}`}
              </p>
              <ul className="space-y-1">
                {tournament.fixtures
                  .filter((f) => f.round === round)
                  .map((f) => (
                    <FixtureRow
                      key={f.id}
                      tournament={tournament}
                      fixture={f}
                      active={active?.id === f.id}
                    />
                  ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {champion ? (
        <p className="border border-broadcast-highlight/50 bg-broadcast-highlight/10 px-2 py-1.5 text-sm font-semibold text-broadcast-highlight">
          Champion: {champion}
        </p>
      ) : null}
    </div>
  );
}
