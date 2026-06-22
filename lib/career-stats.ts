import { getUniverse } from "./squads";
import { normalizeUnlockedSquads } from "./squad-unlocks";
import { getMultiplayerSession } from "./multiplayer-session";
import { getTournamentReturnRoom } from "./tournament-match-session";
import type { MpMatchMeta } from "./multiplayer-types";
import type { SeasonState } from "./season-types";
import type { TournamentState } from "./tournament-types";

export type CareerStatsMode = "online" | "offline";

export interface UniverseCareerRecord {
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface PlayerCareerPlayerRecord {
  goals: number;
  assists: number;
  universeId: string;
}

export interface CareerScoreline {
  playerScore: number;
  oppScore: number;
}

export interface CareerModeStats {
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
  universes: Record<string, UniverseCareerRecord>;
  players: Record<string, PlayerCareerPlayerRecord>;
  biggestWin: CareerScoreline | null;
  biggestLoss: CareerScoreline | null;
}

export interface PlayerCareerStats {
  online: CareerModeStats;
  offline: CareerModeStats;
  onlineTournamentWins: number;
  offlineTournamentWins: number;
  offlineSeasonWins: number;
  /** Dedupe keys for championship awards (e.g. online:roomId, offline:…). */
  tournamentWinKeys: string[];
  seasonWinKeys: string[];
  /** Dedupe keys for finished matches (prevents double-recording the same game). */
  recordedMatchKeys: string[];
  /** Lockable squad ids the player has unlocked (persisted to profile). */
  unlockedSquads: string[];
}

export interface ModeStatsSummary {
  hasActivity: boolean;
  mostPickedUniverseId: string | null;
  mostWinsUniverseId: string | null;
  mostLossesUniverseId: string | null;
  mostDrawsUniverseId: string | null;
  topScorerName: string | null;
  topScorerGoals: number;
  topScorerUniverseId: string | null;
  topAssistsName: string | null;
  topAssistsCount: number;
  topAssistsUniverseId: string | null;
}

export function emptyModeStats(): CareerModeStats {
  return {
    matchWins: 0,
    matchLosses: 0,
    matchDraws: 0,
    universes: {},
    players: {},
    biggestWin: null,
    biggestLoss: null,
  };
}

export function emptyCareerStats(): PlayerCareerStats {
  return {
    online: emptyModeStats(),
    offline: emptyModeStats(),
    onlineTournamentWins: 0,
    offlineTournamentWins: 0,
    offlineSeasonWins: 0,
    tournamentWinKeys: [],
    seasonWinKeys: [],
    recordedMatchKeys: [],
    unlockedSquads: [],
  };
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

function emptyUniverseRecord(): UniverseCareerRecord {
  return { played: 0, wins: 0, losses: 0, draws: 0 };
}

function normalizeUniverses(raw: unknown): Record<string, UniverseCareerRecord> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, UniverseCareerRecord> = {};
  for (const [id, row] of Object.entries(raw as Record<string, Partial<UniverseCareerRecord>>)) {
    out[id] = {
      played: num(row.played),
      wins: num(row.wins),
      losses: num(row.losses),
      draws: num(row.draws),
    };
  }
  return out;
}

function normalizePlayers(raw: unknown): Record<string, PlayerCareerPlayerRecord> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, PlayerCareerPlayerRecord> = {};
  for (const [name, row] of Object.entries(raw as Record<string, Partial<PlayerCareerPlayerRecord>>)) {
    if (!row || typeof row.universeId !== "string") continue;
    out[name] = {
      goals: num(row.goals),
      assists: num(row.assists),
      universeId: row.universeId,
    };
  }
  return out;
}

function normalizeScoreline(raw: unknown): CareerScoreline | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<CareerScoreline>;
  const playerScore = num(o.playerScore);
  const oppScore = num(o.oppScore);
  if (playerScore === 0 && oppScore === 0) return null;
  return { playerScore, oppScore };
}

function normalizeModeStats(raw: unknown): CareerModeStats {
  if (!raw || typeof raw !== "object") return emptyModeStats();
  const o = raw as Partial<CareerModeStats> & { scorers?: unknown };
  const playersRaw = o.players ?? o.scorers;
  return {
    matchWins: num(o.matchWins),
    matchLosses: num(o.matchLosses),
    matchDraws: num(o.matchDraws),
    universes: normalizeUniverses(o.universes),
    players: normalizePlayers(playersRaw),
    biggestWin: normalizeScoreline(o.biggestWin),
    biggestLoss: normalizeScoreline(o.biggestLoss),
  };
}

