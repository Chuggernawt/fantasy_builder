import type { LineupSlot } from "./types";
import type { SeasonState } from "./season-types";
import { getSeasonTeamRoster } from "./season-rosters";
import type { TournamentInstanceState } from "./tournament-instance";

export const MAX_SQUAD_STAMINA = 100;
export const DEFAULT_SQUAD_STAMINA = 100;

/** End-of-match stamina at or above this → full fitness next fixture. */
export const CARRY_OVER_STAMINA_FLOOR = 20;

/** Per-player fitness carried between non-friendly fixtures (0–100). */
export type SquadStaminaMap = Record<string, number>;

/** Season: team universe id → player fitness map. */
export type SeasonSquadStamina = Record<string, Record<string, number>>;

export type StaminaBand = "fresh" | "ok" | "tired" | "exhausted";

export function staminaBand(value: number): StaminaBand {
  const v = Math.max(0, Math.min(MAX_SQUAD_STAMINA, value));
  if (v >= 75) return "fresh";
  if (v >= 55) return "ok";
  if (v >= 35) return "tired";
  return "exhausted";
}

export function staminaBandClass(band: StaminaBand): string {
  switch (band) {
    case "fresh":
      return "bg-emerald-500/85";
    case "ok":
      return "bg-lime-600/75";
    case "tired":
      return "bg-amber-500/80";
    case "exhausted":
      return "bg-red-600/85";
  }
}

/** Solid fill for legible fitness % pills. */
export function fitnessPillClass(value: number): string {
  switch (staminaBand(value)) {
    case "fresh":
      return "bg-emerald-500 text-black";
    case "ok":
      return "bg-lime-500 text-black";
    case "tired":
      return "bg-amber-400 text-black";
    case "exhausted":
      return "bg-red-500 text-white";
  }
}

export function staminaDisplayValue(value: number): string {
  return `${Math.round(Math.max(0, Math.min(MAX_SQUAD_STAMINA, value)))}%`;
}

export function initSquadStaminaForNames(names: string[]): SquadStaminaMap {
  const map: SquadStaminaMap = {};
  for (const n of names) map[n] = DEFAULT_SQUAD_STAMINA;
  return map;
}

export function getCarriedStamina(
  map: SquadStaminaMap | undefined,
  playerName: string
): number {
  return map?.[playerName] ?? DEFAULT_SQUAD_STAMINA;
}

export function matchParticipants(
  lineup: LineupSlot[],
  bench: string[]
): Set<string> {
  const names = new Set<string>();
  for (const s of lineup) {
    if (s.playerName) names.add(s.playerName);
  }
  for (const n of bench) names.add(n);
  return names;
}

/** Kick-off stamina for XI + named subs from carried squad fitness. */
export function initMatchStaminaFromSquad(
  lineup: LineupSlot[],
  bench: string[],
  squadStamina: SquadStaminaMap | undefined
): SquadStaminaMap {
  const map: SquadStaminaMap = {};
  for (const name of matchParticipants(lineup, bench)) {
    map[name] = getCarriedStamina(squadStamina, name);
  }
  return map;
}

export function ensureTeamSquadStamina(
  store: SeasonSquadStamina | undefined,
  teamUniverseId: string,
  rosterNames: string[]
): SquadStaminaMap {
  const team = { ...(store?.[teamUniverseId] ?? {}) };
  for (const name of rosterNames) {
    if (team[name] === undefined) team[name] = DEFAULT_SQUAD_STAMINA;
  }
  return team;
}

export function getSeasonTeamStamina(
  season: SeasonState,
  teamUniverseId: string
): SquadStaminaMap {
  const roster = getSeasonTeamRoster(season, teamUniverseId).map((e) => e.playerName);
  return ensureTeamSquadStamina(season.squadStamina, teamUniverseId, roster);
}

/**
 * Next-match fitness from end-of-match stamina.
 * Each point under {@link CARRY_OVER_STAMINA_FLOOR} costs 1–2 fitness (random per point).
 */
