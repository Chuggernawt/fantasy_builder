import type { PlayerStats, Role, StatKey } from "./types";

const STAT_KEYS: StatKey[] = ["pace", "power", "stamina", "tackling", "passing", "gk"];

export function calculateOvr(stats: PlayerStats): number {
  return Math.round(
    (stats.pace * 0.18 +
      stats.power * 0.18 +
      stats.stamina * 0.18 +
      stats.tackling * 0.18 +
      stats.passing * 0.18 +
      stats.gk * 0.1) *
      10
  ) / 10;
}

export const ROLE_WEIGHTS: Record<Role, Partial<Record<StatKey, number>>> = {
  GK: { pace: 0.1, power: 0.15, stamina: 0.1, tackling: 0.15, passing: 0.1, gk: 0.4 },
  CB: { pace: 0.1, power: 0.25, stamina: 0.15, tackling: 0.35, passing: 0.15 },
  FB: { pace: 0.25, power: 0.15, stamina: 0.2, tackling: 0.25, passing: 0.15 },
  CM: { pace: 0.15, power: 0.15, stamina: 0.25, tackling: 0.2, passing: 0.25 },
  DM: { pace: 0.1, power: 0.2, stamina: 0.2, tackling: 0.35, passing: 0.15 },
  AM: { pace: 0.2, power: 0.15, stamina: 0.2, tackling: 0.1, passing: 0.35 },
  W: { pace: 0.35, power: 0.1, stamina: 0.2, tackling: 0.1, passing: 0.25 },
  ST: { pace: 0.3, power: 0.3, stamina: 0.2, tackling: 0.05, passing: 0.15 },
};

const ATTACK_ROLES: Role[] = ["ST", "W", "AM", "CM"];
const DEFENCE_ROLES: Role[] = ["GK", "CB", "FB", "DM", "CM"];

export function roleRating(stats: PlayerStats, role: Role, staminaMultiplier = 1): number {
  const weights = ROLE_WEIGHTS[role];
  let total = 0;
  for (const key of STAT_KEYS) {
    const w = weights[key] ?? 0;
    total += stats[key] * w * staminaMultiplier;
  }
  return total;
}

export function teamAttackRating(
  players: { stats: PlayerStats; role: Role }[],
  staminaMap: Record<string, number>,
  names: string[]
): number {
  const attackers = players.filter((p, i) => ATTACK_ROLES.includes(p.role) && names[i]);
  if (!attackers.length) return 50;
  const ratings = attackers.map((p, idx) => {
    const name = names[players.indexOf(p)];
    const mult = staminaMap[name] ?? 1;
    return roleRating(p.stats, p.role, mult);
  });
  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}

export function teamDefenceRating(
  players: { stats: PlayerStats; role: Role }[],
  staminaMap: Record<string, number>,
  names: string[]
): number {
  const defenders = players.filter((p) => DEFENCE_ROLES.includes(p.role));
  if (!defenders.length) return 50;
  let total = 0;
  let count = 0;
  players.forEach((p, i) => {
    if (!DEFENCE_ROLES.includes(p.role)) return;
    const name = names[i];
    const mult = staminaMap[name] ?? 1;
    total += roleRating(p.stats, p.role, mult);
    count++;
  });
  return total / count;
}

export function roleFitScore(stats: PlayerStats, role: Role): number {
  return Math.round(roleRating(stats, role));
}

// Re-export for any legacy imports
export { staminaMultiplier } from "./stamina";

export function getTeamOvr(players: { ovr: number }[]): number {
  if (!players.length) return 0;
  return Math.round((players.reduce((s, p) => s + p.ovr, 0) / players.length) * 10) / 10;
}

export const STAT_SHORT: Record<StatKey, string> = {
  pace: "PAC",
  power: "POW",
  stamina: "STA",
  tackling: "TCK",
  passing: "PAS",
  gk: "GK",
};

/** Top 3 weighted stats for a role — shown on pitch tokens and bench. */
export function getRoleKeyStats(role: Role): StatKey[] {
  const weights = ROLE_WEIGHTS[role];
  return (Object.entries(weights) as [StatKey, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key);
}
