import type { TacticalStyle } from "./types";
import type { Channel } from "./formation-zones";
import type { UniverseTrait } from "./universe-traits";
import { extraTimeMultipliers } from "./stoppage-time";
import type { ExtraTimeApproach } from "./types";

export function tacticActiveForHalf(tacticHalf: number, currentHalf: 1 | 2): boolean {
  return tacticHalf === currentHalf;
}

export function captainActiveForHalf(captainHalf: number, currentHalf: 1 | 2): boolean {
  return captainHalf === currentHalf;
}

export function pickAttackChannelForTactic(
  basePick: () => Channel,
  tactic: TacticalStyle | null
): Channel {
  if (tactic === "direct" && Math.random() < 0.55) {
    return Math.random() < 0.5 ? "left" : "right";
  }
  if (tactic === "through_middle" && Math.random() < 0.5) return "center";
  return basePick();
}

export function applyTacticalBuildMod(
  tactic: TacticalStyle | null,
  attacking: boolean,
  atkBuild: number,
  defBuild: number
): { atkBuild: number; defBuild: number } {
  if (!tactic) return { atkBuild, defBuild };

  switch (tactic) {
    case "press":
      return attacking
        ? { atkBuild: atkBuild + 4, defBuild: defBuild - 2 }
        : { atkBuild: atkBuild - 2, defBuild: defBuild + 3 };
    case "sit_deep":
      return attacking
        ? { atkBuild: atkBuild - 2, defBuild }
        : { atkBuild, defBuild: defBuild + 5 };
    case "direct":
      return attacking ? { atkBuild: atkBuild + 3, defBuild } : { atkBuild, defBuild };
    case "through_middle":
      return attacking ? { atkBuild: atkBuild + 5, defBuild: defBuild - 1 } : { atkBuild, defBuild };
    default:
      return { atkBuild, defBuild };
  }
}

export function applyTacticalXgMod(
  tactic: TacticalStyle | null,
  attacking: boolean,
  channel: Channel,
  xg: number
): number {
  let result = xg;
  if (!tactic || !attacking) return result;

  if (tactic === "sit_deep") result -= 0.025;
  if (tactic === "through_middle" && channel === "center") result += 0.04;
  if (tactic === "direct" && channel !== "center") result += 0.025;
  if (tactic === "press") result += 0.015;

  return Math.max(0.04, Math.min(0.55, result));
}

export function applyTraitToXg(trait: UniverseTrait, xg: number, isSetPiece: boolean): number {
  let result = xg + (trait.shotXg ?? 0);
  if (isSetPiece) result += trait.setPieceXg ?? 0;
  return Math.max(0.04, Math.min(0.55, result));
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
  return 0.07;
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

export const TACTICAL_OPTIONS: { id: TacticalStyle; label: string; hint: string }[] = [
  { id: "press", label: "High Press", hint: "Win the ball higher — more turnovers, more fatigue." },
  { id: "sit_deep", label: "Sit Deep", hint: "Compact block — harder to break down, less attack." },
  { id: "direct", label: "Direct", hint: "Bypass midfield — wide channels and long balls." },
  { id: "through_middle", label: "Through the Middle", hint: "Central overloads and corridor chances." },
];
