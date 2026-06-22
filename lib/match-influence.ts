import type { Role, TeamTactics } from "./types";
import type { Channel } from "./formation-zones";
import type { UniverseTrait } from "./universe-traits";
import { extraTimeMultipliers } from "./stoppage-time";
import type { ExtraTimeApproach } from "./types";
import { tacticsActive } from "./tactics";

export { tacticsActive, canPickTacticsInMatch } from "./tactics";

export function captainActiveForHalf(captainHalf: number, currentHalf: 1 | 2): boolean {
  return captainHalf === currentHalf;
}

export function pickAttackChannelForTactics(
  basePick: () => Channel,
  tactics: TeamTactics | null
): Channel {
  if (!tactics) return basePick();

  const { chanceCreation } = tactics;
  const roll = Math.random();

  switch (chanceCreation) {
    case "left_overload":
      if (roll < 0.58) return "left";
      if (roll < 0.78) return "center";
      return "right";
    case "right_overload":
      if (roll < 0.58) return "right";
      if (roll < 0.78) return "center";
      return "left";
    case "central":
      if (roll < 0.55) return "center";
      return roll < 0.775 ? "left" : "right";
    case "wide_cross":
      if (roll < 0.45) return roll < 0.225 ? "left" : "right";
      if (roll < 0.7) return roll < 0.575 ? "left" : "right";
      return "center";
    case "mixed":
    default:
      return basePick();
  }
}

export function applyBuildUpMod(
  buildUp: TeamTactics["buildUp"],
  atkBuild: number,
  defBuild: number
): { atkBuild: number; defBuild: number } {
  switch (buildUp) {
    case "short":
      return { atkBuild: atkBuild + 3, defBuild };
    case "patient":
      return { atkBuild: atkBuild + 2, defBuild: defBuild + 1 };
    case "direct":
      return { atkBuild: atkBuild + 4, defBuild };
    case "counter":
      return { atkBuild: atkBuild + 3, defBuild: defBuild - 1 };
    case "balanced":
    default:
      return { atkBuild, defBuild };
  }
}

export function applyAttackingShapeMod(
  shape: TeamTactics["defensiveShape"],
  atkBuild: number,
  defBuild: number
): { atkBuild: number; defBuild: number } {
  switch (shape) {
    case "high_press":
      return { atkBuild: atkBuild + 3, defBuild: defBuild - 2 };
    case "low_block":
      return { atkBuild: atkBuild - 2, defBuild };
    case "man_oriented":
      return { atkBuild: atkBuild + 1, defBuild: defBuild - 1 };
    case "zonal_compact":
      return { atkBuild: atkBuild - 1, defBuild };
    case "mid_block":
    default:
      return { atkBuild, defBuild };
  }
}

export function applyDefensiveShapeMod(
  shape: TeamTactics["defensiveShape"],
  channel: Channel,
  atkBuild: number,
  defBuild: number
): { atkBuild: number; defBuild: number } {
  switch (shape) {
    case "high_press":
      return { atkBuild, defBuild: defBuild + 2 };
    case "low_block":
      return { atkBuild: atkBuild - 2, defBuild: defBuild + 5 };
    case "man_oriented":
      return { atkBuild, defBuild: defBuild + 3 };
    case "zonal_compact":
      return {
        atkBuild: channel === "center" ? atkBuild - 1 : atkBuild + 1,
        defBuild: channel === "center" ? defBuild + 4 : defBuild - 1,
      };
    case "mid_block":
    default:
      return { atkBuild, defBuild };
  }
}

export function buildUpTurnoverMod(buildUp: TeamTactics["buildUp"]): number {
  switch (buildUp) {
    case "patient":
      return -0.012;
    case "direct":
    case "counter":
      return 0.01;
    case "short":
      return -0.006;
    default:
      return 0;
  }
}

export function pressTurnoverMod(shape: TeamTactics["defensiveShape"], defending: boolean): number {
  if (!defending) return 0;
  if (shape === "high_press") return 0.018;
  if (shape === "low_block") return -0.012;
  return 0;
}

export function defensiveShapeFoulMod(shape: TeamTactics["defensiveShape"]): number {
  if (shape === "man_oriented") return 0.025;
  if (shape === "high_press") return 0.01;
  return 0;
}

