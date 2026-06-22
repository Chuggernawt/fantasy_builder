export type SeasonLength = 19 | 38;

export interface SeasonRosterEntry {
  /** Original universe — stats and identity stay tied here after transfers. */
  universeId: string;
  playerName: string;
}

export interface SeasonTransferRecord {
  matchday: number;
  partnerTeamId: string;
  out: SeasonRosterEntry;
  in: SeasonRosterEntry;
  completedAt: string;
}

export interface SeasonFixture {
  id: string;
  matchday: number;
  homeUniverseId: string;
  awayUniverseId: string;
  played: boolean;
  isPlayerMatch: boolean;
  homeScore?: number;
  awayScore?: number;
}

export interface SeasonGoalEvent {
  universeId: string;
  playerName: string;
  minute: number;
  assistUniverseId?: string;
  assistPlayerName?: string;
}

export interface SeasonCardEvent {
  universeId: string;
  playerName: string;
  minute: number;
  type: "yellow" | "red";
}

export interface LiteMatchResult {
  homeUniverseId: string;
  awayUniverseId: string;
  homeScore: number;
  awayScore: number;
  goals: SeasonGoalEvent[];
  cards: SeasonCardEvent[];
}

export interface SeasonTeamRow {
  universeId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface SeasonPlayerRow {
  key: string;
  universeId: string;
  playerName: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
}

export interface SeasonPlayerSummary {
  playerName: string;
  goals: number;
  assists: number;
}

export interface SeasonHonour {
  universeId: string;
  universeName: string;
  seasonLength: SeasonLength;
  seasonNumber: number;
  completedAt: string;
  /** League finish (1 = champions). Present on records saved after season finale. */
  finalPosition?: number;
  wonLeague?: boolean;
  championId?: string;
  championName?: string;
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  points?: number;
  topScorers?: SeasonPlayerSummary[];
}

export interface SeasonState {
  seasonNumber: number;
  length: SeasonLength;
  userUniverseId: string;
  /** Universes in this season's 20-team league (new seasons only). */
  leagueUniverseIds?: string[];
  fixtures: SeasonFixture[];
  table: SeasonTeamRow[];
  playerStats: Record<string, SeasonPlayerRow>;
  currentMatchday: number;
  status: "active" | "finished";
  championId: string | null;
  /** Games remaining banned: key `${universeId}:${playerName}` */
  suspensions: Record<string, number>;
  /** Per-club squads for this season (22 players each). */
  rosters?: Record<string, SeasonRosterEntry[]>;
  /** Swaps completed in the current transfer window. */
  transfersThisWindow?: number;
  /** Matchday when the active transfer window opened (5, 9, 13, …). */
  transferWindowMatchday?: number;
  transferHistory?: SeasonTransferRecord[];
  /** Teams relegated when continuing into the next campaign season. */
  lastRelegatedIds?: string[];
  /** Teams promoted when continuing into the next campaign season. */
  lastPromotedIds?: string[];
}
