import type { ActiveMatchInjury } from "./injuries";

export type StatKey = "pace" | "power" | "stamina" | "tackling" | "passing" | "gk";

export type PlayerStats = Record<StatKey, number>;

export interface Player {
  name: string;
  stats: PlayerStats;
  ovr: number;
}

export interface Universe {
  id: string;
  name: string;
  accentColor: string;
  tagline: string;
  players: Player[];
}

export interface SquadsData {
  version: number;
  overallFormula: string;
  universes: Universe[];
}

export type Role =
  | "GK"
  | "CB"
  | "FB"
  | "CM"
  | "DM"
  | "AM"
  | "W"
  | "ST";

export type FormationId = "4-4-2" | "4-3-3" | "4-2-3-1" | "3-5-2" | "5-3-2";

export interface FormationSlot {
  id: string;
  role: Role;
  label: string;
}

export interface Formation {
  id: FormationId;
  label: string;
  slots: FormationSlot[];
}

export interface LineupSlot {
  slotId: string;
  role: Role;
  playerName: string | null;
}

export interface MatchPlayerState {
  playerName: string;
  role: Role;
  baseStats: PlayerStats;
  currentStamina: number;
  onPitch: boolean;
}

export type CommentaryType =
  | "info"
  | "chance"
  | "goal"
  | "save"
  | "miss"
  | "tackle"
  | "foul"
  | "freekick"
  | "stamina"
  | "special"
  | "halftime"
  | "fulltime"
  | "turnover"
  | "corner"
  | "cross"
  | "clearance"
  | "pressure"
  | "header"
  | "offside"
  | "yellowcard"
  | "redcard"
  | "penalty"
  | "longball"
  | "substitution"
  | "stoppage"
  | "injury";

export type BuildUpStyle = "short" | "patient" | "balanced" | "direct" | "counter";
export type ChanceCreationStyle =
  | "left_overload"
  | "central"
  | "right_overload"
  | "wide_cross"
  | "mixed";
export type DefensiveShapeStyle =
  | "high_press"
  | "mid_block"
  | "low_block"
  | "man_oriented"
  | "zonal_compact";

export interface TeamTactics {
  buildUp: BuildUpStyle;
  chanceCreation: ChanceCreationStyle;
  defensiveShape: DefensiveShapeStyle;
}

/** One-time extra-time approach (stoppage time). */
export type ExtraTimeApproach =
  | "park_bus"
  | "defend"
  | "balanced"
  | "attack"
  | "kitchen_sink";

export interface PlayerMatchStats {
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  passes: number;
  passesCompleted: number;
  shots: number;
  shotsOnTarget: number;
  dribbles: number;
  dribblesCompleted: number;
  tackles: number;
  tacklesCompleted: number;
  clearances: number;
  shotsBlocked: number;
  saves: number;
  matchRating?: number;
}

export interface TeamMatchStats {
  possessionPhases: number;
  shots: number;
  shotsOnTarget: number;
  chances: number;
  saves: number;
  foulsCommitted: number;
  freeKicksWon: number;
}

export interface PendingSetPiece {
  team: "home" | "away";
  kind: "freekick";
  xgBonus: number;
}

export interface SetPieceBudgetSide {
  attackCorner: boolean;
  defendCorner: boolean;
}

export interface SetPieceBudget {
  home: SetPieceBudgetSide;
  away: SetPieceBudgetSide;
}

export function defaultSetPieceBudget(): SetPieceBudget {
  return {
    home: { attackCorner: false, defendCorner: false },
    away: { attackCorner: false, defendCorner: false },
  };
}

export interface InteractiveSetPiece {
  kind: "corner" | "penalty";
  attacking: "home" | "away";
  phase: "choose" | "reveal";
  chooseEndsAt: string;
  revealEndsAt?: string;
  taker: string;
  keeper: string;
  cornerTaker?: string;
  attackerChoice?: number;
  defenderChoice?: number;
  attackerPick?: number;
  defenderPick?: number;
  goalScored?: boolean;
  resultText?: string;
  /** Cup knockout shootout kick — not an in-match penalty. */
  shootoutDecider?: boolean;
}

export interface PenaltyShootoutState {
  home: number;
  away: number;
  homeTaken: number;
  awayTaken: number;
  /** Side taking the current / next kick. */
  nextShooter: "home" | "away";
  /** Per-kick results in order (for the shootout graphic). */
  homeKicks?: ("goal" | "miss")[];
  awayKicks?: ("goal" | "miss")[];
}

export function emptySetPieceBudget(): SetPieceBudget {
  return defaultSetPieceBudget();
}

export function emptyTeamStats(): TeamMatchStats {
  return {
    possessionPhases: 0,
    shots: 0,
    shotsOnTarget: 0,
    chances: 0,
    saves: 0,
    foulsCommitted: 0,
    freeKicksWon: 0,
  };
}