export function roleTacticRatingBonus(
  role: Role,
  channel: Channel,
  tactics: TeamTactics | null
): number {
  if (!tactics) return 0;
  let bonus = 0;

  switch (tactics.buildUp) {
    case "short":
    case "patient":
      if (role === "CM" || role === "AM" || role === "DM") bonus += 2;
      break;
    case "direct":
    case "counter":
      if (role === "ST" || role === "W") bonus += 2;
      if (role === "FB" && tactics.buildUp === "direct") bonus += 1;
      break;
    default:
      break;
  }

  switch (tactics.chanceCreation) {
    case "left_overload":
      if (channel === "left" && (role === "W" || role === "FB" || role === "ST")) bonus += 2;
      break;
    case "right_overload":
      if (channel === "right" && (role === "W" || role === "FB" || role === "ST")) bonus += 2;
      break;
    case "central":
      if (channel === "center" && (role === "AM" || role === "ST" || role === "CM")) bonus += 2;
      break;
    case "wide_cross":
      if (channel !== "center" && (role === "W" || role === "FB")) bonus += 2;
      if (channel !== "center" && role === "ST") bonus += 1;
      break;
    default:
      break;
  }

  return bonus;
}

export function defensiveRoleTacticBonus(
  role: Role,
  channel: Channel,
  tactics: TeamTactics | null
): number {
  if (!tactics) return 0;
  let bonus = 0;

  switch (tactics.defensiveShape) {
    case "man_oriented":
      if (role === "CB" || role === "FB" || role === "DM") bonus += 2;
      break;
    case "zonal_compact":
      if (channel === "center" && (role === "CB" || role === "DM")) bonus += 2;
      if (channel !== "center" && role === "FB") bonus -= 1;
      break;
    case "low_block":
      if (role === "CB" || role === "DM") bonus += 1;
      break;
    case "high_press":
      if (role === "FB" || role === "DM") bonus += 1;
      break;
    default:
      break;
  }

  return bonus;
}

export function applyChanceCreationXgMod(
  tactics: TeamTactics | null,
  channel: Channel,
  xg: number
): number {
  if (!tactics) return xg;
  let result = xg;

  switch (tactics.chanceCreation) {
    case "central":
      if (channel === "center") result += 0.04;
      else result -= 0.01;
      break;
    case "left_overload":
      if (channel === "left") result += 0.035;
      else if (channel === "right") result -= 0.015;
      break;
    case "right_overload":
      if (channel === "right") result += 0.035;
      else if (channel === "left") result -= 0.015;
      break;
    case "wide_cross":
      if (channel !== "center") result += 0.03;
      else result -= 0.02;
      break;
    default:
      break;
  }

  if (tactics.buildUp === "direct" && channel !== "center") result += 0.015;
  if (tactics.buildUp === "counter") result += 0.01;

  return Math.max(0.04, Math.min(0.38, result));
}

export function applyTraitToXg(trait: UniverseTrait, xg: number, isSetPiece: boolean): number {
  let result = xg + (trait.shotXg ?? 0);
  if (isSetPiece) result += trait.setPieceXg ?? 0;
  return Math.max(0.04, Math.min(0.38, result));
}

export function applyTraitFoulBias(trait: UniverseTrait, baseProb: number): number {
  return Math.max(0.02, Math.min(0.35, baseProb + (trait.foulBias ?? 0)));
}

export function captainDuelBonus(
  captain: string | null,
  captainHalf: number,
  half: 1 | 2,
  captainBoostTicks: number,
  playerName: string
): number {
  if (!captain || captain !== playerName) return 0;
  if (!captainActiveForHalf(captainHalf, half)) return 0;
  if (captainBoostTicks <= 0) return 0;
  return 6;
}

export function captainXgBonus(
  captain: string | null,
  captainHalf: number,
  half: 1 | 2,
  captainBoostTicks: number,
  playerName: string
): number {
  if (!captain || captain !== playerName) return 0;
  if (!captainActiveForHalf(captainHalf, half)) return 0;
  if (captainBoostTicks <= 0) return 0;
  return 0.05;
}

export function applyExtraTimeBuildMod(
  attacking: "home" | "away",
  homeApproach: ExtraTimeApproach | null,
  awayApproach: ExtraTimeApproach | null,
  atkBuild: number,
  defBuild: number
): { atkBuild: number; defBuild: number } {
  const atkApproach = attacking === "home" ? homeApproach : awayApproach;
  const defApproach = attacking === "home" ? awayApproach : homeApproach;
  const atkMod = extraTimeMultipliers(atkApproach);
  const defMod = extraTimeMultipliers(defApproach);
  return {
    atkBuild: atkBuild * atkMod.atk,
    defBuild: defBuild * defMod.def,
  };
}

export function applyExtraTimeXgMod(
  attacking: "home" | "away",
  homeApproach: ExtraTimeApproach | null,
  awayApproach: ExtraTimeApproach | null,
  xg: number
): number {
  const atkApproach = attacking === "home" ? homeApproach : awayApproach;
  const atkMod = extraTimeMultipliers(atkApproach);
  return Math.max(0.04, Math.min(0.55, xg * atkMod.atk));
}

export function tacticActiveForHalf(tacticHalf: number, currentHalf: 1 | 2): boolean {
  return tacticsActive(tacticHalf, currentHalf, true);
}
