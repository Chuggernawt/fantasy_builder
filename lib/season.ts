import type { SeasonMatchMeta } from "./commentary-types";
import { getUniverse } from "./squads";
import { revealAllForPlayer } from "./reveal";
import type { StatKey } from "./types";
import { buildSeasonFixtures, initSeasonTable } from "./season-fixtures";
import { simulateLiteMatch } from "./season-lite";
import { initSeasonRosters, pickSeasonLeagueIds, SEASON_LEAGUE_SIZE } from "./season-rosters";
import { openTransferWindowIfNeeded } from "./season-transfers";
import type {
  LiteMatchResult,
  SeasonFixture,
  SeasonHonour,
  SeasonLength,
  SeasonPlayerRow,
  SeasonState,
  SeasonTeamRow,
} from "./season-types";

export { SEASON_LEAGUE_SIZE, pickSeasonLeagueIds } from "./season-rosters";

export function playerStatKey(universeId: string, playerName: string): string {
  return `${universeId}::${playerName}`;
}

export function createSeason(
  userUniverseId: string,
  length: SeasonLength,
  seasonNumber: number,
  unlockedSquads: string[]
): SeasonState {
  const ids = pickSeasonLeagueIds(userUniverseId, unlockedSquads);
  return {
    seasonNumber,
    length,
    userUniverseId,
    leagueUniverseIds: ids,
    rosters: initSeasonRosters(ids),
    fixtures: buildSeasonFixtures(ids, userUniverseId, length),
    table: initSeasonTable(ids),
    playerStats: {},
    currentMatchday: 1,
    status: "active",
    championId: null,
    suspensions: {},
    transfersThisWindow: 0,
    transferHistory: [],
  };
}

export function suspensionKey(universeId: string, playerName: string): string {
  return `${universeId}:${playerName}`;
}

export function applyRedCardSuspension(
  season: SeasonState,
  universeId: string,
  playerName: string,
  banGames = 3
): SeasonState {
  const key = suspensionKey(universeId, playerName);
  return {
    ...season,
    suspensions: {
      ...season.suspensions,
      [key]: banGames,
    },
  };
}

export function tickSuspensions(season: SeasonState): SeasonState {
  const next: Record<string, number> = {};
  for (const [key, games] of Object.entries(season.suspensions ?? {})) {
    const left = games - 1;
    if (left > 0) next[key] = left;
  }
  return { ...season, suspensions: next };
}

export function isPlayerSuspended(
  season: SeasonState,
  universeId: string,
  playerName: string
): boolean {
  return (season.suspensions?.[suspensionKey(universeId, playerName)] ?? 0) > 0;
}

export function getPlayerFixture(season: SeasonState): SeasonFixture | null {
  return (
    season.fixtures.find(
      (f) => f.matchday === season.currentMatchday && f.isPlayerMatch && !f.played
    ) ?? null
  );
}

export function getMatchdayFixtures(season: SeasonState, matchday: number): SeasonFixture[] {
  return season.fixtures.filter((f) => f.matchday === matchday);
}

export function buildSeasonMatchMeta(season: SeasonState): SeasonMatchMeta | null {
  if (season.status !== "active") return null;
  const fixture = getPlayerFixture(season);
  if (!fixture) return null;

  const maxMd = Math.max(...season.fixtures.map((f) => f.matchday));
  const isFinale = fixture.matchday >= maxMd;
  const sorted = sortTable(season.table);
  const userIdx = sorted.findIndex((r) => r.universeId === season.userUniverseId);
  const userRow = sorted[userIdx];
  const leader = sorted[0];
  const uni = getUniverse(season.userUniverseId);
  const leaderUni = leader ? getUniverse(leader.universeId) : null;
  const userPoints = userRow?.points ?? 0;
  const leaderPoints = leader?.points ?? 0;
  const second = sorted[1];
  const userLeading = userIdx === 0;
  const gap = userLeading ? userPoints - (second?.points ?? 0) : leaderPoints - userPoints;

  return {
    isFinale,
    userUniverseId: season.userUniverseId,
    userTeamName: uni?.name ?? season.userUniverseId,
    userPositionBefore: userIdx >= 0 ? userIdx + 1 : sorted.length,
    userPointsBefore: userPoints,
    leaderPointsBefore: leaderPoints,
    leaderName: leaderUni?.name ?? leader?.universeId ?? "Leaders",
    matchday: fixture.matchday,
    seasonLength: season.length,
    userLeading,
    titleRace: isFinale && gap <= 3,
  };
}

