import type { MatchState, MatchSummary } from "./types";
import { emptyTeamStats } from "./types";
import { getUniverse } from "./squads";
import { extractMatchGoals, goalsForTeam } from "./match-goals";

export function buildMatchSummary(state: MatchState): MatchSummary | null {
  const home = getUniverse(state.homeUniverseId);
  const away = getUniverse(state.awayUniverseId);
  if (!home || !away) return null;

  const hs = state.homeStats ?? emptyTeamStats();
  const as = state.awayStats ?? emptyTeamStats();

  const allGoals = extractMatchGoals(state.commentary);
  const homeGoals = goalsForTeam(allGoals, "home").map((g) => ({
    scorer: g.scorer,
    assist: g.assist,
    minute: g.minute,
    isPenalty: g.isPenalty,
  }));
  const awayGoals = goalsForTeam(allGoals, "away").map((g) => ({
    scorer: g.scorer,
    assist: g.assist,
    minute: g.minute,
    isPenalty: g.isPenalty,
  }));

  const totalPoss = hs.possessionPhases + as.possessionPhases || 1;

  return {
    homeName: home.name,
    awayName: away.name,
    homeAccent: home.accentColor,
    awayAccent: away.accentColor,
    score: state.score,
    homeGoals,
    awayGoals,
    homePossessionPct: Math.round((hs.possessionPhases / totalPoss) * 100),
    awayPossessionPct: Math.round((as.possessionPhases / totalPoss) * 100),
    homeShots: hs.shots,
    awayShots: as.shots,
    homeShotsOnTarget: hs.shotsOnTarget,
    awayShotsOnTarget: as.shotsOnTarget,
    homeChances: hs.chances,
    awayChances: as.chances,
    homeSaves: hs.saves,
    awaySaves: as.saves,
    homeFouls: hs.foulsCommitted,
    awayFouls: as.foulsCommitted,
    homePlayerStats: { ...(state.homePlayerStats ?? {}) },
    awayPlayerStats: { ...(state.awayPlayerStats ?? {}) },
    manOfTheMatch: state.manOfTheMatch,
    commentary: state.commentary,
  };
}

export { getBenchPlayerNames } from "./match-stats-bench";