/** Migrate legacy flat career stats into offline bucket. */
function migrateLegacyCareerStats(o: Record<string, unknown>): PlayerCareerStats {
  return {
    online: emptyModeStats(),
    offline: {
      matchWins: num(o.matchWins),
      matchLosses: num(o.matchLosses),
      matchDraws: num(o.matchDraws),
      universes: normalizeUniverses(o.universes),
      players: normalizePlayers(o.scorers),
      biggestWin: null,
      biggestLoss: null,
    },
    onlineTournamentWins: num(o.onlineTournamentWins),
    offlineTournamentWins: num(o.offlineTournamentWins),
    offlineSeasonWins: 0,
    tournamentWinKeys: Array.isArray(o.tournamentWinKeys)
      ? o.tournamentWinKeys.filter((k): k is string => typeof k === "string")
      : [],
    seasonWinKeys: [],
    recordedMatchKeys: [],
    unlockedSquads: normalizeUnlockedSquads(o.unlockedSquads),
  };
}

function normalizeMatchKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((k): k is string => typeof k === "string").slice(-200);
}

export function normalizeCareerStats(raw: unknown): PlayerCareerStats {
  if (!raw || typeof raw !== "object") return emptyCareerStats();
  const o = raw as Record<string, unknown>;

  if (!o.online && !o.offline && (o.matchWins != null || o.universes || o.scorers)) {
    return migrateLegacyCareerStats(o);
  }

  return {
    online: normalizeModeStats(o.online),
    offline: normalizeModeStats(o.offline),
    onlineTournamentWins: num(o.onlineTournamentWins),
    offlineTournamentWins: num(o.offlineTournamentWins),
    offlineSeasonWins: num(o.offlineSeasonWins),
    tournamentWinKeys: Array.isArray(o.tournamentWinKeys)
      ? o.tournamentWinKeys.filter((k): k is string => typeof k === "string")
      : [],
    seasonWinKeys: Array.isArray(o.seasonWinKeys)
      ? o.seasonWinKeys.filter((k): k is string => typeof k === "string")
      : [],
    recordedMatchKeys: normalizeMatchKeys(o.recordedMatchKeys),
    unlockedSquads: normalizeUnlockedSquads(o.unlockedSquads),
  };
}

function mergeUnlockedSquads(local: PlayerCareerStats, remote: PlayerCareerStats): string[] {
  return unionStringKeys(
    normalizeUnlockedSquads(local.unlockedSquads),
    normalizeUnlockedSquads(remote.unlockedSquads),
    20
  );
}

function winMargin(scoreline: CareerScoreline): number {
  return scoreline.playerScore - scoreline.oppScore;
}

function lossMargin(scoreline: CareerScoreline): number {
  return scoreline.oppScore - scoreline.playerScore;
}

function pickBiggerWin(
  current: CareerScoreline | null,
  candidate: CareerScoreline
): CareerScoreline {
  if (!current) return candidate;
  return winMargin(candidate) > winMargin(current) ? candidate : current;
}

function pickBiggerLoss(
  current: CareerScoreline | null,
  candidate: CareerScoreline
): CareerScoreline {
  if (!current) return candidate;
  return lossMargin(candidate) > lossMargin(current) ? candidate : current;
}

function mergeModeStats(a: CareerModeStats, b: CareerModeStats): CareerModeStats {
  const merged = emptyModeStats();
  merged.matchWins = a.matchWins + b.matchWins;
  merged.matchLosses = a.matchLosses + b.matchLosses;
  merged.matchDraws = a.matchDraws + b.matchDraws;
  merged.biggestWin = [a.biggestWin, b.biggestWin].reduce<CareerScoreline | null>(
    (best, row) => (row ? pickBiggerWin(best, row) : best),
    null
  );
  merged.biggestLoss = [a.biggestLoss, b.biggestLoss].reduce<CareerScoreline | null>(
    (worst, row) => (row ? pickBiggerLoss(worst, row) : worst),
    null
  );

  const universeIds = new Set([...Object.keys(a.universes), ...Object.keys(b.universes)]);
  for (const id of universeIds) {
    const ua = a.universes[id] ?? emptyUniverseRecord();
    const ub = b.universes[id] ?? emptyUniverseRecord();
    merged.universes[id] = {
      played: ua.played + ub.played,
      wins: ua.wins + ub.wins,
      losses: ua.losses + ub.losses,
      draws: ua.draws + ub.draws,
    };
  }

  const playerNames = new Set([...Object.keys(a.players), ...Object.keys(b.players)]);
  for (const name of playerNames) {
    const pa = a.players[name];
    const pb = b.players[name];
    if (!pa && pb) {
      merged.players[name] = { ...pb };
    } else if (pa && !pb) {
      merged.players[name] = { ...pa };
    } else if (pa && pb) {
      merged.players[name] = {
        goals: pa.goals + pb.goals,
        assists: pa.assists + pb.assists,
        universeId: pa.goals + pa.assists >= pb.goals + pb.assists ? pa.universeId : pb.universeId,
      };
    }
  }

  return merged;
}

