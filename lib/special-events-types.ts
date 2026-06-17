import type {
  FormationId,
  PendingSetPiece,
  PlayerMatchStats,
  TacticalStyle,
  TeamMatchStats,
} from "./types";

export interface SimLineupPlayer {
  name: string;
  role: string;
  stats: {
    pace: number;
    power: number;
    stamina: number;
    tackling: number;
    passing: number;
    gk: number;
  };
}

export interface AttackBonus {
  team: "home" | "away";
  duel: number;
  xg: number;
  wide: boolean;
}

export interface AttackPenalty {
  team: "home" | "away";
  duel: number;
  xg: number;
}

export interface SpecialCastEntry {
  name: string;
  team: "home" | "away";
  weight: number;
}

export interface AttackContext {
  attacking: "home" | "away";
  half: 1 | 2;
  homeLineup: SimLineupPlayer[];
  awayLineup: SimLineupPlayer[];
  homeFormation: FormationId;
  awayFormation: FormationId;
  homeStamina: Record<string, number>;
  awayStamina: Record<string, number>;
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
  momentum: number;
  pendingSetPiece: PendingSetPiece | null;
  homeName: string;
  awayName: string;
  attackBonus: AttackBonus | null;
  attackPenalty: AttackPenalty | null;
  forceChance: "home" | "away" | null;
  gkMoment: "save" | "blunder" | null;
  forceTurnover: boolean;
  specialCast: SpecialCastEntry[];
  currentMinute: number;
  specialCooldown: Record<string, number>;
  phaseMentions: string[];
  playmaker: string | null;
  crosser: string | null;
  freekickTaker: string | null;
  homePlayerStats: Record<string, PlayerMatchStats>;
  awayPlayerStats: Record<string, PlayerMatchStats>;
  homeTactic: TacticalStyle | null;
  awayTactic: TacticalStyle | null;
  homeTacticHalf: number;
  awayTacticHalf: number;
  homeCaptain: string | null;
  awayCaptain: string | null;
  homeCaptainHalf: number;
  awayCaptainHalf: number;
  homeCaptainBoostTicks: number;
  awayCaptainBoostTicks: number;
  homeUniverseId: string;
  awayUniverseId: string;
  setPieceBudget: import("./types").SetPieceBudget;
  setPieceTrigger: {
    kind: "corner" | "penalty";
    attacking: "home" | "away";
    taker: string;
    keeper: string;
    cornerTaker?: string;
  } | null;
  comm: import("./commentary-types").CommentarySession;
}