function applyResultToTable(table: SeasonTeamRow[], result: LiteMatchResult): SeasonTeamRow[] {
  const next = table.map((r) => ({ ...r }));
  const home = next.find((r) => r.universeId === result.homeUniverseId);
  const away = next.find((r) => r.universeId === result.awayUniverseId);
  if (!home || !away) return next;

  home.played++;
  away.played++;
  home.goalsFor += result.homeScore;
  home.goalsAgainst += result.awayScore;
  away.goalsFor += result.awayScore;
  away.goalsAgainst += result.homeScore;

  if (result.homeScore > result.awayScore) {
    home.won++;
    home.points += 3;
    away.lost++;
  } else if (result.homeScore < result.awayScore) {
    away.won++;
    away.points += 3;
    home.lost++;
  } else {
    home.drawn++;
    away.drawn++;
    home.points++;
    away.points++;
  }
  return next;
}

function bumpPlayerStats(
  stats: Record<string, SeasonPlayerRow>,
  universeId: string,
  playerName: string,
  patch: Partial<Pick<SeasonPlayerRow, "goals" | "assists" | "yellowCards" | "redCards">>
): Record<string, SeasonPlayerRow> {
  const key = playerStatKey(universeId, playerName);
  const row = stats[key] ?? {
    key,
    universeId,
    playerName,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
  };
  return {
    ...stats,
    [key]: {
      ...row,
      goals: row.goals + (patch.goals ?? 0),
      assists: row.assists + (patch.assists ?? 0),
      yellowCards: row.yellowCards + (patch.yellowCards ?? 0),
      redCards: row.redCards + (patch.redCards ?? 0),
    },
  };
}

function applyResultToPlayerStats(
  stats: Record<string, SeasonPlayerRow>,
  result: LiteMatchResult
): Record<string, SeasonPlayerRow> {
  let next = { ...stats };
  for (const g of result.goals) {
    next = bumpPlayerStats(next, g.universeId, g.playerName, { goals: 1 });
    if (g.assistPlayerName && g.assistUniverseId) {
      next = bumpPlayerStats(next, g.assistUniverseId, g.assistPlayerName, { assists: 1 });
    }
  }
  for (const c of result.cards) {
    next = bumpPlayerStats(next, c.universeId, c.playerName, {
      yellowCards: c.type === "yellow" ? 1 : 0,
      redCards: c.type === "red" ? 1 : 0,
    });
  }
  return next;
}

function markFixturePlayed(
  fixtures: SeasonFixture[],
  fixtureId: string,
  homeScore: number,
  awayScore: number
): SeasonFixture[] {
  return fixtures.map((f) =>
    f.id === fixtureId ? { ...f, played: true, homeScore, awayScore } : f
  );
}

export function recordLiteResult(season: SeasonState, result: LiteMatchResult, fixtureId: string): SeasonState {
  const fixtures = markFixturePlayed(
    season.fixtures,
    fixtureId,
    result.homeScore,
    result.awayScore
  );
  return {
    ...season,
    fixtures,
    table: applyResultToTable(season.table, result),
    playerStats: applyResultToPlayerStats(season.playerStats, result),
  };
}

export function recordPlayerMatchFromState(
  season: SeasonState,
  fixture: SeasonFixture,
  homeScore: number,
  awayScore: number,
  homePlayerStats: Record<string, { goals: number; assists: number; yellowCards: number; redCards: number }>,
  awayPlayerStats: Record<string, { goals: number; assists: number; yellowCards: number; redCards: number }>
): SeasonState {
  let next = recordLiteResult(
    season,
    {
      homeUniverseId: fixture.homeUniverseId,
      awayUniverseId: fixture.awayUniverseId,
      homeScore,
      awayScore,
      goals: [],
      cards: [],
    },
    fixture.id
  );

  const applyStats = (
    stats: Record<string, SeasonPlayerRow>,
    universeId: string,
    ps: Record<string, { goals: number; assists: number; yellowCards: number; redCards: number }>
  ) => {
    let s = stats;
    for (const [name, row] of Object.entries(ps)) {
      if (row.goals) s = bumpPlayerStats(s, universeId, name, { goals: row.goals });
      if (row.assists) s = bumpPlayerStats(s, universeId, name, { assists: row.assists });
      if (row.yellowCards) s = bumpPlayerStats(s, universeId, name, { yellowCards: row.yellowCards });
      if (row.redCards) s = bumpPlayerStats(s, universeId, name, { redCards: row.redCards });
    }
    return s;
  };

  next = {
    ...next,
    playerStats: applyStats(
      applyStats(next.playerStats, fixture.homeUniverseId, homePlayerStats),
      fixture.awayUniverseId,
      awayPlayerStats
    ),
  };

  return simRemainingMatchdayFixtures(next);
}

export function simRemainingMatchdayFixtures(season: SeasonState): SeasonState {
  let next = { ...season };
  const rosters = next.rosters;
  const pending = getMatchdayFixtures(next, next.currentMatchday).filter((f) => !f.played);
  for (const f of pending) {
    const result = simulateLiteMatch(f.homeUniverseId, f.awayUniverseId, rosters);
    next = recordLiteResult(next, result, f.id);
  }
  return advanceMatchdayIfComplete(tickSuspensions(next));
}