function unionStringKeys(a: string[], b: string[], limit: number): string[] {
  return [...new Set([...a, ...b])].slice(-limit);
}

function mergeTournamentWinCounts(
  local: PlayerCareerStats,
  remote: PlayerCareerStats
): Pick<
  PlayerCareerStats,
  "onlineTournamentWins" | "offlineTournamentWins" | "offlineSeasonWins"
> {
  return {
    onlineTournamentWins: Math.max(local.onlineTournamentWins, remote.onlineTournamentWins),
    offlineTournamentWins: Math.max(local.offlineTournamentWins, remote.offlineTournamentWins),
    offlineSeasonWins: Math.max(local.offlineSeasonWins, remote.offlineSeasonWins),
  };
}

export function mergeCareerStats(
  local: PlayerCareerStats,
  remote: PlayerCareerStats
): PlayerCareerStats {
  const localKeys = new Set(local.recordedMatchKeys);
  const remoteKeys = new Set(remote.recordedMatchKeys);
  const hasNewRemoteMatches = remote.recordedMatchKeys.some((k) => !localKeys.has(k));
  const hasNewLocalMatches = local.recordedMatchKeys.some((k) => !remoteKeys.has(k));
  const meta = mergeTournamentWinCounts(local, remote);

  const unlockedSquads = mergeUnlockedSquads(local, remote);

  if (!hasNewRemoteMatches) {
    return {
      ...local,
      ...meta,
      tournamentWinKeys: unionStringKeys(local.tournamentWinKeys, remote.tournamentWinKeys, 100),
      seasonWinKeys: unionStringKeys(local.seasonWinKeys, remote.seasonWinKeys, 100),
      recordedMatchKeys: unionStringKeys(local.recordedMatchKeys, remote.recordedMatchKeys, 200),
      unlockedSquads,
    };
  }

  if (!hasNewLocalMatches) {
    return {
      ...remote,
      ...meta,
      tournamentWinKeys: unionStringKeys(local.tournamentWinKeys, remote.tournamentWinKeys, 100),
      seasonWinKeys: unionStringKeys(local.seasonWinKeys, remote.seasonWinKeys, 100),
      recordedMatchKeys: unionStringKeys(local.recordedMatchKeys, remote.recordedMatchKeys, 200),
      unlockedSquads,
    };
  }

  return {
    online: mergeModeStats(local.online, remote.online),
    offline: mergeModeStats(local.offline, remote.offline),
    ...meta,
    tournamentWinKeys: unionStringKeys(local.tournamentWinKeys, remote.tournamentWinKeys, 100),
    seasonWinKeys: unionStringKeys(local.seasonWinKeys, remote.seasonWinKeys, 100),
    recordedMatchKeys: unionStringKeys(local.recordedMatchKeys, remote.recordedMatchKeys, 200),
    unlockedSquads,
  };
}

export function resolveCareerStatsMode(
  mpMatchMeta: MpMatchMeta | null,
  lastMatchContext: "friendly" | "season" | "tournament" | null
): CareerStatsMode {
  if (getMultiplayerSession()) return "online";
  if (getTournamentReturnRoom()) return "online";
  if (mpMatchMeta?.parentTournamentRoomId) return "online";
  if (lastMatchContext === "season") return "offline";
  return "offline";
}

export function buildMatchCareerKey(input: {
  mode: CareerStatsMode;
  scopeId: string;
  universeId: string;
  playerScore: number;
  oppScore: number;
  homeScore: number;
  awayScore: number;
  commentaryLength: number;
}): string {
  return `${input.scopeId}:${input.mode}:${input.universeId}:${input.playerScore}-${input.oppScore}:${input.homeScore}-${input.awayScore}:${input.commentaryLength}`;
}

export function isMatchRecordedInCareerStats(
  stats: PlayerCareerStats,
  matchKey: string
): boolean {
  return stats.recordedMatchKeys.includes(matchKey);
}

