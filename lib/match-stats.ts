import type { MatchState, MatchSummary } from "./types";
import { emptyTeamStats } from "./types";
import { getUniverse } from "./squads";

export function buildMatchSummary(state: MatchState): MatchSummary | null {
  const home = getUniverse(state.homeUniverseId);
  const away = getUniverse(state.awayUniverseId);
  if (!home || !away) return null;

  const hs = state.homeStats ?? emptyTeamStats();
  const as = state.awayStats ?? emptyTeamStats();

  const homeGoals: MatchSummary["homeGoals"] = [];
  const awayGoals: MatchSummary["awayGoals"] = [];

  for (const e of state.commentary) {
    if (e.type === "goal") {
      const scorer = e.playerName ?? parseGoalScorer(e.text);
      const entry = {
        scorer,
        assist: e.assistPlayerName ?? null,
        minute: e.minute,
      };
      if (e.team === "home") homeGoals.push(entry);
      else if (e.team === "away") awayGoals.push(entry);
    }
  }

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
    commentary: state.commentary,
  };
}

function parseGoalScorer(text: string): string {
  const patterns = [
    /GOAL!\s*(.+?)\s+finds the net/i,
    /GOAL!\s*(.+?)\s+buries it/i,
    /GOAL!\s*What a finish from\s+(.+?)!/i,
    /GOAL!\s*(.+?)\s+scores/i,
    /GOAL!\s*(.+?)\s+tucks it away/i,
    /GOAL!\s*Back of the net!\s*(.+?)\s+with the finish/i,
    /GOAL!\s*(.+?)\s+makes no mistake/i,
    /GOAL!\s*Sensational strike by\s+(.+?)!/i,
    /GOAL!\s*(.+?)\s+thumps it home/i,
    /GOAL!\s*Clinical from\s+(.+?)!/i,
    /GOAL!\s*(.+?)\s+— take a bow/i,
    /GOAL!\s*Top bins!\s*(.+?)\s+with a screamer/i,
    /GOAL!\s*(.+?)\s+slots it past the keeper/i,
    /GOAL!\s*.+?\.\.\.\s*(.+?)\s+scores/i,
    /—\s*(.+?)\s+finds the net/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "Unknown";
}

export { getBenchPlayerNames } from "./match-stats-bench";
