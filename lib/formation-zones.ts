import type { FormationId } from "./types";

export type Zone = "def" | "mid" | "att";
export type Channel = "left" | "center" | "right";

/** Zone strength modifier added to duel ratings (not a hard buff). */
export const FORMATION_ZONE_MOD: Record<FormationId, Record<Zone, number>> = {
  "4-4-2": { def: 0, mid: 2, att: 0 },
  "4-3-3": { def: -2, mid: 0, att: 6 },
  "4-2-3-1": { def: 2, mid: 4, att: 2 },
  "3-5-2": { def: -2, mid: 8, att: 0 },
  "5-3-2": { def: 10, mid: 2, att: -8 },
};

export function slotChannel(slotId: string): Channel {
  if (slotId === "st1") return "left";
  if (slotId === "st2") return "right";
  if (["fb1", "w1", "am1", "cb1"].includes(slotId)) return "left";
  if (["fb2", "w2", "am3", "cb2"].includes(slotId)) return "right";
  return "center";
}

export function slotZone(role: string): Zone {
  if (role === "GK" || role === "CB" || role === "FB") return "def";
  if (role === "DM" || role === "CM") return "mid";
  return "att";
}

export function pickAttackChannel(formationId: FormationId): Channel {
  const mod = FORMATION_ZONE_MOD[formationId];
  let left = 0.28;
  let right = 0.28;
  let center = 0.44;
  if (mod.att > 0) {
    left += 0.04;
    right += 0.04;
    center -= 0.08;
  }
  if (mod.mid > 5) center += 0.06;
  const r = Math.random();
  if (r < left) return "left";
  if (r < left + center) return "center";
  return "right";
}
