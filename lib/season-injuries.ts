import type { FormationId, LineupSlot } from "./types";
import type { SeasonRosterEntry, SeasonState } from "./season-types";
import {
  type CpuPreferredXI,
  type PersistedPlayerInjury,
  applyPersistedInjury,
  countActiveInjuries,
  filterLineupForAvailability,
  injuryKey,
  isPlayerInjuredOut,
  returnTimelineLabel,
  tickInjuries,
} from "./injuries";
import { isPlayerSuspended } from "./season";
import {
  getSeasonTeamRoster,
  rosterEntriesToPlayers,
  rosterToOriginMap,
} from "./season-rosters";
import { cpuRandomLineupFromRoster, pickRandomBenchFromRoster } from "./season-lite";
import { weightedPick } from "./lineup";

export { isPlayerInjuredOut, injuryKey, returnTimelineLabel };

export function seasonInjuries(season: SeasonState): Record<string, PersistedPlayerInjury> {
  return season.injuries ?? {};
}

export function isPlayerUnavailableForSeason(
  season: SeasonState,
  universeId: string,
  playerName: string
): boolean {
  return (
    isPlayerSuspended(season, universeId, playerName) ||
    isPlayerInjuredOut(seasonInjuries(season), universeId, playerName)
  );
}

export function unavailablePlayerNamesForTeam(
  season: SeasonState,
  teamUniverseId: string
): Set<string> {
  const names = new Set<string>();
  const roster = getSeasonTeamRoster(season, teamUniverseId);
  for (const e of roster) {
    if (isPlayerUnavailableForSeason(season, e.universeId, e.playerName)) {
      names.add(e.playerName);
    }
  }
  return names;
}

export function tickSeasonInjuries(season: SeasonState): SeasonState {
  return { ...season, injuries: tickInjuries(seasonInjuries(season)) };
}

export function applyInjuriesToSeason(
  season: SeasonState,
  entries: PersistedPlayerInjury[]
): SeasonState {
  let injuries = seasonInjuries(season);
  for (const e of entries) {
    injuries = applyPersistedInjury(injuries, e);
  }
  return { ...season, injuries };
}

export function getOrCreateCpuLineup(
  season: SeasonState,
  teamId: string,
  formationId: FormationId = "4-3-3"
): { season: SeasonState; lineup: CpuPreferredXI } {
  const existing = season.cpuLineups?.[teamId];
  if (existing) return { season, lineup: existing };

  const entries = getSeasonTeamRoster(season, teamId);
  const lineup = cpuRandomLineupFromRoster(entries, formationId);
  const bench = pickRandomBenchFromRoster(entries, lineup);
  const preferred: CpuPreferredXI = { formationId, lineup, bench };
  return {
    season: {
      ...season,
      cpuLineups: { ...(season.cpuLineups ?? {}), [teamId]: preferred },
    },
    lineup: preferred,
  };
}

export function resolveCpuMatchLineup(
  season: SeasonState,
  teamId: string
): { season: SeasonState; formationId: FormationId; lineup: LineupSlot[]; bench: string[] } {
  let next = season;
  const { season: withCpu, lineup: preferred } = getOrCreateCpuLineup(next, teamId);
  next = withCpu;

  const unavailable = unavailablePlayerNamesForTeam(next, teamId);
  const entries = getSeasonTeamRoster(next, teamId);
  const players = rosterEntriesToPlayers(entries);
  const onPitch = new Set(
    preferred.lineup.map((s) => s.playerName).filter(Boolean) as string[]
  );
  preferred.bench.forEach((n) => onPitch.add(n));

  const fillFromPool = (slot: LineupSlot): string | null => {
    const pool = players.filter(
      (p) => !unavailable.has(p.name) && !onPitch.has(p.name)
    );
    if (!pool.length) return null;
    const chosen = weightedPick(pool, (p) => p.ovr);
    if (chosen) onPitch.add(chosen.name);
    return chosen?.name ?? null;
  };

  const { lineup, bench } = filterLineupForAvailability(preferred, unavailable, fillFromPool);
  return {
    season: next,
    formationId: preferred.formationId,
    lineup,
    bench,
  };
}

export function prepareCpuOpponentFromSeason(
  season: SeasonState,
  universeId: string
): {
  season: SeasonState;
  formationId: FormationId;
  lineup: LineupSlot[];
  bench: string[];
  playerOrigins: Record<string, string>;
} {
  const resolved = resolveCpuMatchLineup(season, universeId);
  const entries = getSeasonTeamRoster(resolved.season, universeId);
  return {
    season: resolved.season,
    formationId: resolved.formationId,
    lineup: resolved.lineup,
    bench: resolved.bench,
    playerOrigins: rosterToOriginMap(entries),
  };
}

export function activeInjuryCountForUser(season: SeasonState): number {
  const roster = getSeasonTeamRoster(season, season.userUniverseId);
  let count = 0;
  for (const e of roster) {
    if (isPlayerInjuredOut(seasonInjuries(season), e.universeId, e.playerName)) count++;
  }
  return count;
}

export function userInjuredPlayers(season: SeasonState): PersistedPlayerInjury[] {
  const roster = getSeasonTeamRoster(season, season.userUniverseId);
  const injuries = seasonInjuries(season);
  const out: PersistedPlayerInjury[] = [];
  for (const e of roster) {
    const row = injuries[injuryKey(e.universeId, e.playerName)];
    if (row && row.gamesOut > 0) out.push(row);
  }
  return out.sort((a, b) => b.gamesOut - a.gamesOut);
}

export function filterAvailableRosterEntries(
  season: SeasonState,
  teamUniverseId: string
): SeasonRosterEntry[] {
  return getSeasonTeamRoster(season, teamUniverseId).filter(
    (e) => !isPlayerUnavailableForSeason(season, e.universeId, e.playerName)
  );
}

export function leagueInjuryHeadline(season: SeasonState): string | null {
  const n = countActiveInjuries(seasonInjuries(season));
  if (n === 0) return null;
  return `${n} player${n === 1 ? "" : "s"} sidelined across the league with injuries.`;
}
