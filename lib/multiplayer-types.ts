import type { MatchState, TeamTactics } from "./types";

export type RoomVisibility = "public" | "private";
export type RoomMode = "friendly" | "tournament";
export type RoomStatus = "waiting" | "draft" | "live" | "finished";
export type MemberRole = "host" | "away" | "spectator" | "player";

import type { PlayerCareerStats } from "./career-stats";
import type { StatKey } from "./types";
import type { AccountProgress, ProfileCloudProgress } from "./account-progress";

export interface MultiplayerProfile {
  user_id: string;
  username: string;
  created_at: string;
  career_stats?: PlayerCareerStats | null;
  revealed_stats?: Record<string, StatKey[]> | null;
  account_progress?: ProfileCloudProgress | null;
}

import type { PenaltyMode, TournamentFormat, TournamentState } from "./tournament-types";

export interface MultiplayerRoom {
  id: string;
  code: string;
  host_user_id: string;
  visibility: RoomVisibility;
  room_mode: RoomMode;
  status: RoomStatus;
  state: MultiplayerSnapshot | null;
  tournament: TournamentState | null;
  created_at: string;
}

export interface MultiplayerRoomMember {
  room_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  lobby?: PlayerLobbyState | null;
}

export interface PlayerLobbyState {
  universeId: string | null;
  formationId: string;
  lineup: Array<{ slotId: string; role: string; playerName: string | null }>;
  matchBench: string[];
  plannedTactics?: TeamTactics;
  ready: boolean;
  updatedAt: string;
}

export interface MultiplayerMessage {
  id: string;
  room_id: string;
  user_id: string;
  text: string;
  created_at: string;
}

export interface MultiplayerInvite {
  id: string;
  room_id: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
}

export interface MultiplayerSnapshot {
  selectedUniverseId: string | null;
  formationId: string;
  lineup: Array<{ slotId: string; role: string; playerName: string | null }>;
  matchBench: string[];
  opponentUniverseId: string | null;
  opponentFormationId: string;
  opponentLineup: Array<{ slotId: string; role: string; playerName: string | null }>;
  opponentBench: string[];
  matchState: MatchState | null;
  updatedAt: string;
  mp?: MpMatchMeta | null;
}

export type MpPauseKind = "subs" | "halftime" | "extra_time";

export interface MpPauseState {
  kind: MpPauseKind;
  endsAt: string;
  homeReady: boolean;
  awayReady: boolean;
  pendingHomeLineup?: Array<{ slotId: string; role: string; playerName: string | null }> | null;
  pendingHomeSubsMade?: number;
  pendingAwayLineup?: Array<{ slotId: string; role: string; playerName: string | null }> | null;
  pendingAwaySubsMade?: number;
  pendingHomeTactics?: TeamTactics | null;
  pendingHomeCaptain?: string | null;
  pendingAwayTactics?: TeamTactics | null;
  pendingAwayCaptain?: string | null;
  pendingHomeExtraTime?: string | null;
  pendingAwayExtraTime?: string | null;
}

export interface MpRematchState {
  host: boolean;
  away: boolean;
}

export interface MpTournamentFixtureMeta {
  fixtureId: string;
  format: TournamentFormat;
  penaltyMode: PenaltyMode;
  homeUserId: string | null;
  awayUserId: string | null;
  /** Human vs CPU — played locally without locking the shared room. */
  localCpuMatch?: boolean;
}

export interface MpMatchMeta {
  pause: MpPauseState | null;
  rematch: MpRematchState;
  /** Child friendly room reports results back to the tournament hub. */
  parentTournamentRoomId?: string | null;
  /** Shared HvH fixture room — snapshots sync here, not the tournament hub. */
  fixtureRoomId?: string | null;
  tournamentFixture?: MpTournamentFixtureMeta | null;
}

export type MpPlayerAction =
  | { type: "request_subs" }
  | { type: "subs_ready"; lineup: Array<{ slotId: string; role: string; playerName: string | null }>; subsMade: number }
  | { type: "halftime_ready"; lineup: Array<{ slotId: string; role: string; playerName: string | null }>; subsMade: number; tactic?: TeamTactics | null; captain?: string | null }
  | { type: "extra_time_ready"; approach: string }
  | { type: "set_tactic"; tactic: TeamTactics }
  | { type: "set_captain"; playerName: string }
  | { type: "set_piece_pick"; choice: number; role: "attack" | "defend" }
  | { type: "rematch" };
