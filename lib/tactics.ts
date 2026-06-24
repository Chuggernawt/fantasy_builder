import type { FormationId, Role, TeamTactics } from "./types";
import type { Channel } from "./formation-zones";
import { FORMATION_ZONE_MOD } from "./formation-zones";

export const BUILD_UP_OPTIONS = [
  { id: "short" as const, label: "Short", hint: "Recycle through midfield — passing & control." },
  { id: "patient" as const, label: "Patient", hint: "Keep the ball, wait for the opening." },
  { id: "balanced" as const, label: "Balanced", hint: "No strong lean either way." },
  { id: "direct" as const, label: "Direct", hint: "Skip lines — pace & power forward." },
  { id: "counter" as const, label: "Counter", hint: "Punish turnovers with fast breaks." },
];

export const CHANCE_CREATION_OPTIONS = [
  { id: "left_overload" as const, label: "Left", hint: "Overload the left flank." },
  { id: "central" as const, label: "Central", hint: "Corridor play through the middle." },
  { id: "right_overload" as const, label: "Right", hint: "Overload the right flank." },
  { id: "wide_cross" as const, label: "Cross", hint: "Wide service into the box." },
  { id: "mixed" as const, label: "Mixed", hint: "Unpredictable — follow the shape." },
];

export const DEFENSIVE_SHAPE_OPTIONS = [
  { id: "high_press" as const, label: "Press", hint: "Win it high — more turnovers & risk." },
  { id: "mid_block" as const, label: "Mid Block", hint: "Standard defensive shape." },
  { id: "low_block" as const, label: "Low Block", hint: "Deep & compact — hard to break." },
  { id: "man_oriented" as const, label: "Man", hint: "Stick tight — more duels & fouls." },
  { id: "zonal_compact" as const, label: "Zonal", hint: "Protect the centre, concede wide." },
];

export function isCompleteTactics(t: Partial<TeamTactics> | null | undefined): t is TeamTactics {
  return !!(t?.buildUp && t?.chanceCreation && t?.defensiveShape);
}

export function defaultTeamTactics(): TeamTactics {
  return { buildUp: "balanced", chanceCreation: "mixed", defensiveShape: "mid_block" };
}

export function normalizeTeamTactics(raw: Partial<TeamTactics> | null | undefined): TeamTactics {
  const base = defaultTeamTactics();
  if (!raw) return base;
  return {
    buildUp: raw.buildUp ?? base.buildUp,
    chanceCreation: raw.chanceCreation ?? base.chanceCreation,
    defensiveShape: raw.defensiveShape ?? base.defensiveShape,
  };
}

export function tacticsActive(
  revisionHalf: number,
  currentHalf: 1 | 2,
  hasTactics: boolean
): boolean {
  if (!hasTactics) return false;
  if (revisionHalf === 0) return true;
  if (revisionHalf === 1) return true;
  return currentHalf === 2;
}

/** Live match bar: one pick per half (pre-match defaults do not lock either half). */
export function canPickTacticsInMatch(revisionHalf: number, currentHalf: 1 | 2): boolean {
  if (currentHalf === 1) return revisionHalf !== 1;
  return revisionHalf !== 2;
}

export function formatTacticsBrief(tactics: TeamTactics): string {
  const b = BUILD_UP_OPTIONS.find((o) => o.id === tactics.buildUp)?.label ?? tactics.buildUp;
  const c = CHANCE_CREATION_OPTIONS.find((o) => o.id === tactics.chanceCreation)?.label ?? tactics.chanceCreation;
  const d = DEFENSIVE_SHAPE_OPTIONS.find((o) => o.id === tactics.defensiveShape)?.label ?? tactics.defensiveShape;
  return `${b} · ${c} · ${d}`;
}

export function formatScoutGlance(formationLabel: string, tactics: TeamTactics | null): string {
  if (!tactics) return `${formationLabel} · Tactics pending`;
  return `${formationLabel} · ${formatTacticsBrief(tactics)}`;
}

export function formatTacticsCommentary(teamLabel: string, tactics: TeamTactics): string {
  const build = BUILD_UP_OPTIONS.find((o) => o.id === tactics.buildUp);
  const chance = CHANCE_CREATION_OPTIONS.find((o) => o.id === tactics.chanceCreation);
  const shape = DEFENSIVE_SHAPE_OPTIONS.find((o) => o.id === tactics.defensiveShape);
  return (
    `TACTICS — ${teamLabel}: ${build?.label ?? tactics.buildUp} build-up, ` +
    `${chance?.label ?? tactics.chanceCreation} chances, ` +
    `${shape?.label ?? tactics.defensiveShape} out of possession.`
  );
}

const CHANNEL_ROLES: Record<Channel, Role[]> = {
  left: ["W", "FB", "ST", "AM"],
  center: ["ST", "AM", "CM", "DM"],
  right: ["W", "FB", "ST", "AM"],
};

export function maybeTacticalPhaseCommentary(
  tactics: TeamTactics,
  channel: Channel,
  strikerName: string,
  strikerRole: Role
): string | null {
  if (Math.random() > 0.28) return null;

  const { chanceCreation, buildUp } = tactics;
  const fitsChannel = CHANNEL_ROLES[channel].includes(strikerRole);

  if (chanceCreation === "left_overload" && channel === "left" && fitsChannel) {
    return `The game plan is clear — ${strikerName} is the left-sided outlet.`;
  }
  if (chanceCreation === "right_overload" && channel === "right" && fitsChannel) {
    return `They're targeting the right, and ${strikerName} is in the right place.`;
  }
  if (chanceCreation === "central" && channel === "center" && fitsChannel) {
    return `${strikerName} is the focal point through the middle — exactly as coached.`;
  }
  if (chanceCreation === "wide_cross" && channel !== "center" && (strikerRole === "ST" || strikerRole === "W")) {
    return `Width and crosses — ${strikerName} is where the service is aimed.`;
  }
  if (buildUp === "direct" && (strikerRole === "ST" || strikerRole === "W")) {
    return `Direct play — ${strikerName} is the early target.`;
  }
  if (buildUp === "short" && (strikerRole === "AM" || strikerRole === "CM")) {
    return `Patient build-up finds ${strikerName} between the lines.`;
  }
  if (buildUp === "counter" && strikerRole === "ST") {
    return `Quick transition — ${strikerName} leads the break.`;
  }
  return null;
}

export function cpuPickTactics(formationId: FormationId): TeamTactics {
  const mod = FORMATION_ZONE_MOD[formationId];
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

  let buildUp = pick(BUILD_UP_OPTIONS).id;
  let chanceCreation = pick(CHANCE_CREATION_OPTIONS).id;
  let defensiveShape = pick(DEFENSIVE_SHAPE_OPTIONS).id;

  if (mod.def >= 8) {
    defensiveShape = Math.random() < 0.55 ? "low_block" : "zonal_compact";
    buildUp = Math.random() < 0.5 ? "counter" : "direct";
  } else if (mod.att >= 6) {
    chanceCreation = Math.random() < 0.45 ? "wide_cross" : pick(["left_overload", "right_overload"] as const);
    defensiveShape = Math.random() < 0.4 ? "high_press" : "mid_block";
  } else if (mod.mid >= 6) {
    buildUp = Math.random() < 0.5 ? "short" : "patient";
    chanceCreation = Math.random() < 0.45 ? "central" : "mixed";
  }

  return { buildUp, chanceCreation, defensiveShape };
}
