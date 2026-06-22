import type { PlayerLobbyState } from "./multiplayer-types";

export type TournamentFormat = "cup4" | "cup8" | "round_robin";
export type PenaltyMode = "interactive" | "sim";
export type TournamentPhase = "lobby" | "draw" | "round" | "between_rounds" | "finished";

export interface TournamentEntrant {
  id: string;
  slot: number;
  userId: string | null;
  isCpu: boolean;
  displayName: string;
  universeId: string | null;
  lobby: PlayerLobbyState;
  eliminated: boolean;
}

export interface TournamentFixture {
  id: string;
  round: number;
  roundName: string;
  homeEntrantId: string;
  awayEntrantId: string;
  homeScore?: number;
  awayScore?: number;
  pensHome?: number;
  pensAway?: number;
  status: "pending" | "ready" | "live" | "finished";
  /** Human vs human — dedicated friendly room for this fixture. */
  matchRoomId?: string | null;
  winnerEntrantId?: string | null;
  /** Cup: fixture id winner advances into */
  feedsIntoFixtureId?: string;
  /** Cup: which side winner occupies in next fixture */
  feedsIntoSide?: "home" | "away";
}

export interface RoundRobinRow {
  entrantId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface TournamentPlayerRecord {
  key: string;
  entrantId: string;
  entrantName: string;
  universeId: string;
  playerName: string;
  matches: number;
  goals: number;
  assists: number;
  ratingTotal: number;
}

export interface TournamentAccumulatedStats {
  players: TournamentPlayerRecord[];
  matchesPlayed: number;
  totalGoals: number;
}

export interface TournamentState {
  format: TournamentFormat;
  playerCount: number;
  phase: TournamentPhase;
  penaltyMode: PenaltyMode;
  entrants: TournamentEntrant[];
  fixtures: TournamentFixture[];
  /** Slot order after random draw (indices 0..n-1) */
  drawOrder: number[];
  drawRevealed: boolean;
  currentRound: number;
  activeFixtureId: string | null;
  /** All human fixtures in the current round that may be played in parallel. */
  activeFixtureIds?: string[];
  championId: string | null;
  table: RoundRobinRow[];
  /** Cumulative stats from completed human/simulated fixtures. */
  stats?: TournamentAccumulatedStats | null;
  /** Local human entrant id (offline) or set per client */
  localEntrantId?: string | null;
}

export function tournamentFormatLabel(format: TournamentFormat): string {
  if (format === "cup4") return "Cup (4)";
  if (format === "cup8") return "Cup (8)";
  return "Round Robin";
}

export function playerCountForFormat(format: TournamentFormat, count?: number): number {
  if (format === "cup4") return 4;
  if (format === "cup8") return 8;
  return Math.min(8, Math.max(3, count ?? 4));
}
