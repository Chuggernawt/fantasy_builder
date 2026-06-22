import type { TournamentFormat } from "./tournament-types";
import type { PlayerCareerStats } from "./career-stats";
import { getAllUniverses, getUniverse } from "./squads";

/** Squads that require a tournament / season win to draft. */
export const LOCKABLE_SQUAD_IDS = [
  "nba-legends",
  "cricket-legends",
  "rugby-legends",
  "nfl-legends",
  "dinosaurs",
  "mammals",
  "reptiles-legends",
] as const;

export type LockableSquadId = (typeof LOCKABLE_SQUAD_IDS)[number];

export const TOTAL_LOCKABLE_SQUADS = LOCKABLE_SQUAD_IDS.length;

export type SquadUnlockAchievement =
  | "offline_season"
  | "offline_cup4"
  | "offline_cup8"
  | "online_cup4"
  | "online_cup8"
  | "online_round_robin";

export interface SquadUnlockDefinition {
  achievement: SquadUnlockAchievement;
  squadIds: LockableSquadId[];
  title: string;
  description: string;
}

export const SQUAD_UNLOCK_DEFINITIONS: SquadUnlockDefinition[] = [
  {
    achievement: "offline_season",
    squadIds: ["nba-legends"],
    title: "Win an offline season",
    description: "Finish top of the league in Season mode.",
  },
  {
    achievement: "offline_cup4",
    squadIds: ["cricket-legends"],
    title: "Win an offline 4-team cup",
    description: "Lift the trophy in a 4-player knockout tournament.",
  },
  {
    achievement: "offline_cup8",
    squadIds: ["rugby-legends"],
    title: "Win an offline 8-team cup",
    description: "Lift the trophy in an 8-player knockout tournament.",
  },
  {
    achievement: "online_cup4",
    squadIds: ["nfl-legends"],
    title: "Win an online 4-team cup",
    description: "Win a 4-player online tournament.",
  },
  {
    achievement: "online_cup8",
    squadIds: ["dinosaurs"],
    title: "Win an online 8-team cup",
    description: "Win an 8-player online tournament.",
  },
  {
    achievement: "online_round_robin",
    squadIds: ["mammals", "reptiles-legends"],
    title: "Win an online round robin",
    description: "Top the table in an online round-robin tournament.",
  },
];

const LOCKABLE_SET = new Set<string>(LOCKABLE_SQUAD_IDS);

export function isLockableSquadId(universeId: string): universeId is LockableSquadId {
  return LOCKABLE_SET.has(universeId);
}

export function normalizeUnlockedSquads(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && LOCKABLE_SET.has(id));
}

export function isSquadUnlocked(universeId: string, unlockedSquads: string[]): boolean {
  if (!isLockableSquadId(universeId)) return true;
  return unlockedSquads.includes(universeId);
}

export function countUnlockedLockableSquads(unlockedSquads: string[]): number {
  return LOCKABLE_SQUAD_IDS.filter((id) => unlockedSquads.includes(id)).length;
}

export function unlockRequirementForSquad(universeId: string): SquadUnlockDefinition | null {
  if (!isLockableSquadId(universeId)) return null;
  return SQUAD_UNLOCK_DEFINITIONS.find((d) => d.squadIds.includes(universeId)) ?? null;
}

export function squadDisplayName(universeId: string): string {
  return getUniverse(universeId)?.name ?? universeId;
}

export function achievementFromOfflineTournament(
  format: TournamentFormat
): SquadUnlockAchievement | null {
  if (format === "cup4") return "offline_cup4";
  if (format === "cup8") return "offline_cup8";
  return null;
}

export function achievementFromOnlineTournament(
  format: TournamentFormat
): SquadUnlockAchievement | null {
  if (format === "cup4") return "online_cup4";
  if (format === "cup8") return "online_cup8";
  if (format === "round_robin") return "online_round_robin";
  return null;
}

export function grantSquadUnlocks(
  unlockedSquads: string[],
  achievement: SquadUnlockAchievement
): { unlockedSquads: string[]; newlyUnlocked: LockableSquadId[] } {
  const def = SQUAD_UNLOCK_DEFINITIONS.find((d) => d.achievement === achievement);
  if (!def) return { unlockedSquads, newlyUnlocked: [] };

  const have = new Set(unlockedSquads);
  const newlyUnlocked: LockableSquadId[] = [];
  for (const id of def.squadIds) {
    if (!have.has(id)) {
      have.add(id);
      newlyUnlocked.push(id);
    }
  }

  if (!newlyUnlocked.length) {
    return { unlockedSquads, newlyUnlocked: [] };
  }

  return {
    unlockedSquads: [...have],
    newlyUnlocked,
  };
}

export function applySquadUnlockAchievement(
  stats: PlayerCareerStats,
  achievement: SquadUnlockAchievement
): { stats: PlayerCareerStats; newlyUnlocked: LockableSquadId[] } {
  const unlocked = normalizeUnlockedSquads(stats.unlockedSquads);
  const { unlockedSquads: next, newlyUnlocked } = grantSquadUnlocks(unlocked, achievement);
  if (!newlyUnlocked.length) {
    return { stats, newlyUnlocked: [] };
  }
  return {
    stats: { ...stats, unlockedSquads: next },
    newlyUnlocked,
  };
}

export function partitionUniversesByLock(unlockedSquads: string[]): {
  available: ReturnType<typeof getAllUniverses>;
  locked: ReturnType<typeof getAllUniverses>;
} {
  const available: ReturnType<typeof getAllUniverses> = [];
  const locked: ReturnType<typeof getAllUniverses> = [];
  for (const u of getAllUniverses()) {
    if (isLockableSquadId(u.id) && !unlockedSquads.includes(u.id)) {
      locked.push(u);
    } else {
      available.push(u);
    }
  }
  return { available, locked };
}

export function formatNewlyUnlockedMessage(squadIds: string[]): string {
  const names = squadIds.map((id) => squadDisplayName(id));
  if (names.length === 1) return `${names[0]} is now available in Universe Select.`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are now available in Universe Select.`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]} are now available in Universe Select.`;
}