function advanceMatchdayIfComplete(season: SeasonState): SeasonState {
  const md = getMatchdayFixtures(season, season.currentMatchday);
  if (md.some((f) => !f.played)) return season;

  const maxMatchday = Math.max(...season.fixtures.map((f) => f.matchday));
  if (season.currentMatchday >= maxMatchday) {
    const sorted = sortTable(season.table);
    return { ...season, status: "finished", championId: sorted[0]?.universeId ?? null };
  }
  const next = { ...season, currentMatchday: season.currentMatchday + 1 };
  return openTransferWindowIfNeeded(next);
}

export function sortTable(table: SeasonTeamRow[]): SeasonTeamRow[] {
  return [...table].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}

export function topScorers(stats: Record<string, SeasonPlayerRow>, limit = 10): SeasonPlayerRow[] {
  return Object.values(stats)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
    .slice(0, limit);
}

export function topAssists(stats: Record<string, SeasonPlayerRow>, limit = 10): SeasonPlayerRow[] {
  return Object.values(stats)
    .filter((r) => r.assists > 0)
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals)
    .slice(0, limit);
}

export function topCards(
  stats: Record<string, SeasonPlayerRow>,
  kind: "yellow" | "red",
  limit = 10
): SeasonPlayerRow[] {
  const key = kind === "yellow" ? "yellowCards" : "redCards";
  return Object.values(stats)
    .filter((r) => r[key] > 0)
    .sort((a, b) => b[key] - a[key])
    .slice(0, limit);
}

export function applySeasonChampionReveal(
  revealedStats: Record<string, StatKey[]>,
  userUniverseId: string,
  length: SeasonLength,
  won: boolean,
  rosterPlayerNames?: string[]
): Record<string, StatKey[]> {
  if (!won) return revealedStats;

  let next = { ...revealedStats };
  const names =
    rosterPlayerNames ??
    getUniverse(userUniverseId)?.players.map((p) => p.name) ??
    [];

  if (length === 38) {
    for (const name of names) {
      next = revealAllForPlayer(next, name);
    }
  } else {
    const shuffled = [...names].sort(() => Math.random() - 0.5).slice(0, 11);
    for (const name of shuffled) {
      next = revealAllForPlayer(next, name);
    }
  }
  return next;
}

export function getUserTablePosition(season: SeasonState): number {
  const sorted = sortTable(season.table);
  const idx = sorted.findIndex((r) => r.universeId === season.userUniverseId);
  return idx >= 0 ? idx + 1 : sorted.length;
}

export function getUserTeamRow(season: SeasonState): SeasonTeamRow | null {
  return season.table.find((r) => r.universeId === season.userUniverseId) ?? null;
}

export function getUserTeamScorers(
  stats: Record<string, SeasonPlayerRow>,
  userUniverseId: string,
  limit = 5
): SeasonPlayerRow[] {
  return Object.values(stats)
    .filter((r) => r.universeId === userUniverseId && (r.goals > 0 || r.assists > 0))
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
    .slice(0, limit);
}

export function buildSeasonSummary(season: SeasonState): SeasonHonour | null {
  const uni = getUniverse(season.userUniverseId);
  if (!uni || season.status !== "finished") return null;

  const championId = season.championId ?? sortTable(season.table)[0]?.universeId ?? "";
  const championUni = championId ? getUniverse(championId) : null;
  const userRow = getUserTeamRow(season);
  const wonLeague = championId === season.userUniverseId;

  return {
    universeId: season.userUniverseId,
    universeName: uni.name,
    seasonLength: season.length,
    seasonNumber: season.seasonNumber,
    completedAt: new Date().toISOString(),
    finalPosition: getUserTablePosition(season),
    wonLeague,
    championId,
    championName: championUni?.name ?? championId,
    played: userRow?.played ?? 0,
    won: userRow?.won ?? 0,
    drawn: userRow?.drawn ?? 0,
    lost: userRow?.lost ?? 0,
    goalsFor: userRow?.goalsFor ?? 0,
    goalsAgainst: userRow?.goalsAgainst ?? 0,
    points: userRow?.points ?? 0,
    topScorers: getUserTeamScorers(season.playerStats, season.userUniverseId).map((r) => ({
      playerName: r.playerName,
      goals: r.goals,
      assists: r.assists,
    })),
  };
}

export function buildHonour(
  userUniverseId: string,
  length: SeasonLength,
  seasonNumber: number
): SeasonHonour | null {
  const uni = getUniverse(userUniverseId);
  if (!uni) return null;
  return {
    universeId: userUniverseId,
    universeName: uni.name,
    seasonLength: length,
    seasonNumber,
    completedAt: new Date().toISOString(),
    wonLeague: true,
  };
}