export function fitnessFromEndStamina(
  endStamina: number,
  rand: () => number = Math.random
): number {
  const end = Math.round(endStamina);
  if (end >= CARRY_OVER_STAMINA_FLOOR) return DEFAULT_SQUAD_STAMINA;
  let penalty = 0;
  for (let i = 0; i < CARRY_OVER_STAMINA_FLOOR - end; i++) {
    penalty += rand() < 0.5 ? 1 : 2;
  }
  return Math.max(0, DEFAULT_SQUAD_STAMINA - penalty);
}

/** Squad players who played → fitness from final stamina; rested → full fitness. */
export function applyCarryOverFitnessFromMatch(
  squadStamina: SquadStaminaMap,
  rosterNames: string[],
  matchStamina: SquadStaminaMap,
  participated: Set<string>
): SquadStaminaMap {
  const next = { ...squadStamina };
  for (const name of rosterNames) {
    if (!participated.has(name)) {
      next[name] = DEFAULT_SQUAD_STAMINA;
      continue;
    }
    if (matchStamina[name] !== undefined) {
      next[name] = fitnessFromEndStamina(matchStamina[name]);
    }
  }
  return next;
}

/** Abstract end-of-match stamina for CPU-vs-CPU lite sims. */
export function simulateLiteMatchStamina(
  xiNames: string[],
  benchNames: string[] = []
): SquadStaminaMap {
  const map: SquadStaminaMap = {};
  for (const name of xiNames) {
    map[name] = Math.round(10 + Math.random() * 45);
  }
  for (const name of benchNames) {
    if (!xiNames.includes(name)) map[name] = DEFAULT_SQUAD_STAMINA;
  }
  return map;
}

export function initSeasonSquadStamina(season: SeasonState): SeasonSquadStamina {
  const store: SeasonSquadStamina = {};
  const ids = season.leagueUniverseIds ?? Object.keys(season.rosters ?? {});
  for (const teamId of ids) {
    const names = getSeasonTeamRoster(season, teamId).map((e) => e.playerName);
    store[teamId] = initSquadStaminaForNames(names);
  }
  return store;
}

export function mergeSeasonStaminaAfterMatch(
  season: SeasonState,
  teamUniverseId: string,
  matchStamina: SquadStaminaMap,
  lineup: LineupSlot[],
  bench: string[]
): SeasonState {
  const roster = getSeasonTeamRoster(season, teamUniverseId).map((e) => e.playerName);
  const team = ensureTeamSquadStamina(season.squadStamina, teamUniverseId, roster);
  const participated = matchParticipants(lineup, bench);
  const updated = applyCarryOverFitnessFromMatch(team, roster, matchStamina, participated);
  return {
    ...season,
    squadStamina: {
      ...(season.squadStamina ?? {}),
      [teamUniverseId]: updated,
    },
  };
}

export function getTournamentSquadStamina(
  instance: TournamentInstanceState,
  playerNames: string[]
): SquadStaminaMap {
  const map = { ...instance.squadStamina };
  for (const name of playerNames) {
    if (map[name] === undefined) map[name] = DEFAULT_SQUAD_STAMINA;
  }
  return map;
}

export function mergeTournamentStaminaAfterMatch(
  instance: TournamentInstanceState,
  matchStamina: SquadStaminaMap,
  lineup: LineupSlot[],
  bench: string[]
): TournamentInstanceState {
  const participated = matchParticipants(lineup, bench);
  const base = { ...instance.squadStamina };
  for (const name of Object.keys(base)) {
    if (!participated.has(name)) base[name] = DEFAULT_SQUAD_STAMINA;
  }
  for (const name of participated) {
    if (matchStamina[name] !== undefined) {
      base[name] = fitnessFromEndStamina(matchStamina[name]);
    }
  }
  return { ...instance, squadStamina: base };
}

export function userTiredPlayerCount(
  squadStamina: SquadStaminaMap,
  threshold = 98
): number {
  return Object.values(squadStamina).filter((v) => v < threshold).length;
}
