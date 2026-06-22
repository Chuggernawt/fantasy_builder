import { getEntrant } from "./tournament";
import type { TournamentFixture, TournamentState } from "./tournament-types";
import { tournamentFormatLabel } from "./tournament-types";
import {
  pickPlayerOfTournament,
  playerAverageRating,
  topTournamentRatings,
  topTournamentScorers,
} from "./tournament-stats";

export interface TournamentFinaleSummary {
  championName: string;
  championAccent: string | null;
  userEntrantId: string | null;
  userWon: boolean;
  userReachedFinal: boolean;
  formatLabel: string;
  finalFixture: TournamentFixture | null;
  finalScoreline: string | null;
  journey: { roundName: string; scoreline: string; won: boolean }[];
  playOfTournament: {
    playerName: string;
    rating: number;
    teamLabel: string;
    goals: number;
    assists: number;
    matches: number;
  } | null;
  topScorers: Array<{
    playerName: string;
    entrantName: string;
    goals: number;
    assists: number;
    rating: number;
  }>;
  topRated: Array<{
    playerName: string;
    entrantName: string;
    goals: number;
    assists: number;
    rating: number;
  }>;
}

export function resolveUserEntrantId(
  tournament: TournamentState,
  userId?: string | null
): string | null {
  if (userId) {
    const entrant = tournament.entrants.find((e) => e.userId === userId);
    if (entrant) return entrant.id;
  }
  return tournament.localEntrantId ?? null;
}

export function getTournamentFinalFixture(tournament: TournamentState): TournamentFixture | null {
  const final = tournament.fixtures.find((f) => f.roundName === "Final");
  if (final?.status === "finished") return final;
  if (tournament.format === "round_robin") {
    const finished = tournament.fixtures.filter((f) => f.status === "finished");
    return finished.length ? finished[finished.length - 1] : null;
  }
  return null;
}

export function buildTournamentFinaleSummary(
  tournament: TournamentState,
  opts?: {
    userId?: string | null;
    playOfTournament?: { playerName: string; rating: number; teamLabel: string } | null;
  }
): TournamentFinaleSummary | null {
  if (tournament.phase !== "finished" || !tournament.championId) return null;

  const userEntrantId = resolveUserEntrantId(tournament, opts?.userId);
  const champion = getEntrant(tournament, tournament.championId);
  const finalFixture = getTournamentFinalFixture(tournament);

  let finalScoreline: string | null = null;
  if (finalFixture?.homeScore != null && finalFixture.awayScore != null) {
    const home = getEntrant(tournament, finalFixture.homeEntrantId)?.displayName ?? "?";
    const away = getEntrant(tournament, finalFixture.awayEntrantId)?.displayName ?? "?";
    const pens =
      finalFixture.pensHome != null && finalFixture.pensAway != null
        ? ` (${finalFixture.pensHome}-${finalFixture.pensAway} pens)`
        : "";
    finalScoreline = `${home} ${finalFixture.homeScore}-${finalFixture.awayScore} ${away}${pens}`;
  }

  const journey: TournamentFinaleSummary["journey"] = [];
  if (userEntrantId) {
    for (const f of tournament.fixtures) {
      if (f.status !== "finished") continue;
      const involved =
        f.homeEntrantId === userEntrantId || f.awayEntrantId === userEntrantId;
      if (!involved || f.homeScore == null || f.awayScore == null) continue;
      const won = f.winnerEntrantId === userEntrantId;
      journey.push({
        roundName: f.roundName,
        scoreline: fixtureScoreline(tournament, f),
        won,
      });
    }
  }

  const userReachedFinal =
    !!userEntrantId &&
    !!finalFixture &&
    (finalFixture.homeEntrantId === userEntrantId ||
      finalFixture.awayEntrantId === userEntrantId);

  const pot = opts?.playOfTournament
    ? {
        playerName: opts.playOfTournament.playerName,
        rating: opts.playOfTournament.rating,
        teamLabel: opts.playOfTournament.teamLabel,
        goals: 0,
        assists: 0,
        matches: 1,
      }
    : (() => {
        const row = pickPlayerOfTournament(tournament.stats);
        if (!row) return null;
        return {
          playerName: row.playerName,
          rating: playerAverageRating(row),
          teamLabel: row.entrantName,
          goals: row.goals,
          assists: row.assists,
          matches: row.matches,
        };
      })();

  const mapRow = (row: ReturnType<typeof topTournamentScorers>[number]) => ({
    playerName: row.playerName,
    entrantName: row.entrantName,
    goals: row.goals,
    assists: row.assists,
    rating: playerAverageRating(row),
  });

  return {
    championName: champion?.displayName ?? "Champion",
    championAccent: null,
    userEntrantId,
    userWon: !!userEntrantId && tournament.championId === userEntrantId,
    userReachedFinal,
    formatLabel: tournamentFormatLabel(tournament.format),
    finalFixture,
    finalScoreline,
    journey,
    playOfTournament: pot,
    topScorers: topTournamentScorers(tournament.stats, 5).map(mapRow),
    topRated: topTournamentRatings(tournament.stats, 5, 1).map(mapRow),
  };
}

function fixtureScoreline(tournament: TournamentState, f: TournamentFixture): string {
  const home = getEntrant(tournament, f.homeEntrantId)?.displayName ?? "?";
  const away = getEntrant(tournament, f.awayEntrantId)?.displayName ?? "?";
  const pens =
    f.pensHome != null && f.pensAway != null ? ` (${f.pensHome}-${f.pensAway}p)` : "";
  return `${home} ${f.homeScore}-${f.awayScore} ${away}${pens}`;
}
