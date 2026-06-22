import { getAllUniverses, getPlayer, getUniverse } from "./squads";
import { isSquadUnlocked } from "./squad-unlocks";
import type { Player } from "./types";
import type { SeasonRosterEntry, SeasonState } from "./season-types";

export const SEASON_ROSTER_SIZE = 22;
export const SEASON_LEAGUE_SIZE = 20;

export function eligibleSeasonUniverseIds(unlockedSquads: string[]): string[] {
  return getAllUniverses()
    .map((u) => u.id)
    .filter((id) => isSquadUnlocked(id, unlockedSquads));
}

export function pickSeasonLeagueIds(userUniverseId: string, unlockedSquads: string[]): string[] {
  let eligible = eligibleSeasonUniverseIds(unlockedSquads);
  if (!eligible.includes(userUniverseId)) {
    eligible = [...eligible, userUniverseId];
  }
  if (eligible.length <= SEASON_LEAGUE_SIZE) {
    const others = eligible.filter((id) => id !== userUniverseId);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    return [userUniverseId, ...others];
  }
  const others = eligible.filter((id) => id !== userUniverseId);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  return [userUniverseId, ...others.slice(0, SEASON_LEAGUE_SIZE - 1)];
}

export function initSeasonRosters(universeIds: string[]): Record<string, SeasonRosterEntry[]> {
  const rosters: Record<string, SeasonRosterEntry[]> = {};
  for (const teamId of universeIds) {
    const uni = getUniverse(teamId);
    rosters[teamId] = (uni?.players ?? []).slice(0, SEASON_ROSTER_SIZE).map((p) => ({
      universeId: teamId,
      playerName: p.name,
    }));
  }
  return rosters;
}

export function ensureSeasonRosters(season: SeasonState): SeasonState {
  const ids =
    season.leagueUniverseIds ??
    (season.rosters ? Object.keys(season.rosters) : pickSeasonLeagueIds(season.userUniverseId, []));

  if (season.rosters && Object.keys(season.rosters).length >= ids.length) {
    return season;
  }

  const base = initSeasonRosters(ids);
  const merged: Record<string, SeasonRosterEntry[]> = { ...base };
  if (season.rosters) {
    for (const [teamId, roster] of Object.entries(season.rosters)) {
      if (roster?.length === SEASON_ROSTER_SIZE) {
        merged[teamId] = roster;
      }
    }
  }

  return {
    ...season,
    leagueUniverseIds: ids,
    rosters: merged,
    transfersThisWindow: season.transfersThisWindow ?? 0,
    transferHistory: season.transferHistory ?? [],
  };
}

export function getSeasonTeamRoster(
  season: SeasonState,
  teamUniverseId: string
): SeasonRosterEntry[] {
  const ensured = ensureSeasonRosters(season);
  return ensured.rosters?.[teamUniverseId] ?? [];
}

export function rosterEntryKey(entry: SeasonRosterEntry): string {
  return `${entry.universeId}::${entry.playerName}`;
}

export function rosterToOriginMap(entries: SeasonRosterEntry[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of entries) {
    map[e.playerName] = e.universeId;
  }
  return map;
}

export function resolveRosterPlayer(entry: SeasonRosterEntry): Player | undefined {
  return getPlayer(entry.universeId, entry.playerName);
}

export interface RosterPlayerView extends Player {
  originUniverseId: string;
}

export function rosterEntriesToPlayers(entries: SeasonRosterEntry[]): RosterPlayerView[] {
  const out: RosterPlayerView[] = [];
  for (const e of entries) {
    const p = resolveRosterPlayer(e);
    if (p) out.push({ ...p, originUniverseId: e.universeId });
  }
  return out;
}

export function rosterAverageOvr(entries: SeasonRosterEntry[]): number {
  const players = rosterEntriesToPlayers(entries);
  if (!players.length) return 50;
  return players.reduce((s, p) => s + p.ovr, 0) / players.length;
}
