import { getFormation } from "./formations";
import {
  emptyLineupForFormation,
  weightedPick,
} from "./lineup";
import { getPlayer, getUniverse } from "./squads";
import type { FormationId, LineupSlot, Player } from "./types";
import type { SeasonRosterEntry } from "./season-types";
import {
  rosterAverageOvr,
  rosterEntriesToPlayers,
  rosterToOriginMap,
} from "./season-rosters";
import type { LiteMatchResult, SeasonCardEvent, SeasonGoalEvent } from "./season-types";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rosterForTeam(
  teamId: string,
  rosters?: Record<string, SeasonRosterEntry[]>
): SeasonRosterEntry[] {
  if (rosters?.[teamId]?.length) return rosters[teamId];
  const uni = getUniverse(teamId);
  return (uni?.players ?? []).map((p) => ({ universeId: teamId, playerName: p.name }));
}

function defaultTeamStrength(universeId: string): number {
  return rosterAverageOvr(rosterForTeam(universeId));
}

function teamStrength(
  teamId: string,
  rosters?: Record<string, SeasonRosterEntry[]>
): number {
  if (rosters?.[teamId]?.length) return rosterAverageOvr(rosters[teamId]);
  return defaultTeamStrength(teamId);
}

function expectedGoals(
  homeId: string,
  awayId: string,
  rosters?: Record<string, SeasonRosterEntry[]>
): { home: number; away: number } {
  const h = teamStrength(homeId, rosters);
  const a = teamStrength(awayId, rosters);
  const homeExp = 0.8 + (h / (h + a)) * 2.4 + (Math.random() - 0.5) * 0.8;
  const awayExp = 0.6 + (a / (h + a)) * 2.0 + (Math.random() - 0.5) * 0.8;
  return { home: Math.max(0.2, homeExp), away: Math.max(0.2, awayExp) };
}

