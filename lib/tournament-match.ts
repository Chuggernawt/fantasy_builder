import type { MatchState } from "./types";
import type { TournamentState } from "./tournament-types";
import { getEntrant } from "./tournament";

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

  if (homeScore !== awayScore) {
    return {
      homeScore,
      awayScore,
      winnerEntrantId:
        homeScore > awayScore ? fixture.homeEntrantId : fixture.awayEntrantId,
    };
  }

  // Draw after full match — check interactive set piece result or sim
  const sp = matchState.interactiveSetPiece;
  if (sp?.kind === "penalty" && sp.goalScored != null) {
    const homeWon = sp.attacking === "home" ? sp.goalScored : !sp.goalScored;
    return {
      homeScore,
      awayScore,
      pensHome: homeWon ? 1 : 0,
      pensAway: homeWon ? 0 : 1,
      winnerEntrantId: homeWon ? fixture.homeEntrantId : fixture.awayEntrantId,
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

  // Interactive pens expected but not resolved — default home shootout sim
  const ph = 4;
  const pa = 3;
  return {
    homeScore,
    awayScore,
    pensHome: ph,
    pensAway: pa,
    winnerEntrantId: fixture.homeEntrantId,
  };
}

export function tournamentEntrantName(t: TournamentState, entrantId: string): string {
  return getEntrant(t, entrantId)?.displayName ?? "TBD";
}
