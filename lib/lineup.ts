import { getFormation } from "./formations";
import { getUniverse } from "./squads";
import { MATCH_BENCH_SIZE } from "./constants";
import type { FormationId, LineupSlot, Role } from "./types";

export function emptyLineupForFormation(formationId: FormationId): LineupSlot[] {
  return getFormation(formationId).slots.map((s) => ({
    slotId: s.id,
    role: s.role,
    playerName: null,
  }));
}

/** Keep assigned players when switching formation — match by slot id, then role. Never auto-fills gaps. */
export function remapLineupOnFormationChange(
  current: LineupSlot[],
  newFormationId: FormationId
): LineupSlot[] {
  const formation = getFormation(newFormationId);
  const pool = current
    .filter((s) => s.playerName)
    .map((s) => ({ role: s.role, name: s.playerName! }));

  const used = new Set<string>();
  const bySlotId = new Map(current.filter((s) => s.playerName).map((s) => [s.slotId, s.playerName!]));

  const result: LineupSlot[] = formation.slots.map((slot) => {
    const fromSameSlot = bySlotId.get(slot.id);
    if (fromSameSlot && !used.has(fromSameSlot)) {
      used.add(fromSameSlot);
      return { slotId: slot.id, role: slot.role, playerName: fromSameSlot };
    }
    return { slotId: slot.id, role: slot.role, playerName: null };
  });

  for (const slot of result) {
    if (slot.playerName) continue;
    const idx = pool.findIndex((p) => p.role === slot.role && !used.has(p.name));
    if (idx >= 0) {
      slot.playerName = pool[idx].name;
      used.add(pool[idx].name);
    }
  }

  return result;
}

export function countAssigned(lineup: LineupSlot[]): number {
  return lineup.filter((s) => s.playerName).length;
}

export function assignedAverageOvr(
  lineup: LineupSlot[],
  getOvr: (name: string) => number | undefined
): number | null {
  const ovrs = lineup
    .map((s) => (s.playerName ? getOvr(s.playerName) : undefined))
    .filter((v): v is number => v !== undefined);
  if (!ovrs.length) return null;
  return Math.round((ovrs.reduce((a, b) => a + b, 0) / ovrs.length) * 10) / 10;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Weighted random pick — higher weight = more likely, never deterministic. */
export function weightedPick<T>(items: T[], weight: (item: T) => number): T | null {
  if (!items.length) return null;
  const weights = items.map((item) => Math.max(0.5, weight(item)));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * CPU XI: random slot assignment (no role-fit), solid GK bias, slight lean to better players.
 * Does not reveal optimal positions to the human player scouting the opponent.
 */
export function cpuRandomLineup(
  universeId: string,
  formationId: FormationId
): LineupSlot[] {
  const universe = getUniverse(universeId);
  if (!universe) return emptyLineupForFormation(formationId);

  const formation = getFormation(formationId);
  const used = new Set<string>();

  let gkName: string | null = null;
  const gkCandidates = [...universe.players]
    .sort((a, b) => b.stats.gk - a.stats.gk)
    .slice(0, 6);
  const gkPick = weightedPick(gkCandidates, (p) => p.stats.gk);
  if (gkPick) {
    gkName = gkPick.name;
    used.add(gkPick.name);
  }

  const remaining = universe.players.filter((p) => !used.has(p.name));

  return formation.slots.map((slot) => {
    if (slot.role === "GK") {
      return { slotId: slot.id, role: slot.role, playerName: gkName };
    }
    const pool = remaining.filter((p) => !used.has(p.name));
    const pick = weightedPick(pool, (p) => p.ovr * (0.85 + Math.random() * 0.3));
    if (pick) used.add(pick.name);
    return { slotId: slot.id, role: slot.role, playerName: pick?.name ?? null };
  });
}

/** Randomly assign 11 players from the squad to formation slots (no role/OVR optimization). */
export function randomFillLineup(
  universeId: string,
  formationId: FormationId
): LineupSlot[] {
  const universe = getUniverse(universeId);
  if (!universe) return emptyLineupForFormation(formationId);

  const formation = getFormation(formationId);
  const picked = shuffle([...universe.players]).slice(0, formation.slots.length);

  return formation.slots.map((slot, i) => ({
    slotId: slot.id,
    role: slot.role,
    playerName: picked[i]?.name ?? null,
  }));
}

/** Fill only empty XI slots with random unused players. */
export function fillLineupRestRandom(
  lineup: LineupSlot[],
  universeId: string
): LineupSlot[] {
  const universe = getUniverse(universeId);
  if (!universe) return lineup;

  const taken = new Set(lineup.map((s) => s.playerName).filter(Boolean));
  const pool = shuffle(universe.players.filter((p) => !taken.has(p.name)));
  let idx = 0;

  return lineup.map((slot) => {
    if (slot.playerName) return slot;
    const pick = pool[idx++];
    return { ...slot, playerName: pick?.name ?? null };
  });
}

/** Pick random reserves from players not in the starting XI. */
export function pickRandomBench(
  universeId: string,
  lineup: LineupSlot[],
  count = MATCH_BENCH_SIZE
): string[] {
  const universe = getUniverse(universeId);
  if (!universe) return [];
  const onPitch = new Set(lineup.map((l) => l.playerName).filter(Boolean));
  const pool = universe.players.filter((p) => !onPitch.has(p.name));
  return shuffle(pool)
    .slice(0, count)
    .map((p) => p.name);
}

export function isMatchReady(lineup: LineupSlot[], bench: string[]): boolean {
  return countAssigned(lineup) === 11 && bench.length === MATCH_BENCH_SIZE;
}

