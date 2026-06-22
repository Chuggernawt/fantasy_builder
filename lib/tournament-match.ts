import type { MatchState } from "./types";
import type { MpTournamentFixtureMeta } from "./multiplayer-types";
import type { PenaltyMode, TournamentState } from "./tournament-types";
import { getEntrant } from "./tournament";
import { matchDecidedWinner } from "./penalty-shootout";

/** Cup knockout decider metadata for an active tournament fixture match. */
export function resolveCupKnockoutMeta(input: {
  tournamentActiveFixtureId: string | null;
  tournament: TournamentState | null;
  mpFixture?: MpTournamentFixtureMeta | null;
}): MatchState["tournamentMeta"] | undefined {
  if (!input.tournamentActiveFixtureId) return undefined;
  const format = input.tournament?.format ?? input.mpFixture?.format;
  if (!format || format === "round_robin") return undefined;
  const penaltyMode: PenaltyMode =
    input.tournament?.penaltyMode ?? input.mpFixture?.penaltyMode ?? "interactive";
  return { cupKnockout: true, penaltyMode };
}

export function resolveTournamentWinnerFromMatch(
  t: TournamentState,
  fixtureId: string,
  matchState: MatchState
): {
  homeScore: number;
  awayScore: number;
  pensHome?: number;
  pensAway?: number;
  winnerEntrantId: string;
} | null {
  const fixture = t.fixtures.find((f) => f.id === fixtureId);
  if (!fixture) return null;
  const homeScore = matchState.score.home;
  const awayScore = matchState.score.away;

  const shootout = matchState.penaltyShootout;
  if (shootout && matchState.status === "finished") {
    const winner = matchDecidedWinner(matchState);
    if (winner === "draw") return null;
    const homeWon = winner === "home";
    return {
      homeScore,
      awayScore,
      pensHome: shootout.home,
      pensAway: shootout.away,
      winnerEntrantId: homeWon ? fixture.homeEntrantId : fixture.awayEntrantId,
    };
  }

  if (homeScore !== awayScore) {
    return {
      homeScore,
      awayScore,
      winnerEntrantId:
        homeScore > awayScore ? fixture.homeEntrantId : fixture.awayEntrantId,
    };
  }

  if (t.penaltyMode === "sim") {
    let ph = 3 + Math.floor(Math.random() * 3);
    let pa = 3 + Math.floor(Math.random() * 3);
    while (ph === pa) pa = 3 + Math.floor(Math.random() * 3);
    return {
      homeScore,
      awayScore,
      pensHome: ph,
      pensAway: pa,
      winnerEntrantId: ph > pa ? fixture.homeEntrantId : fixture.awayEntrantId,
    };
  }

  return null;
}

export function tournamentEntrantName(t: TournamentState, entrantId: string): string {
  return getEntrant(t, entrantId)?.displayName ?? "TBD";
}
