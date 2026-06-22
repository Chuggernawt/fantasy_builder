import type { MatchState } from "./types";
import type {
  TournamentAccumulatedStats,
  TournamentPlayerRecord,
  TournamentState,
} from "./tournament-types";
import { getEntrant } from "./tournament";

export function emptyTournamentStats(): TournamentAccumulatedStats {
  return { players: [], matchesPlayed: 0, totalGoals: 0 };
}

function upsertPlayer(
  players: TournamentPlayerRecord[],
  row: Omit<TournamentPlayerRecord, "key"> & { key: string }
): void {
  const idx = players.findIndex((p) => p.key === row.key);
  if (idx < 0) {
    players.push(row);
    return;
  }
  const prev = players[idx];
  players[idx] = {
    ...prev,
    matches: prev.matches + row.matches,
    goals: prev.goals + row.goals,
    assists: prev.assists + row.assists,
    ratingTotal: prev.ratingTotal + row.ratingTotal,
  };
}

export function accumulateTournamentMatchStats(
  tournament: TournamentState,
  fixtureId: string,
  matchState: MatchState
): TournamentState {
  const fixture = tournament.fixtures.find((f) => f.id === fixtureId);
  if (!fixture || fixture.status === "finished") return tournament;

  const homeE = getEntrant(tournament, fixture.homeEntrantId);
  const awayE = getEntrant(tournament, fixture.awayEntrantId);
  if (!homeE || !awayE) return tournament;

  const stats = tournament.stats ?? emptyTournamentStats();
  const players = [...stats.players];

  function ingestEntrant(
    entrant: NonNullable<typeof homeE>,
    universeId: string,
    playerStats: MatchState["homePlayerStats"]
  ) {
    for (const [playerName, ps] of Object.entries(playerStats ?? {})) {
      upsertPlayer(players, {
        key: `${entrant.id}:${playerName}`,
        entrantId: entrant.id,
        entrantName: entrant.displayName,
        universeId,
        playerName,
        matches: 1,
        goals: ps.goals ?? 0,
        assists: ps.assists ?? 0,
        ratingTotal: ps.matchRating ?? 6,
      });
    }
  }

  ingestEntrant(homeE, matchState.homeUniverseId, matchState.homePlayerStats);
  ingestEntrant(awayE, matchState.awayUniverseId, matchState.awayPlayerStats);

  return {
    ...tournament,
    stats: {
      players,
      matchesPlayed: stats.matchesPlayed + 1,
      totalGoals: stats.totalGoals + matchState.score.home + matchState.score.away,
    },
  };
}

export function playerAverageRating(row: TournamentPlayerRecord): number {
  return row.matches > 0 ? row.ratingTotal / row.matches : 0;
}

export function topTournamentScorers(
  stats: TournamentAccumulatedStats | null | undefined,
  limit = 5
): TournamentPlayerRecord[] {
  if (!stats?.players.length) return [];
  return [...stats.players]
    .filter((p) => p.goals > 0)
    .sort((a, b) => b.goals - a.goals || playerAverageRating(b) - playerAverageRating(a))
    .slice(0, limit);
}

export function topTournamentRatings(
  stats: TournamentAccumulatedStats | null | undefined,
  limit = 5,
  minMatches = 1
): TournamentPlayerRecord[] {
  if (!stats?.players.length) return [];
  return [...stats.players]
    .filter((p) => p.matches >= minMatches)
    .sort(
      (a, b) =>
        playerAverageRating(b) - playerAverageRating(a) ||
        b.goals - a.goals ||
        b.assists - a.assists
    )
    .slice(0, limit);
}

export function pickPlayerOfTournament(
  stats: TournamentAccumulatedStats | null | undefined
): TournamentPlayerRecord | null {
  const candidates = topTournamentRatings(stats, 10, 1);
  if (!candidates.length) return null;
  return candidates[0];
}

export function formatTournamentPlayerLine(row: TournamentPlayerRecord): string {
  const avg = playerAverageRating(row).toFixed(1);
  const parts = [`${row.goals}G`];
  if (row.assists > 0) parts.push(`${row.assists}A`);
  parts.push(`${avg} RTG`);
  return parts.join(" · ");
}