export function recordMatchInCareerStats(
  stats: PlayerCareerStats,
  mode: CareerStatsMode,
  input: {
    universeId: string;
    playerScore: number;
    oppScore: number;
    playerStats: Record<string, { goals?: number; assists?: number }>;
    matchKey: string;
    squadPlayerNames?: string[];
  }
): PlayerCareerStats {
  if (!input.universeId) return stats;
  if (isMatchRecordedInCareerStats(stats, input.matchKey)) return stats;

  const squadFilter =
    input.squadPlayerNames && input.squadPlayerNames.length > 0
      ? new Set(input.squadPlayerNames)
      : null;

  const bucket = { ...stats[mode] };
  const universes = { ...bucket.universes };
  const uni = { ...(universes[input.universeId] ?? emptyUniverseRecord()) };
  uni.played += 1;

  if (input.playerScore > input.oppScore) {
    bucket.matchWins += 1;
    uni.wins += 1;
    bucket.biggestWin = pickBiggerWin(bucket.biggestWin, {
      playerScore: input.playerScore,
      oppScore: input.oppScore,
    });
  } else if (input.playerScore < input.oppScore) {
    bucket.matchLosses += 1;
    uni.losses += 1;
    bucket.biggestLoss = pickBiggerLoss(bucket.biggestLoss, {
      playerScore: input.playerScore,
      oppScore: input.oppScore,
    });
  } else {
    bucket.matchDraws += 1;
    uni.draws += 1;
  }
  universes[input.universeId] = uni;
  bucket.universes = universes;

  const players = { ...bucket.players };
  for (const [name, ps] of Object.entries(input.playerStats)) {
    if (squadFilter && !squadFilter.has(name)) continue;
    const goals = ps.goals ?? 0;
    const assists = ps.assists ?? 0;
    if (goals <= 0 && assists <= 0) continue;
    const prev = players[name] ?? { goals: 0, assists: 0, universeId: input.universeId };
    players[name] = {
      goals: prev.goals + goals,
      assists: prev.assists + assists,
      universeId: input.universeId,
    };
  }
  bucket.players = players;

  return {
    ...stats,
    [mode]: bucket,
    recordedMatchKeys: [...stats.recordedMatchKeys, input.matchKey].slice(-200),
  };
}

export function offlineTournamentWinKey(
  tournament: Pick<TournamentState, "format" | "fixtures" | "championId">
): string {
  const sig = tournament.fixtures.map((f) => f.id).join(",");
  return `offline:${tournament.format}:${sig}:${tournament.championId}`;
}

export function onlineTournamentWinKey(roomId: string): string {
  return `online:${roomId}`;
}

export function seasonWinKey(season: Pick<SeasonState, "seasonNumber" | "length" | "userUniverseId">): string {
  return `season:${season.seasonNumber}:${season.length}:${season.userUniverseId}`;
}

export function recordTournamentWinInCareerStats(
  stats: PlayerCareerStats,
  key: string,
  online: boolean
): PlayerCareerStats {
  if (stats.tournamentWinKeys.includes(key)) return stats;
  return {
    ...stats,
    tournamentWinKeys: [...stats.tournamentWinKeys, key].slice(-100),
    onlineTournamentWins: online
      ? stats.onlineTournamentWins + 1
      : stats.onlineTournamentWins,
    offlineTournamentWins: online
      ? stats.offlineTournamentWins
      : stats.offlineTournamentWins + 1,
  };
}

export function recordSeasonWinInCareerStats(
  stats: PlayerCareerStats,
  key: string
): PlayerCareerStats {
  if (stats.seasonWinKeys.includes(key)) return stats;
  return {
    ...stats,
    seasonWinKeys: [...stats.seasonWinKeys, key].slice(-100),
    offlineSeasonWins: stats.offlineSeasonWins + 1,
  };
}

export function universeDisplayName(universeId: string): string {
  return getUniverse(universeId)?.name ?? universeId;
}

