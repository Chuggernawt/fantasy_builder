import type { LineupSlot, MatchState, Role } from "./types";
import {
  finalizePlayerRatings,
  formDeltaFromRating,
  applyFormDelta,
  pickManOfTheMatch,
} from "./match-rating";
import { seedLineupPlayerStats } from "./player-match-stats";

export function lineupPlayerNames(lineup: LineupSlot[]): string[] {
  return lineup.map((s) => s.playerName).filter((n): n is string => !!n);
}

export function buildRoleMap(
  homeLineup: LineupSlot[],
  awayLineup: LineupSlot[]
): Record<string, Role> {
  const roles: Record<string, Role> = {};
  for (const s of homeLineup) {
    if (s.playerName) roles[s.playerName] = s.role;
  }
  for (const s of awayLineup) {
    if (s.playerName) roles[s.playerName] = s.role;
  }
  return roles;
}

export function buildMatchFormMap(
  homeUniverseId: string,
  awayUniverseId: string,
  homeLineup: LineupSlot[],
  awayLineup: LineupSlot[],
  storeForm: Record<string, Record<string, number>>
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of homeLineup) {
    if (s.playerName) {
      map[s.playerName] = storeForm[homeUniverseId]?.[s.playerName] ?? 0;
    }
  }
  for (const s of awayLineup) {
    if (s.playerName) {
      map[s.playerName] = storeForm[awayUniverseId]?.[s.playerName] ?? 0;
    }
  }
  return map;
}

export function finalizeMatchStateRatings(
  state: MatchState,
  homeLineup: LineupSlot[],
  awayLineup: LineupSlot[]
): MatchState {
  const roles = buildRoleMap(homeLineup, awayLineup);
  let homeStats = seedLineupPlayerStats(
    state.homePlayerStats ?? {},
    lineupPlayerNames(homeLineup)
  );
  let awayStats = seedLineupPlayerStats(
    state.awayPlayerStats ?? {},
    lineupPlayerNames(awayLineup)
  );
  homeStats = finalizePlayerRatings(homeStats, roles, state.score.home, state.score.away);
  awayStats = finalizePlayerRatings(awayStats, roles, state.score.away, state.score.home);
  const motm = pickManOfTheMatch(homeStats, awayStats, roles);

  return {
    ...state,
    homePlayerStats: homeStats,
    awayPlayerStats: awayStats,
    manOfTheMatch: motm ?? undefined,
  };
}

export function updateStoreFormFromMatch(
  storeForm: Record<string, Record<string, number>>,
  state: MatchState,
  homeLineup: LineupSlot[],
  awayLineup: LineupSlot[]
): Record<string, Record<string, number>> {
  const roles = buildRoleMap(homeLineup, awayLineup);
  const next = { ...storeForm };

  const applyTeam = (
    universeId: string,
    stats: Record<string, import("./types").PlayerMatchStats>,
    lineup: LineupSlot[]
  ) => {
    const uni = { ...(next[universeId] ?? {}) };
    for (const s of lineup) {
      if (!s.playerName) continue;
      const row = stats[s.playerName];
      if (!row?.matchRating) continue;
      const delta = formDeltaFromRating(row.matchRating);
      uni[s.playerName] = applyFormDelta(uni[s.playerName] ?? 0, delta);
    }
    next[universeId] = uni;
  };

  applyTeam(state.homeUniverseId, state.homePlayerStats ?? {}, homeLineup);
  applyTeam(state.awayUniverseId, state.awayPlayerStats ?? {}, awayLineup);
  return next;
}
