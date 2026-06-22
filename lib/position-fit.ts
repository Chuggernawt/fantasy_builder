import { getUniverse } from "./squads";
import { bestRoleForStats, roleFitScore } from "./stats";
import type { Player, PlayerStats, Role, TeamSetup } from "./types";

const GOOD_FIT = 68;
const POOR_FIT = 52;
const AWFUL_FIT = 42;

const ROLE_LABEL: Record<Role, string> = {
  GK: "goalkeeper",
  CB: "centre-back",
  FB: "full-back",
  DM: "defensive midfielder",
  CM: "midfielder",
  AM: "attacking midfielder",
  W: "winger",
  ST: "striker",
};

const MISFIT_COMMENTARY: Array<(player: string, role: string) => string> = [
  (p, r) => `${p} clearly looks lost as a ${r}.`,
  (p, r) => `${p} is out of position at ${r} — the shape suffers.`,
  (p, r) => `${p} doesn't look comfortable playing ${r}.`,
  (p, r) => `You can see ${p} struggling in the ${r} role.`,
  (p, r) => `${p} is being asked to do a job at ${r} that doesn't suit them.`,
  (p, r) => `${p} keeps getting caught in the wrong place as a ${r}.`,
  (p, r) => `Tactical gamble: ${p} at ${r} isn't paying off.`,
  (p, r) => `${p} looks a fish out of water at ${r}.`,
];

export function roleDisplayName(role: Role): string {
  return ROLE_LABEL[role] ?? role;
}

export function positionMisfitPenalty(
  stats: PlayerStats,
  slotRole: Role,
  naturalRole: Role
): number {
  if (slotRole === naturalRole) return 0;
  const fit = roleFitScore(stats, slotRole);
  if (fit >= GOOD_FIT) return 0;
  let penalty = 0;
  if (fit < AWFUL_FIT) penalty = -7;
  else if (fit < POOR_FIT) penalty = -4;
  else if (fit < 62) penalty = -2;
  else penalty = -1;
  if (slotRole === "GK" && fit < POOR_FIT) penalty -= 3;
  return penalty;
}

/** True when squad has a bench player who would fit this role much better. */
export function squadHasBetterFitForRole(
  setup: TeamSetup,
  slotRole: Role,
  currentPlayerName: string,
  currentFit: number
): boolean {
  const universe = getUniverse(setup.universeId);
  if (!universe) return false;
  const onPitch = new Set(
    setup.lineup.map((s) => s.playerName).filter((n): n is string => !!n)
  );
  onPitch.add(currentPlayerName);

  return universe.players.some((p) => {
    if (onPitch.has(p.name)) return false;
    return roleFitScore(p.stats, slotRole) >= currentFit + 10;
  });
}

export function shouldApplyMisfitPenalty(
  setup: TeamSetup,
  playerName: string,
  slotRole: Role,
  naturalRole: Role,
  stats: PlayerStats
): boolean {
  if (slotRole === naturalRole) return false;
  const fit = roleFitScore(stats, slotRole);
  if (fit >= GOOD_FIT) return false;
  return squadHasBetterFitForRole(setup, slotRole, playerName, fit);
}

export function pickMisfitCommentary(playerName: string, slotRole: Role): string {
  const role = roleDisplayName(slotRole);
  const line = MISFIT_COMMENTARY[Math.floor(Math.random() * MISFIT_COMMENTARY.length)];
  return line(playerName, role);
}

export interface LineupMisfit {
  playerName: string;
  slotRole: Role;
  naturalRole: Role;
  fitScore: number;
}

export function listSevereMisfits(setup: TeamSetup): LineupMisfit[] {
  const out: LineupMisfit[] = [];
  for (const slot of setup.lineup) {
    if (!slot.playerName) continue;
    const universe = getUniverse(setup.universeId);
    const player = universe?.players.find((p) => p.name === slot.playerName);
    if (!player) continue;
    const fit = roleFitScore(player.stats, slot.role);
    const naturalRole = player ? bestRoleForStats(player.stats) : slot.role;
    if (
      shouldApplyMisfitPenalty(setup, player.name, slot.role, naturalRole, player.stats) &&
      fit < POOR_FIT
    ) {
      out.push({
        playerName: player.name,
        slotRole: slot.role,
        naturalRole,
        fitScore: fit,
      });
    }
  }
  return out;
}
