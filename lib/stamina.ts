import type { Role } from "./types";

const MIN_STAMINA = 8;

/** Per-tick drain while team is in possession / attacking phase. */
const ATTACK_DRAIN: Record<Role, number> = {
  GK: 0.06,
  CB: 2.0,
  FB: 3.5,
  DM: 2.4,
  CM: 4.2,
  AM: 3.8,
  W: 4.4,
  ST: 3.9,
};

const DEFEND_DRAIN: Record<Role, number> = {
  GK: 0.1,
  CB: 1.4,
  FB: 1.65,
  DM: 1.35,
  CM: 1.75,
  AM: 1.4,
  W: 1.85,
  ST: 1.35,
};

/**
 * High stamina stat = slightly slower drain (endurance).
 * 95 stat → ×0.82, 50 stat → ×1.0
 */
function staminaStatModifier(staminaStat: number): number {
  return 1.05 - staminaStat / 220;
}

export function staminaDrainPerTick(
  role: Role,
  staminaStat: number,
  phase: "attacking" | "defending"
): number {
  const base = phase === "attacking" ? ATTACK_DRAIN[role] : DEFEND_DRAIN[role];
  return base * 0.88 * staminaStatModifier(staminaStat);
}

export function applyStaminaDrain(
  lineup: { name: string; role: Role; stats: { stamina: number } }[],
  staminaMap: Record<string, number>,
  phase: "attacking" | "defending",
  scale = 1
): void {
  for (const p of lineup) {
    if (p.name === "Unknown") continue;
    const drain = staminaDrainPerTick(p.role, p.stats.stamina, phase) * scale;
    staminaMap[p.name] = Math.max(MIN_STAMINA, (staminaMap[p.name] ?? 100) - drain);
  }
}

export function staminaMultiplier(current: number): number {
  const normalized = Math.max(MIN_STAMINA, current);
  return Math.max(0.78, 0.6 + normalized / 210);
}

export { MIN_STAMINA };