function poissonGoals(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

function originForName(roster: SeasonRosterEntry[], name: string, fallback: string): string {
  return roster.find((e) => e.playerName === name)?.universeId ?? fallback;
}

export function cpuRandomLineupFromRoster(
  entries: SeasonRosterEntry[],
  formationId: FormationId
): LineupSlot[] {
  const formation = getFormation(formationId);
  const players = rosterEntriesToPlayers(entries);

  if (!players.length) return emptyLineupForFormation(formationId);

  const used = new Set<string>();
  let gkName: string | null = null;
  const gkCandidates = [...players].sort((a, b) => b.stats.gk - a.stats.gk).slice(0, 6);
  const gkPick = weightedPick(gkCandidates, (p) => p.stats.gk);
  if (gkPick) {
    gkName = gkPick.name;
    used.add(gkPick.name);
  }

  return formation.slots.map((slot) => {
    if (slot.role === "GK") {
      return { slotId: slot.id, role: slot.role, playerName: gkName };
    }
    const pool = players.filter((p) => !used.has(p.name));
    const chosen = weightedPick(pool, (p) => p.ovr * (0.85 + Math.random() * 0.3));
    if (chosen) used.add(chosen.name);
    return { slotId: slot.id, role: slot.role, playerName: chosen?.name ?? null };
  });
}

export function pickRandomBenchFromRoster(
  entries: SeasonRosterEntry[],
  lineup: LineupSlot[],
  count = 5
): string[] {
  const onPitch = new Set(lineup.map((l) => l.playerName).filter(Boolean));
  const pool = entries.filter((e) => !onPitch.has(e.playerName));
  return [...pool]
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map((e) => e.playerName);
}

export function randomFillLineupFromRoster(
  entries: SeasonRosterEntry[],
  formationId: FormationId
): LineupSlot[] {
  const formation = getFormation(formationId);
  const players = rosterEntriesToPlayers(entries);
  const picked = [...players].sort(() => Math.random() - 0.5).slice(0, formation.slots.length);
  return formation.slots.map((slot, i) => ({
    slotId: slot.id,
    role: slot.role,
    playerName: picked[i]?.name ?? null,
  }));
}

export function fillLineupRestRandomFromRoster(
  lineup: LineupSlot[],
  entries: SeasonRosterEntry[]
): LineupSlot[] {
  const players = rosterEntriesToPlayers(entries);
  const taken = new Set(lineup.map((s) => s.playerName).filter(Boolean));
  const pool = [...players].filter((p) => !taken.has(p.name)).sort(() => Math.random() - 0.5);
  let idx = 0;
  return lineup.map((slot) => {
    if (slot.playerName) return slot;
    const chosen = pool[idx++];
    return { ...slot, playerName: chosen?.name ?? null };
  });
}

export function simulateLiteMatch(
  homeId: string,
  awayId: string,
  rosters?: Record<string, SeasonRosterEntry[]>
): LiteMatchResult {
  const exp = expectedGoals(homeId, awayId, rosters);
  let homeScore = poissonGoals(exp.home);
  let awayScore = poissonGoals(exp.away);

  if (homeScore === 0 && awayScore === 0 && Math.random() < 0.35) {
    if (Math.random() < 0.55) homeScore = 1;
    else awayScore = 1;
  }

  const homeRoster = rosterForTeam(homeId, rosters);
  const awayRoster = rosterForTeam(awayId, rosters);

  const homeLineup = cpuRandomLineupFromRoster(homeRoster, "4-3-3");
  const awayLineup = cpuRandomLineupFromRoster(awayRoster, "4-3-3");
  const homeXI = homeLineup.map((s) => s.playerName).filter(Boolean) as string[];
  const awayXI = awayLineup.map((s) => s.playerName).filter(Boolean) as string[];

  const goals: SeasonGoalEvent[] = [];
  const cards: SeasonCardEvent[] = [];

  for (let i = 0; i < homeScore; i++) {
    const scorer = pick(homeXI);
    const assist = Math.random() < 0.65 ? pick(homeXI.filter((n) => n !== scorer)) : null;
    goals.push({
      universeId: originForName(homeRoster, scorer, homeId),
      playerName: scorer,
      minute: 1 + Math.floor(Math.random() * 90),
      assistUniverseId: assist ? originForName(homeRoster, assist, homeId) : undefined,
      assistPlayerName: assist ?? undefined,
    });
  }
  for (let i = 0; i < awayScore; i++) {
    const scorer = pick(awayXI);
    const assist = Math.random() < 0.65 ? pick(awayXI.filter((n) => n !== scorer)) : null;
    goals.push({
      universeId: originForName(awayRoster, scorer, awayId),
      playerName: scorer,
      minute: 1 + Math.floor(Math.random() * 90),
      assistUniverseId: assist ? originForName(awayRoster, assist, awayId) : undefined,
      assistPlayerName: assist ?? undefined,
    });
  }

  const foulRolls = 2 + Math.floor(Math.random() * 5);
  for (let i = 0; i < foulRolls; i++) {
    const isHome = Math.random() < 0.5;
    const roster = isHome ? homeRoster : awayRoster;
    const xi = isHome ? homeXI : awayXI;
    if (!xi.length) continue;
    const player = pick(xi);
    cards.push({
      universeId: originForName(roster, player, isHome ? homeId : awayId),
      playerName: player,
      minute: 1 + Math.floor(Math.random() * 90),
      type: Math.random() < 0.08 ? "red" : "yellow",
    });
  }

  return { homeUniverseId: homeId, awayUniverseId: awayId, homeScore, awayScore, goals, cards };
}

export function prepareCpuOpponentForSeason(
  universeId: string,
  rosters?: Record<string, SeasonRosterEntry[]>
): {
  formationId: "4-3-3";
  lineup: ReturnType<typeof cpuRandomLineupFromRoster>;
  bench: string[];
  playerOrigins: Record<string, string>;
} {
  const formationId = "4-3-3" as const;
  const entries = rosterForTeam(universeId, rosters);
  const lineup = cpuRandomLineupFromRoster(entries, formationId);
  const bench = pickRandomBenchFromRoster(entries, lineup);
  return {
    formationId,
    lineup,
    bench,
    playerOrigins: rosterToOriginMap(entries),
  };
}

export function resolveRosterPlayer(
  teamUniverseId: string,
  playerOrigins: Record<string, string> | undefined,
  playerName: string
): Player | undefined {
  const origin = playerOrigins?.[playerName] ?? teamUniverseId;
  return getPlayer(origin, playerName);
}
