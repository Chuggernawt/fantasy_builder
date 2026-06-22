import type { MatchScore, PlayerMatchStats } from "./types";

export type CommentaryKind =
  | "goal"
  | "save"
  | "miss"
  | "foul"
  | "freekick"
  | "freekick_cross"
  | "freekick_goal"
  | "freekick_header_goal"
  | "freekick_save"
  | "freekick_miss"
  | "turnover"
  | "tackle"
  | "chance"
  | "cross"
  | "clearance"
  | "pressure"
  | "longball"
  | "header"
  | "corner"
  | "offside"
  | "yellowcard"
  | "redcard"
  | "stamina"
  | "buildup"
  | "ambient"
  | "kickoff"
  | "halftime"
  | "fulltime";

export interface SeasonMatchMeta {
  isFinale: boolean;
  userUniverseId: string;
  userTeamName: string;
  userPositionBefore: number;
  userPointsBefore: number;
  leaderPointsBefore: number;
  leaderName: string;
  matchday: number;
  seasonLength: number;
  /** User is top on points entering this match. */
  userLeading: boolean;
  /** User within 3 pts of leader on finale day. */
  titleRace: boolean;
}

export interface CommentarySession {
  recentLines: string[];
  score: MatchScore;
  minute: number;
  half: 1 | 2;
  momentum: number;
  homeName: string;
  awayName: string;
  homePlayerStats: Record<string, PlayerMatchStats>;
  awayPlayerStats: Record<string, PlayerMatchStats>;
  seasonMeta?: SeasonMatchMeta;
  /** Team currently in possession / attacking. */
  attacking?: "home" | "away";
}
