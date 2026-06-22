import type { LineupSlot, PlayerMatchStats, Role } from "./types";
import { rollChance } from "./duels";
import { getPlayer } from "./squads";
import { roleFitScore } from "./stats";
import {
  ensurePlayerStats,
  isPlayerSentOff,
  recordClearance,
  recordDribble,
  recordPass,
  recordSave,
  recordShot,
  recordTackle,
  seedLineupPlayerStats,
} from "./player-match-stats";

/**
 * Per-tick background probabilities — kept low so commentary highlights remain
 * the main driver of standout stats; background fills in the rest of the match.
 */
const ROLE_TICK: Record<
  Role,
  { pass: number; tackle: number; clearance: number; dribble: number; shot: number }
> = {
  GK: { pass: 0.09, tackle: 0, clearance: 0, dribble: 0, shot: 0 },
  CB: { pass: 0.16, tackle: 0.1, clearance: 0.06, dribble: 0.01, shot: 0.01 },
  FB: { pass: 0.18, tackle: 0.08, clearance: 0.03, dribble: 0.03, shot: 0.01 },
  DM: { pass: 0.2, tackle: 0.09, clearance: 0.03, dribble: 0.02, shot: 0.01 },
  CM: { pass: 0.22, tackle: 0.05, clearance: 0.01, dribble: 0.04, shot: 0.02 },
  AM: { pass: 0.2, tackle: 0.03, clearance: 0.01, dribble: 0.05, shot: 0.03 },
  W: { pass: 0.15, tackle: 0.02, clearance: 0.01, dribble: 0.06, shot: 0.04 },
  ST: { pass: 0.12, tackle: 0.02, clearance: 0, dribble: 0.04, shot: 0.05 },
};

function passCompletionChance(universeId: string, name: string): number {
  const player = getPlayer(universeId, name);
  const passing = player?.stats.passing ?? 55;
  return 0.58 + passing / 220;
}

function tackleWinChance(universeId: string, name: string, role: Role): number {
  const player = getPlayer(universeId, name);
  if (!player) return 0.45;
  return 0.35 + roleFitScore(player.stats, role) / 200;
}

function dribbleSuccessChance(universeId: string, name: string): number {
  const player = getPlayer(universeId, name);
  const pace = player?.stats.pace ?? 55;
  return 0.4 + pace / 200;
}

function tickOutfieldPlayer(
  name: string,
  role: Role,
  universeId: string,
  map: Record<string, PlayerMatchStats>
): void {
  ensurePlayerStats(map, name);
  const w = ROLE_TICK[role];

  if (rollChance(w.pass)) {
    recordPass(map, name, rollChance(passCompletionChance(universeId, name)));
  }
  if (w.tackle > 0 && rollChance(w.tackle)) {
    recordTackle(map, name, rollChance(tackleWinChance(universeId, name, role)));
  }
  if (w.clearance > 0 && rollChance(w.clearance)) {
    recordClearance(map, name);
  }
  if (w.dribble > 0 && rollChance(w.dribble)) {
    recordDribble(map, name, rollChance(dribbleSuccessChance(universeId, name)));
  }
  if (w.shot > 0 && rollChance(w.shot)) {
    recordShot(map, name, rollChance(0.28));
  }
}

function tickGoalkeeper(
  name: string,
  universeId: string,
  map: Record<string, PlayerMatchStats>,
  underPressure: boolean
): void {
  ensurePlayerStats(map, name);
  if (rollChance(ROLE_TICK.GK.pass)) {
    recordPass(map, name, rollChance(passCompletionChance(universeId, name)));
  }
  if (underPressure && rollChance(0.04)) {
    recordSave(map, name);
  }
}

/** Simulate off-ball work for every player on the pitch this tick. */
export function simulateBackgroundMatchTick(
  homeLineup: LineupSlot[],
  awayLineup: LineupSlot[],
  homeUniverseId: string,
  awayUniverseId: string,
  homePlayerStats: Record<string, PlayerMatchStats>,
  awayPlayerStats: Record<string, PlayerMatchStats>,
  attackingTeam: "home" | "away"
): void {
  const defendingTeam = attackingTeam === "home" ? "away" : "home";

  for (const slot of homeLineup) {
    if (!slot.playerName || isPlayerSentOff(homePlayerStats, slot.playerName)) continue;
    if (slot.role === "GK") {
      tickGoalkeeper(slot.playerName, homeUniverseId, homePlayerStats, attackingTeam === "away");
    } else {
      tickOutfieldPlayer(slot.playerName, slot.role, homeUniverseId, homePlayerStats);
    }
  }

  for (const slot of awayLineup) {
    if (!slot.playerName || isPlayerSentOff(awayPlayerStats, slot.playerName)) continue;
    if (slot.role === "GK") {
      tickGoalkeeper(slot.playerName, awayUniverseId, awayPlayerStats, attackingTeam === "home");
    } else {
      tickOutfieldPlayer(slot.playerName, slot.role, awayUniverseId, awayPlayerStats);
    }
  }

  const defLineup = defendingTeam === "home" ? homeLineup : awayLineup;
  const defUni = defendingTeam === "home" ? homeUniverseId : awayUniverseId;
  const defMap = defendingTeam === "home" ? homePlayerStats : awayPlayerStats;
  for (const slot of defLineup) {
    if (!slot.playerName || slot.role === "GK" || isPlayerSentOff(defMap, slot.playerName)) continue;
    if (slot.role === "CB" || slot.role === "FB" || slot.role === "DM") {
      if (rollChance(0.04)) {
        recordTackle(defMap, slot.playerName, rollChance(tackleWinChance(defUni, slot.playerName, slot.role)));
      }
    }
  }
}

export function seedMatchPlayerStats(
  homeLineup: LineupSlot[],
  awayLineup: LineupSlot[],
  existingHome: Record<string, PlayerMatchStats> = {},
  existingAway: Record<string, PlayerMatchStats> = {}
): {
  homePlayerStats: Record<string, PlayerMatchStats>;
  awayPlayerStats: Record<string, PlayerMatchStats>;
} {
  const homeNames = homeLineup.map((s) => s.playerName).filter((n): n is string => !!n);
  const awayNames = awayLineup.map((s) => s.playerName).filter((n): n is string => !!n);
  return {
    homePlayerStats: seedLineupPlayerStats(existingHome, homeNames),
    awayPlayerStats: seedLineupPlayerStats(existingAway, awayNames),
  };
}