export function buildModeStatsSummary(mode: CareerModeStats): ModeStatsSummary {
  const entries = Object.entries(mode.universes).filter(([, r]) => r.played > 0);
  const byPlayed = [...entries].sort((a, b) => b[1].played - a[1].played || b[1].wins - a[1].wins);
  const byWins = [...entries].sort((a, b) => b[1].wins - a[1].wins || b[1].played - a[1].played);
  const byLosses = [...entries].sort(
    (a, b) => b[1].losses - a[1].losses || b[1].played - a[1].played
  );
  const byDraws = [...entries].sort(
    (a, b) => b[1].draws - a[1].draws || b[1].played - a[1].played
  );

  const topScorer = Object.entries(mode.players)
    .filter(([, row]) => row.goals > 0)
    .sort((a, b) => b[1].goals - a[1].goals || b[1].assists - a[1].assists)[0];

  const topAssists = Object.entries(mode.players)
    .filter(([, row]) => row.assists > 0)
    .sort((a, b) => b[1].assists - a[1].assists || b[1].goals - a[1].goals)[0];

  const hasActivity =
    mode.matchWins + mode.matchLosses + mode.matchDraws > 0 ||
    entries.length > 0;

  const topWins = byWins[0];
  const topLosses = byLosses[0];
  const topDraws = byDraws[0];

  return {
    hasActivity,
    mostPickedUniverseId: byPlayed[0]?.[0] ?? null,
    mostWinsUniverseId: topWins && topWins[1].wins > 0 ? topWins[0] : null,
    mostLossesUniverseId: topLosses && topLosses[1].losses > 0 ? topLosses[0] : null,
    mostDrawsUniverseId: topDraws && topDraws[1].draws > 0 ? topDraws[0] : null,
    topScorerName: topScorer?.[0] ?? null,
    topScorerGoals: topScorer?.[1].goals ?? 0,
    topScorerUniverseId: topScorer?.[1].universeId ?? null,
    topAssistsName: topAssists?.[0] ?? null,
    topAssistsCount: topAssists?.[1].assists ?? 0,
    topAssistsUniverseId: topAssists?.[1].universeId ?? null,
  };
}

export function hasCareerStatsActivity(stats: PlayerCareerStats): boolean {
  return totalCareerActivity(stats) > 0;
}

export function totalCareerActivity(stats: PlayerCareerStats): number {
  const modeTotal = (m: CareerModeStats) => m.matchWins + m.matchLosses + m.matchDraws;
  return (
    modeTotal(stats.online) +
    modeTotal(stats.offline) +
    stats.onlineTournamentWins +
    stats.offlineTournamentWins +
    stats.offlineSeasonWins
  );
}

/** Pick the best career snapshot when combining device cache and cloud profile. */
export function reconcileCareerStats(
  local: PlayerCareerStats,
  remote: PlayerCareerStats
): PlayerCareerStats {
  const la = totalCareerActivity(local);
  const ra = totalCareerActivity(remote);
  const base = ra > la ? remote : local;
  // Prefer local when tied — cloud and device cache often hold the same matches;
  // additive merge would double-count W/L and scorer totals.
  return {
    ...normalizeCareerStats(base),
    unlockedSquads: mergeUnlockedSquads(local, remote),
  };
}

export function formatWinLoss(mode: CareerModeStats): string {
  return `${mode.matchWins}W · ${mode.matchLosses}L · ${mode.matchDraws}D`;
}

export function formatUniverseStat(
  stats: PlayerCareerStats,
  mode: CareerStatsMode,
  universeId: string | null,
  kind: "played" | "wins" | "losses" | "draws"
): string {
  if (!universeId) return "—";
  const name = universeDisplayName(universeId);
  const row = stats[mode].universes[universeId];
  if (!row) return name;
  if (kind === "played") return `${name} (${row.played} game${row.played === 1 ? "" : "s"})`;
  if (kind === "wins") return `${name} (${row.wins} win${row.wins === 1 ? "" : "s"})`;
  if (kind === "draws") return `${name} (${row.draws} draw${row.draws === 1 ? "" : "s"})`;
  return `${name} (${row.losses} loss${row.losses === 1 ? "" : "es"})`;
}

export function formatTopScorer(summary: ModeStatsSummary): string {
  if (!summary.topScorerName || summary.topScorerGoals <= 0) return "—";
  return `${summary.topScorerName} (${summary.topScorerGoals}G · ${universeDisplayName(summary.topScorerUniverseId ?? "")})`;
}

export function formatTopAssists(summary: ModeStatsSummary): string {
  if (!summary.topAssistsName || summary.topAssistsCount <= 0) return "—";
  return `${summary.topAssistsName} (${summary.topAssistsCount}A · ${universeDisplayName(summary.topAssistsUniverseId ?? "")})`;
}

export function formatBiggestWin(scoreline: CareerScoreline | null): string {
  if (!scoreline) return "—";
  return `${scoreline.playerScore}–${scoreline.oppScore}`;
}

export function formatBiggestLoss(scoreline: CareerScoreline | null): string {
  if (!scoreline) return "—";
  return `${scoreline.playerScore}–${scoreline.oppScore}`;
}
