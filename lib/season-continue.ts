import { buildSeasonFixtures, initSeasonTable } from "./season-fixtures";
import { getUserTablePosition, sortTable } from "./season";
import { eligibleSeasonUniverseIds, initSeasonRosters, SEASON_LEAGUE_SIZE } from "./season-rosters";
import { SEASON_RELEGATION_ZONE } from "./season-saves";
import type { SeasonState } from "./season-types";

export { SEASON_RELEGATION_ZONE };

export function isUserInRelegationZone(season: SeasonState): boolean {
  if (season.status !== "finished") return false;
  const position = getUserTablePosition(season);
  const size = season.table.length;
  return position > size - SEASON_RELEGATION_ZONE;
}

export function canContinueSeasonCampaign(season: SeasonState): boolean {
  return season.status === "finished" && !isUserInRelegationZone(season);
}

export function relegationZoneStartIndex(leagueSize: number): number {
  return Math.max(0, leagueSize - SEASON_RELEGATION_ZONE);
}

function pickReplacementTeams(
  excludeIds: string[],
  count: number,
  unlockedSquads: string[]
): string[] {
  const exclude = new Set(excludeIds);
  const pool = eligibleSeasonUniverseIds(unlockedSquads).filter((id) => !exclude.has(id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/** Start next season in the same save — rosters carry over, bottom 3 replaced. */
export function continueSeasonCampaign(
  finished: SeasonState,
  unlockedSquads: string[]
): SeasonState {
  if (!canContinueSeasonCampaign(finished)) {
    throw new Error("Cannot continue after relegation.");
  }

  const sorted = sortTable(finished.table);
  const leagueSize = sorted.length || SEASON_LEAGUE_SIZE;
  const relegateFrom = relegationZoneStartIndex(leagueSize);
  const relegatedIds = sorted.slice(relegateFrom).map((r) => r.universeId);
  const survivingIds = sorted.slice(0, relegateFrom).map((r) => r.universeId);

  const previousLeague = finished.leagueUniverseIds ?? sorted.map((r) => r.universeId);
  const replacements = pickReplacementTeams(previousLeague, SEASON_RELEGATION_ZONE, unlockedSquads);
  const newLeagueIds = [...survivingIds, ...replacements];

  const prevRosters = finished.rosters ?? initSeasonRosters(previousLeague);
  const rosters: Record<string, import("./season-types").SeasonRosterEntry[]> = {};
  for (const id of newLeagueIds) {
    rosters[id] = prevRosters[id] ?? initSeasonRosters([id])[id];
  }

  const userId = finished.userUniverseId;
  if (!newLeagueIds.includes(userId)) {
    throw new Error("User team missing from continued league.");
  }

  return {
    seasonNumber: finished.seasonNumber + 1,
    length: finished.length,
    userUniverseId: userId,
    leagueUniverseIds: newLeagueIds,
    rosters,
    fixtures: buildSeasonFixtures(newLeagueIds, userId, finished.length),
    table: initSeasonTable(newLeagueIds),
    playerStats: {},
    currentMatchday: 1,
    status: "active",
    championId: null,
    suspensions: {},
    transfersThisWindow: 0,
    transferHistory: [],
    lastRelegatedIds: relegatedIds,
    lastPromotedIds: replacements,
  };
}

export function formatRelegationAnnouncement(
  relegatedIds: string[],
  promotedIds: string[],
  getName: (id: string) => string
): string {
  const out = relegatedIds.map((id) => getName(id)).join(", ");
  const inn = promotedIds.map((id) => getName(id)).join(", ");
  return `${out} relegated · ${inn} promoted`;
}