export interface CommentaryEvent {
  id: string;
  minute: number;
  half: 1 | 2;
  type: CommentaryType;
  text: string;
  team?: "home" | "away";
  /** Primary player involved (e.g. goal scorer). */
  playerName?: string;
  /** Assist on goal events. */
  assistPlayerName?: string;
}

export type MatchStatus =
  | "idle"
  | "running"
  | "sub_window"
  | "halftime"
  | "set_piece_pause"
  | "extra_time_choice"
  | "finished";

export interface MatchScore {
  home: number;
  away: number;
}

export interface MatchState {
  status: MatchStatus;
  half: 1 | 2;
  tick: number;
  ticksPerHalf: number;
  score: MatchScore;
  homeStamina: Record<string, number>;
  awayStamina: Record<string, number>;
  commentary: CommentaryEvent[];
  homeUniverseId: string;
  awayUniverseId: string;
  homeSubsUsed: number;
  awaySubsUsed: number;
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
  homePlayerStats: Record<string, PlayerMatchStats>;
  awayPlayerStats: Record<string, PlayerMatchStats>;
  homeTactics: TeamTactics | null;
  awayTactics: TeamTactics | null;
  /** 0 = pre-match default · 1 = locked in 1st half · 2 = locked/overridden for 2nd half */
  homeTacticHalf: number;
  awayTacticHalf: number;
  homeCaptain: string | null;
  awayCaptain: string | null;
  homeCaptainHalf: number;
  awayCaptainHalf: number;
  /** Ticks remaining on home captain's boost after Captain's Call. */
  homeCaptainBoostTicks: number;
  awayCaptainBoostTicks: number;
  pendingSetPiece: PendingSetPiece | null;
  setPieceBudget: SetPieceBudget;
  interactiveSetPiece: InteractiveSetPiece | null;
  /** Cup knockout penalty shootout after a draw at full time. */
  penaltyShootout?: PenaltyShootoutState | null;
  momentum: number;
  /** Last in-game minute a player had a special event (soft anti-repeat). */
  specialCooldown: Record<string, number>;
  /** Recent commentary lines for anti-repetition (last ~14). */
  recentCommentaryLines?: string[];
  /** Season context when playing a league fixture. */
  seasonMeta?: import("./commentary-types").SeasonMatchMeta;
  /** Cup knockout decider — penalties after a draw at full time. */
  tournamentMeta?: {
    cupKnockout: boolean;
    penaltyMode: import("./tournament-types").PenaltyMode;
  };
  /** Carried form per player name for both squads (from store at kickoff). */
  playerForm?: Record<string, number>;
  /** In-match injuries — home team. */
  homeActiveInjuries?: Record<string, ActiveMatchInjury>;
  /** In-match injuries — away team. */
  awayActiveInjuries?: Record<string, ActiveMatchInjury>;
  /** Whether injuries/form apply in this match (season/tournament only). */
  persistentMatchMode?: boolean;
  /** Post-match team doctor breakdown (season/tournament). */
  injuryReports?: import("./injuries").MatchInjuryReport[];
  manOfTheMatch?: {
    playerName: string;
    team: "home" | "away";
    rating: number;
  };
  /** Weighted stoppage events accumulated during the match. */
  stoppageCount: number;
  /** Minutes of added time (set at 90'). */
  stoppageMinutes: number;
  /** 1-based tick index during added time (3 ticks = 1 minute). */
  stoppageTick: number;
  inStoppageTime: boolean;
  homeExtraTimeApproach: ExtraTimeApproach | null;
  awayExtraTimeApproach: ExtraTimeApproach | null;
  /** Offline SP: which side the human controls (frozen at kickoff). */
  localPlayerSide?: "home" | "away";
}

export interface MatchSummary {
  homeName: string;
  awayName: string;
  homeAccent: string;
  awayAccent: string;
  score: MatchScore;
  homeGoals: { scorer: string; assist: string | null; minute: number; isPenalty?: boolean }[];
  awayGoals: { scorer: string; assist: string | null; minute: number; isPenalty?: boolean }[];
  homePlayerStats: Record<string, PlayerMatchStats>;
  awayPlayerStats: Record<string, PlayerMatchStats>;
  homePossessionPct: number;
  awayPossessionPct: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeChances: number;
  awayChances: number;
  homeSaves: number;
  awaySaves: number;
  homeFouls: number;
  awayFouls: number;
  manOfTheMatch?: MatchState["manOfTheMatch"];
  commentary: CommentaryEvent[];
}

export interface TeamSetup {
  universeId: string;
  formationId: FormationId;
  lineup: LineupSlot[];
  /** Up to 5 named subs — only these players may enter from the bench. */
  bench: string[];
  /** Maps player name → original universe id (season transfers). */
  playerOrigins?: Record<string, string>;
}
