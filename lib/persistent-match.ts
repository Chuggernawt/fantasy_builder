import type { LineupSlot, MatchState } from "./types";
import type { SeasonState } from "./season-types";
import {
  type MatchInjuryReport,
  type PersistedPlayerInjury,
  finalizeMatchInjuries,
  gamesOutForSeverity,
  reportsToPersisted,
} from "./injuries";
import { applyFormDelta, formDeltaFromRating } from "./match-rating";
import { updateTeamFormFromMatch } from "./instance-form";
import { applyInjuriesToSeason } from "./season-injuries";
import {
  mergeSeasonStaminaAfterMatch,
  mergeTournamentStaminaAfterMatch,
} from "./squad-stamina";
import {
  applyInjuriesToTournament,
  tickTournamentInjuries,
  type TournamentInstanceState,
} from "./tournament-instance";

export function buildMatchInjuryReports(
  state: MatchState,
  homeLineup: LineupSlot[],
  awayLineup: LineupSlot[],
  homeOrigins?: Record<string, string>,
  awayOrigins?: Record<string, string>
): MatchInjuryReport[] {
  if (!state.persistentMatchMode) return [];
  const homeNames = new Set(homeLineup.map((s) => s.playerName).filter(Boolean) as string[]);
  const awayNames = new Set(awayLineup.map((s) => s.playerName).filter(Boolean) as string[]);
  const all = finalizeMatchInjuries(
    state.homeActiveInjuries ?? {},
    state.awayActiveInjuries ?? {},
    state.homeUniverseId,
    state.awayUniverseId,
    homeOrigins,
    awayOrigins
  );
  return all.filter((r) => {
    if (r.gamesOut > 0) return true;
    if (r.finalSeverity !== "impact") return false;
    const onPitch =
      (r.team === "home" && homeNames.has(r.playerName)) ||
      (r.team === "away" && awayNames.has(r.playerName));
    const row =
      r.team === "home"
        ? state.homeActiveInjuries?.[r.playerName]
        : state.awayActiveInjuries?.[r.playerName];
    return onPitch && !!row && !row.subbedOff;
  });
}

export function applySeasonMatchPersistence(
  season: SeasonState,
  state: MatchState,
  homeLineup: LineupSlot[],
  awayLineup: LineupSlot[],
  homeBench: string[],
  awayBench: string[],
  homeOrigins?: Record<string, string>,
  awayOrigins?: Record<string, string>
): SeasonState {
  let next = season;
  const reports = buildMatchInjuryReports(state, homeLineup, awayLineup, homeOrigins, awayOrigins);
  const persisted = reportsToPersisted(
    reports.filter((r) => r.gamesOut > 0),
    state.homeUniverseId,
    state.awayUniverseId,
    homeOrigins,
    awayOrigins
  );
  if (persisted.length) next = applyInjuriesToSeason(next, persisted);

  next = mergeSeasonStaminaAfterMatch(
    next,
    state.homeUniverseId,
    state.homeStamina,
    homeLineup,
    homeBench
  );
  next = mergeSeasonStaminaAfterMatch(
    next,
    state.awayUniverseId,
    state.awayStamina,
    awayLineup,
    awayBench
  );

  let form = next.playerForm ?? {};
  form = updateTeamFormFromMatch(form, state.homeUniverseId, state.homePlayerStats ?? {}, homeLineup);
  form = updateTeamFormFromMatch(form, state.awayUniverseId, state.awayPlayerStats ?? {}, awayLineup);
  return { ...next, playerForm: form };
}

export function userPersistedInjuriesFromReports(
  reports: MatchInjuryReport[],
  userUniverseId: string,
  playerIsHome: boolean,
  userOrigins?: Record<string, string>
): PersistedPlayerInjury[] {
  const userSide: "home" | "away" = playerIsHome ? "home" : "away";
  return reports
    .filter((r) => r.team === userSide && r.gamesOut > 0)
    .map((r) => ({
      universeId: userOrigins?.[r.playerName] ?? userUniverseId,
      playerName: r.playerName,
      severity: r.finalSeverity,
      bodyPart: r.bodyPart,
      gamesOut: gamesOutForSeverity(r.finalSeverity),
    }));
}

export function applyTournamentMatchPersistence(
  instance: TournamentInstanceState,
  state: MatchState,
  userUniverseId: string,
  homeLineup: LineupSlot[],
  awayLineup: LineupSlot[],
  homeBench: string[],
  awayBench: string[],
  playerIsHome: boolean,
  userOrigins?: Record<string, string>
): TournamentInstanceState {
  const reports = buildMatchInjuryReports(
    state,
    homeLineup,
    awayLineup,
    undefined,
    undefined
  );
  const persisted = userPersistedInjuriesFromReports(
    reports,
    userUniverseId,
    playerIsHome,
    userOrigins
  );

  let next = instance;
  if (persisted.length) next = applyInjuriesToTournament(next, persisted);

  const userLineup = playerIsHome ? homeLineup : awayLineup;
  const userBench = playerIsHome ? homeBench : awayBench;
  const userStamina = playerIsHome ? state.homeStamina : state.awayStamina;
  next = mergeTournamentStaminaAfterMatch(next, userStamina, userLineup, userBench);

  const userStats = playerIsHome ? state.homePlayerStats ?? {} : state.awayPlayerStats ?? {};
  const form = { ...next.playerForm };
  for (const s of userLineup) {
    if (!s.playerName) continue;
    const row = userStats[s.playerName];
    if (!row?.matchRating) continue;
    form[s.playerName] = applyFormDelta(form[s.playerName] ?? 0, formDeltaFromRating(row.matchRating));
  }
  return { ...next, playerForm: form };
}

export function tickTournamentAfterFixture(instance: TournamentInstanceState): TournamentInstanceState {
  return tickTournamentInjuries(instance);
}
