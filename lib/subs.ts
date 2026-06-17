import type { LineupSlot, StatKey, TeamSetup } from "./types";
import { MAX_MATCH_SUBS } from "./constants";
import { getPlayer, getUniverse } from "./squads";
import { getBenchPlayerNames } from "./match-stats-bench";
import { ALL_STAT_KEYS } from "./reveal";
import { weightedPick } from "./lineup";
import type { Player } from "./types";

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** How many subs the CPU wants this break — independent of the human's choices. */
export function cpuChooseSubCount(
  lineup: LineupSlot[],
  stamina: Record<string, number>,
  remaining: number
): number {
  if (remaining <= 0) return 0;

  const field = lineup.filter((s) => s.playerName && s.role !== "GK");
  if (!field.length) return 0;

  const avg =
    field.reduce((sum, s) => sum + (stamina[s.playerName!] ?? 100), 0) / field.length;
  const tired = field.filter((s) => (stamina[s.playerName!] ?? 100) < 55).length;

  if (avg > 72 && tired === 0) return Math.random() < 0.12 ? 1 : 0;
  if (avg > 62) return Math.floor(Math.random() * Math.min(remaining, 2));
  if (tired >= 4) return Math.min(remaining, 1 + Math.floor(Math.random() * 3));
  if (tired >= 2) return Math.min(remaining, Math.floor(Math.random() * 3));
  return Math.min(remaining, Math.floor(Math.random() * 2));
}

/** Sub pick weight from stats the human has revealed for this player (CPU uses same info as player). */
function subPickWeight(
  player: Player,
  revealedStats?: Record<string, StatKey[]>
): number {
  const rev = revealedStats?.[player.name] ?? [];
  if (!rev.length) return 1 + Math.random() * 2;
  if (ALL_STAT_KEYS.every((k) => rev.includes(k))) return player.ovr;
  const avg = rev.reduce((sum, k) => sum + player.stats[k], 0) / rev.length;
  return avg * 0.6 + (1 + Math.random()) * 1.2;
}

export function cpuHalftimeSubs(
  setup: TeamSetup,
  stamina: Record<string, number>,
  revealedStats?: Record<string, StatKey[]>,
  subsBudget?: number
): LineupSlot[] {
  const universe = getUniverse(setup.universeId);
  if (!universe) return setup.lineup;

  const bench = getBenchPlayerNames(setup.universeId, setup.lineup, setup.bench)
    .map((name) => getPlayer(setup.universeId, name))
    .filter(Boolean) as Player[];

  const lineup = setup.lineup.map((s) => ({ ...s }));
  const remaining = subsBudget ?? MAX_MATCH_SUBS;
  const targetSubs = cpuChooseSubCount(setup.lineup, stamina, remaining);
  let subsMade = 0;

  const tiredSlots = shuffle(
    lineup
      .filter((s) => s.playerName && s.role !== "GK")
      .map((s) => ({
        slot: s,
        stamina: stamina[s.playerName!] ?? 100,
      }))
      .sort((a, b) => a.stamina - b.stamina)
  );

  for (const { slot, stamina: sta } of tiredSlots) {
    if (subsMade >= targetSubs || !bench.length) break;

    const available = bench.filter((p) => !lineup.some((l) => l.playerName === p.name));
    if (!available.length) break;

    const replacement = weightedPick(available, (p) => subPickWeight(p, revealedStats));
    if (!replacement) break;

    if (sta < 50 || subsMade < targetSubs) {
      slot.playerName = replacement.name;
      subsMade++;
    }
  }

  return lineup;
}

export { MAX_MATCH_SUBS };

export function applySubstitution(
  lineup: LineupSlot[],
  slotId: string,
  playerName: string
): LineupSlot[] | null {
  const slot = lineup.find((s) => s.slotId === slotId);
  if (!slot) return null;
  if (lineup.some((s) => s.playerName === playerName && s.slotId !== slotId)) return null;
  return lineup.map((s) =>
    s.slotId === slotId ? { ...s, playerName } : s
  );
}

export function refreshStaminaAfterLineupChange(
  oldLineup: LineupSlot[],
  newLineup: LineupSlot[],
  stamina: Record<string, number>
): Record<string, number> {
  const next = { ...stamina };
  newLineup.forEach((slot, i) => {
    const oldName = oldLineup[i]?.playerName;
    const newName = slot.playerName;
    if (oldName !== newName && newName) {
      if (oldName) delete next[oldName];
      next[newName] = 100;
    }
  });
  return next;
}
