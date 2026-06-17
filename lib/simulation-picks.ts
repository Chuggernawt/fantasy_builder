import type { Role } from "./types";

export interface PickablePlayer {
  name: string;
  role: Role;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Weighted picker for headers / corners — CBs score far more often. */
export function pickHeaderThreat(lineup: PickablePlayer[]): PickablePlayer {
  const weights: Partial<Record<Role, number>> = {
    CB: 5,
    ST: 3,
    FB: 2,
    W: 2,
    CM: 1,
    AM: 1,
    DM: 1,
  };
  const pool: PickablePlayer[] = [];
  for (const p of lineup) {
    const w = weights[p.role] ?? 0;
    for (let i = 0; i < w; i++) pool.push(p);
  }
  return pool.length ? pick(pool) : pick(lineup);
}

export function pickCornerTaker(lineup: PickablePlayer[]): PickablePlayer {
  const takers = lineup.filter((p) => ["W", "FB", "CM", "AM", "DM"].includes(p.role));
  return takers.length ? pick(takers) : pick(lineup);
}
