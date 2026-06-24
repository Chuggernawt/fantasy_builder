"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  FormationId,
  LineupSlot,
  MatchState,
  StatKey,
  TeamTactics,
  TeamSetup,
} from "@/lib/types";
import { DEFAULT_FORMATION } from "@/lib/formations";
import {
  emptyLineupForFormation,
  fillLineupRestRandom,
  pickRandomBench,
  randomFillLineup,
  remapLineupOnFormationChange,
  weightedPick,
} from "@/lib/lineup";
import { autoFillLineup, createInitialMatchState } from "@/lib/simulation";
import { commentaryId } from "@/lib/simulation-utils";
import { CAPTAIN_BOOST_TICKS, MATCH_BENCH_SIZE, MAX_MATCH_SUBS } from "@/lib/constants";
import { cpuPickTactics, defaultTeamTactics, formatTacticsCommentary } from "@/lib/tactics";
import { analyzeLineupChanges, pinSentOffPlayersInLineup, positionSwapAnnouncementLines, sentOffPlayerNames, subAnnouncementLines } from "@/lib/sub-utils";
import {
  applyPositionSwapStaminaPenalty,
  cpuHalftimeSubs,
  cpuChooseSubCount,
  refreshStaminaAfterLineupChange,
} from "@/lib/subs";
import { seedMatchPlayerStats } from "@/lib/background-match-stats";
import { getPlayer, getUniverse } from "@/lib/squads";
import { revealAllForPlayer, revealOneRandomStat, playersNotFullyRevealed, pickPlayerForRandomStatReveal } from "@/lib/reveal";
import type { RevealHighlight } from "@/lib/reveal";
import type { SeasonHonour, SeasonLength, SeasonState } from "@/lib/season-types";
import type { TournamentState } from "@/lib/tournament-types";
import {
  applyFixtureResult,
  isLocalTournamentChampion,
  simAllCpuFixturesInRound,
} from "@/lib/tournament";
import { resolveCupKnockoutMeta, resolveTournamentWinnerFromMatch } from "@/lib/tournament-match";
import { matchDecidedWinner } from "@/lib/penalty-shootout";
import { accumulateTournamentMatchStats } from "@/lib/tournament-stats";
import type { MpMatchMeta } from "@/lib/multiplayer-types";
import { getMultiplayerSession, clearMultiplayerSession } from "@/lib/multiplayer-session";
import {
  buildMatchCareerKey,
  emptyCareerStats,
  offlineTournamentWinKey,
  recordMatchInCareerStats,
  recordSeasonWinInCareerStats,
  recordTournamentWinInCareerStats,
  resolveCareerStatsMode,
  seasonWinKey,
  type PlayerCareerStats,
} from "@/lib/career-stats";
import {
  achievementFromOfflineTournament,
  applySquadUnlockAchievement,
  isSquadUnlocked,
  normalizeUnlockedSquads,
} from "@/lib/squad-unlocks";
import { playerRevealUniverses } from "@/lib/multiplayer-perspective";
import { resolvePlayerIsHome, getHomeMatchSetup, getAwayMatchSetup, getMyAndOpponentLineups, getMySquadPlayerNames, myPlayerStatsForMatch, myUniverseIdForMatch, resolveMyMatchSide } from "@/lib/player-side";
import {
  applySeasonChampionReveal,
  applyRedCardSuspension,
  buildSeasonSummary,
  buildSeasonMatchMeta,
  createSeason,
  getPlayerFixture,
  isPlayerSuspended,
  recordPlayerMatchFromState,
} from "@/lib/season";
import { resetSetPieceBudgetForHalf } from "@/lib/set-piece-interactive";
import { prepareCpuOpponentFromSeason, filterAvailableRosterEntries, isPlayerUnavailableForSeason } from "@/lib/season-injuries";
import { randomFillLineupFromRoster, fillLineupRestRandomFromRoster, pickRandomBenchFromRoster } from "@/lib/season-lite";
import { ensureSeasonRosters, getSeasonTeamRoster, rosterToOriginMap, sanitizeLineupForSeasonRoster, seasonRosterPlayerNames } from "@/lib/season-rosters";
import { executeSeasonSwap } from "@/lib/season-transfers";
import {
  continueSeasonCampaign as buildContinuedSeason,
  canContinueSeasonCampaign,
} from "@/lib/season-continue";
import {
  emptySeasonSaveSlots,
  type SeasonSaveSlotIndex,
  type SeasonSaveSlots,
} from "@/lib/season-saves";
import {
  finalizeMatchStateRatings,
} from "@/lib/match-finalize";
import { buildInstanceFormMap } from "@/lib/instance-form";
import {
  applySeasonMatchPersistence,
  applyTournamentMatchPersistence,
  buildMatchInjuryReports,
  tickTournamentAfterFixture,
} from "@/lib/persistent-match";
import { getSeasonTeamStamina, getTournamentSquadStamina } from "@/lib/squad-stamina";
import {
  emptyTournamentInstance,
  isPlayerInjuredOutForTournament,
  newTournamentInstanceKey,
  resolveTournamentCpuLineup,
  type TournamentInstanceState,
} from "@/lib/tournament-instance";
import { markInjuredPlayerSubbedOff } from "@/lib/injury-match";
import { cpuPickExtraTimeApproach, extraTimeLabel } from "@/lib/stoppage-time";
import type { ExtraTimeApproach } from "@/lib/types";

export interface SavedLineup {
  formationId: FormationId;
  lineup: LineupSlot[];
  matchBench: string[];
  plannedTactics?: TeamTactics;
  savedAt: string;
}

type PendingReveal =
  | {
      result: "draw";
      ownChoices: string[];
      message: string;
    }
  | {
      result: "win";
      ownChoices: string[];
      awayChoices: string[];
      message: string;
    }
  | {
      result: "loss";
      message: string;
    };

interface GameStore {
  selectedUniverseId: string | null;
  formationId: FormationId;
  lineup: LineupSlot[];
  matchBench: string[];
  opponentUniverseId: string | null;
  opponentFormationId: FormationId;
  opponentLineup: LineupSlot[];
  opponentBench: string[];
  matchState: MatchState | null;
  revealedStats: Record<string, StatKey[]>;
  pendingReveal: PendingReveal | null;
  revealHighlights: RevealHighlight[] | null;
  savedLineups: Record<string, SavedLineup>;
  season: SeasonState | null;
  seasonSaveSlots: SeasonSaveSlots;
  activeSeasonSlot: SeasonSaveSlotIndex | null;
  seasonHonours: SeasonHonour[];
  seasonActiveFixtureId: string | null;
  seasonPlayerIsHome: boolean;
  tournament: TournamentState | null;
  tournamentActiveFixtureId: string | null;
  mpMatchMeta: MpMatchMeta | null;
  /** Context of the last / current match for post-game routing. */
  lastMatchContext: "friendly" | "season" | "tournament" | null;
  /** @deprecated Legacy account form — season/tournament use instance-scoped form. */
  playerForm: Record<string, Record<string, number>>;
  /** Local injuries/form for the active offline tournament only. */
  tournamentInstance: TournamentInstanceState | null;
  /** Lifetime match / tournament career stats (in memory; persisted per account). */
  careerStats: PlayerCareerStats;
  /** Squads unlocked on the most recent season/tournament win (for finale banner). */
  recentSquadUnlocks: string[];
  /** Pre-match tactics — applied at kick-off (carries through unless changed at half time). */
  plannedTactics: TeamTactics;

  selectUniverse: (id: string) => void;
  setFormation: (id: FormationId) => void;
  setPlannedTactics: (tactics: TeamTactics) => void;
  setLineupSlot: (slotId: string, playerName: string | null) => void;
  swapLineupSlots: (slotA: string, slotB: string) => void;
  autoPickLineup: () => void;
  fillLineupRest: () => void;
  clearLineup: () => void;
  toggleMatchBenchPlayer: (playerName: string) => void;
  autoPickMatchBench: () => void;
  saveLineup: () => void;
  saveLineupSnapshot: (
    universeId: string,
    formationId: FormationId,
    lineup: LineupSlot[],
    matchBench: string[],
    plannedTactics?: TeamTactics
  ) => void;
  loadSavedLineup: () => boolean;
  loadLineupSnapshot: (universeId: string) => SavedLineup | null;
  hasSavedLineup: (universeId?: string) => boolean;
  setOpponent: (universeId: string) => void;
  startMatch: () => void;
  setMatchState: (state: MatchState | null) => void;
  openSubWindow: () => void;
  confirmSubs: (homeLineup: LineupSlot[], subsMade: number) => void;
  setHomeTactic: (tactics: TeamTactics) => void;
  setAwayTactic: (tactics: TeamTactics) => void;
  callHomeCaptain: (playerName: string) => void;
  callAwayCaptain: (playerName: string) => void;
  setMpMatchMeta: (meta: MpMatchMeta | null) => void;
  processMatchFinishReveal: () => void;
  confirmHalftime: (
    homeLineup: LineupSlot[],
    subsMade: number,
    tactics?: TeamTactics | null,
    captain?: string | null
  ) => void;
  confirmExtraTime: (approach: import("@/lib/types").ExtraTimeApproach) => void;
  chooseDrawReveal: (playerName: string) => void;
  chooseWinReveal: (ownPlayerName: string, awayPlayerName: string) => void;
  clearPendingReveal: () => void;
  isStatRevealed: (playerName: string, stat: StatKey) => boolean;
  isPlayerFullyRevealed: (playerName: string) => boolean;
  resetMatch: () => void;
  clearRecentSquadUnlocks: () => void;
  resetAll: () => void;
  startSeason: (userUniverseId: string, length: SeasonLength) => void;
  startSeasonInSlot: (
    slot: SeasonSaveSlotIndex,
    userUniverseId: string,
    length: SeasonLength
  ) => void;
  loadSeasonSlot: (slot: SeasonSaveSlotIndex) => boolean;
  saveSeasonSlot: () => void;
  continueSeason: () => boolean;
  abandonSeason: () => void;
  prepareSeasonMatch: () => boolean;
  setTournament: (tournament: TournamentState | null) => void;
  setTournamentActiveFixture: (fixtureId: string | null) => void;
  setCareerStats: (stats: PlayerCareerStats) => void;
  executeSeasonTransfer: (
    partnerTeamId: string,
    outgoing: import("@/lib/season-types").SeasonRosterEntry,
    incoming: import("@/lib/season-types").SeasonRosterEntry
  ) => { ok: boolean; error?: string };
}

function writeSeasonToSlot(
  slots: SeasonSaveSlots,
  slot: SeasonSaveSlotIndex,
  season: SeasonState
): SeasonSaveSlots {
  const next = [...slots] as SeasonSaveSlots;
  next[slot] = { season, savedAt: new Date().toISOString() };
  return next;
}

function mirrorSeasonPatchToSlot(
  get: () => GameStore,
  patch: Partial<GameStore>
): Partial<GameStore> {
  if (patch.season === undefined) return patch;
  const slot = get().activeSeasonSlot;
  const season = patch.season;
  if (slot == null || !season) return patch;
  return {
    ...patch,
    seasonSaveSlots: writeSeasonToSlot(get().seasonSaveSlots, slot, season),
  };
}

function cpuPickTacticForSide(formationId: FormationId): TeamTactics {
  return cpuPickTactics(formationId);
}

function cpuPickCaptain(lineup: LineupSlot[], universeId: string): string | null {
  const candidates = lineup
    .map((s) => {
      const p = s.playerName ? getPlayer(universeId, s.playerName) : null;
      return p ? { name: p.name, ovr: p.ovr } : null;
    })
    .filter(Boolean) as { name: string; ovr: number }[];
  return weightedPick(candidates, (c) => c.ovr)?.name ?? null;
}

function isDraftPlayerBlocked(
  get: () => GameStore,
  playerName: string,
  originUniverseId: string
): boolean {
  const season = get().season;
  const fixtureId = get().seasonActiveFixtureId;
  const tourFixture = get().tournamentActiveFixtureId;
  const tourInstance = get().tournamentInstance;

  if (season?.status === "active" && fixtureId) {
    return isPlayerUnavailableForSeason(season, originUniverseId, playerName);
  }
  if (tourFixture && tourInstance) {
    return isPlayerInjuredOutForTournament(tourInstance, playerName);
  }
  return false;
}

function playersRemovedFromLineup(oldLineup: LineupSlot[], newLineup: LineupSlot[]): string[] {
  const stillOn = new Set(newLineup.map((s) => s.playerName).filter(Boolean));
  return oldLineup
    .map((s) => s.playerName)
    .filter((n): n is string => !!n && !stillOn.has(n));
}

function applyInjurySubsToState(
  state: MatchState,
  team: "home" | "away",
  removed: string[]
): MatchState {
  let next = state;
  for (const name of removed) {
    next = markInjuredPlayerSubbedOff(next, team, name);
  }
  return next;
}

function applyCpuSubsForSide(
  state: MatchState,
  side: "home" | "away",
  setup: {
    universeId: string;
    formationId: FormationId;
    lineup: LineupSlot[];
    bench: string[];
  },
  revealedStats: Record<string, StatKey[]>
): { lineup: LineupSlot[]; subsMade: number; stamina: Record<string, number> } {
  const subsUsed = side === "home" ? state.homeSubsUsed : state.awaySubsUsed;
  const staminaMap = side === "home" ? state.homeStamina : state.awayStamina;
  const remaining = MAX_MATCH_SUBS - subsUsed;
  if (remaining <= 0) {
    return { lineup: setup.lineup, subsMade: 0, stamina: staminaMap };
  }
  const teamSetup = {
    universeId: setup.universeId,
    formationId: setup.formationId,
    lineup: setup.lineup,
    bench: setup.bench,
  };
  const subsBudget = cpuChooseSubCount(setup.lineup, staminaMap, remaining);
  const playerStats = side === "home" ? state.homePlayerStats : state.awayPlayerStats;
  const sentOff = sentOffPlayerNames(playerStats);
  const newLineup = cpuHalftimeSubs(
    teamSetup,
    staminaMap,
    revealedStats,
    subsBudget,
    sentOff
  );
  const pinnedLineup = pinSentOffPlayersInLineup(setup.lineup, newLineup, sentOff);
  let subsMade = pinnedLineup.filter(
    (s, i) => s.playerName !== setup.lineup[i]?.playerName
  ).length;
  subsMade = Math.min(subsMade, remaining);
  const stamina = refreshStaminaAfterLineupChange(setup.lineup, pinnedLineup, staminaMap, {
    persistentMatch: !!state.persistentMatchMode,
  });
  return { lineup: pinnedLineup, subsMade, stamina };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      selectedUniverseId: null,
      formationId: DEFAULT_FORMATION,
      lineup: emptyLineupForFormation(DEFAULT_FORMATION),
      matchBench: [],
      opponentUniverseId: "fighting-legends",
      opponentFormationId: DEFAULT_FORMATION,
      opponentLineup: [],
      opponentBench: [],
      matchState: null,
      revealedStats: {},
      pendingReveal: null,
      revealHighlights: null,
      savedLineups: {},
      season: null,
      seasonSaveSlots: emptySeasonSaveSlots(),
      activeSeasonSlot: null,
      seasonHonours: [],
      seasonActiveFixtureId: null,
      seasonPlayerIsHome: true,
      tournament: null,
      tournamentActiveFixtureId: null,
      mpMatchMeta: null,
      lastMatchContext: null,
      playerForm: {},
      tournamentInstance: null,
      careerStats: emptyCareerStats(),
      recentSquadUnlocks: [],
      plannedTactics: defaultTeamTactics(),

      selectUniverse: (id) => {
        set({
          selectedUniverseId: id,
          lineup: emptyLineupForFormation(get().formationId),
          matchBench: [],
          seasonActiveFixtureId: null,
          seasonPlayerIsHome: true,
        });
      },

      setFormation: (formationId) => {
        set({
          formationId,
          lineup: remapLineupOnFormationChange(get().lineup, formationId),
        });
      },

      setPlannedTactics: (tactics) => set({ plannedTactics: tactics }),

      setLineupSlot: (slotId, playerName) => {
        if (playerName) {
          const season = get().season;
          const uni = get().selectedUniverseId;
          const origins = season?.rosters && uni
            ? rosterToOriginMap(getSeasonTeamRoster(season, uni))
            : {};
          const origin = origins[playerName] ?? uni ?? "";
          if (origin && isDraftPlayerBlocked(get, playerName, origin)) return;
        }
        const lineup = get().lineup.map((s) => {
          if (s.slotId === slotId) return { ...s, playerName };
          if (playerName && s.playerName === playerName) return { ...s, playerName: null };
          return s;
        });
        const matchBench = get().matchBench.filter((n) => n !== playerName);
        set({ lineup, matchBench });
      },

      swapLineupSlots: (slotA, slotB) => {
        const lineup = get().lineup;
        const a = lineup.find((s) => s.slotId === slotA);
        const b = lineup.find((s) => s.slotId === slotB);
        if (!a || !b) return;
        set({
          lineup: lineup.map((s) => {
            if (s.slotId === slotA) return { ...s, playerName: b.playerName };
            if (s.slotId === slotB) return { ...s, playerName: a.playerName };
            return s;
          }),
        });
      },

      autoPickLineup: () => {
        const { selectedUniverseId, formationId, season, seasonActiveFixtureId } = get();
        if (!selectedUniverseId) return;
        if (season?.status === "active" && season.rosters && seasonActiveFixtureId) {
          const entries = filterAvailableRosterEntries(season, selectedUniverseId);
          const lineup = randomFillLineupFromRoster(entries, formationId);
          set({
            lineup,
            matchBench: pickRandomBenchFromRoster(entries, lineup),
          });
          return;
        }
        const lineup = randomFillLineup(selectedUniverseId, formationId);
        set({
          lineup,
          matchBench: pickRandomBench(selectedUniverseId, lineup),
        });
      },

      fillLineupRest: () => {
        const { selectedUniverseId, lineup, season, seasonActiveFixtureId } = get();
        if (!selectedUniverseId) return;
        if (season?.status === "active" && season.rosters && seasonActiveFixtureId) {
          const entries = filterAvailableRosterEntries(season, selectedUniverseId);
          set({ lineup: fillLineupRestRandomFromRoster(lineup, entries) });
          return;
        }
        set({ lineup: fillLineupRestRandom(lineup, selectedUniverseId) });
      },

      clearLineup: () => {
        set({
          lineup: emptyLineupForFormation(get().formationId),
          matchBench: [],
        });
      },

      toggleMatchBenchPlayer: (playerName) => {
        const { matchBench, lineup, selectedUniverseId, season } = get();
        if (!selectedUniverseId) return;
        if (lineup.some((s) => s.playerName === playerName)) return;
        const origins =
          season?.rosters && selectedUniverseId
            ? rosterToOriginMap(getSeasonTeamRoster(season, selectedUniverseId))
            : {};
        const origin = origins[playerName] ?? selectedUniverseId;
        if (isDraftPlayerBlocked(get, playerName, origin)) return;
        if (matchBench.includes(playerName)) {
          set({ matchBench: matchBench.filter((n) => n !== playerName) });
          return;
        }
        if (matchBench.length >= MATCH_BENCH_SIZE) return;
        set({ matchBench: [...matchBench, playerName] });
      },

      autoPickMatchBench: () => {
        const { selectedUniverseId, lineup, season, seasonActiveFixtureId, tournamentActiveFixtureId, tournamentInstance } = get();
        if (!selectedUniverseId) return;
        if (season?.status === "active" && season.rosters && seasonActiveFixtureId) {
          const entries = filterAvailableRosterEntries(season, selectedUniverseId);
          set({ matchBench: pickRandomBenchFromRoster(entries, lineup) });
          return;
        }
        if (tournamentActiveFixtureId && tournamentInstance) {
          const uni = getUniverse(selectedUniverseId);
          const unavailable = new Set(
            Object.values(tournamentInstance.injuries)
              .filter((i) => i.gamesOut > 0)
              .map((i) => i.playerName)
          );
          const onPitch = new Set(lineup.map((s) => s.playerName).filter(Boolean));
          const pool =
            uni?.players.filter((p) => !onPitch.has(p.name) && !unavailable.has(p.name)) ?? [];
          set({
            matchBench: [...pool]
              .sort(() => Math.random() - 0.5)
              .slice(0, MATCH_BENCH_SIZE)
              .map((p) => p.name),
          });
          return;
        }
        set({ matchBench: pickRandomBench(selectedUniverseId, lineup) });
      },

      saveLineupSnapshot: (universeId, formationId, lineup, matchBench, plannedTactics) => {
        if (!universeId) return;
        set({
          savedLineups: {
            ...get().savedLineups,
            [universeId]: {
              formationId,
              lineup,
              matchBench,
              plannedTactics: plannedTactics ?? get().plannedTactics,
              savedAt: new Date().toISOString(),
            },
          },
        });
      },

      loadLineupSnapshot: (universeId) => {
        if (!universeId) return null;
        return get().savedLineups[universeId] ?? null;
      },

      saveLineup: () => {
        const { selectedUniverseId, formationId, lineup, matchBench, plannedTactics } = get();
        if (!selectedUniverseId) return;
        set({
          savedLineups: {
            ...get().savedLineups,
            [selectedUniverseId]: {
              formationId,
              lineup,
              matchBench,
              plannedTactics,
              savedAt: new Date().toISOString(),
            },
          },
        });
      },

      loadSavedLineup: () => {
        const { selectedUniverseId, savedLineups, season } = get();
        if (!selectedUniverseId) return false;
        const saved = savedLineups[selectedUniverseId];
        if (!saved) return false;
        const sanitized = sanitizeLineupForSeasonRoster(
          season,
          selectedUniverseId,
          saved.lineup,
          saved.matchBench ?? []
        );
        set({
          formationId: saved.formationId,
          lineup: sanitized.lineup,
          matchBench: sanitized.matchBench,
          plannedTactics: saved.plannedTactics ?? get().plannedTactics,
        });
        return true;
      },

      hasSavedLineup: (universeId) => {
        const id = universeId ?? get().selectedUniverseId;
        return !!(id && get().savedLineups[id]);
      },

      setOpponent: (universeId) => {
        const oppLineup = autoFillLineup(universeId, get().opponentFormationId);
        set({
          opponentUniverseId: universeId,
          opponentLineup: oppLineup,
          opponentBench: pickRandomBench(universeId, oppLineup),
        });
      },

      startMatch: () => {
        const {
          selectedUniverseId,
          formationId,
          lineup,
          matchBench,
          opponentUniverseId,
          opponentFormationId,
        } = get();
        if (!selectedUniverseId || !opponentUniverseId) return;
        if (matchBench.length !== MATCH_BENCH_SIZE) return;

        const season = get().season;
        const fixtureId = get().seasonActiveFixtureId;
        const isSeasonMatch = season?.status === "active" && !!fixtureId;
        const isTournamentMatch = !!get().tournamentActiveFixtureId;
        const persistentMatch = isSeasonMatch || isTournamentMatch;
        if (isSeasonMatch && season) {
          const userOrigins = season.rosters
            ? rosterToOriginMap(getSeasonTeamRoster(season, selectedUniverseId))
            : {};
          const rosterNames = season.rosters
            ? seasonRosterPlayerNames(season, selectedUniverseId)
            : null;
          if (rosterNames) {
            const lineupValid = lineup.every(
              (s) => !s.playerName || rosterNames.has(s.playerName)
            );
            const benchValid = matchBench.every((n) => rosterNames.has(n));
            if (!lineupValid || !benchValid) return;
          }
          const blocked = [...lineup, ...matchBench.map((n) => ({ playerName: n }))].some((s) => {
            if (!s.playerName) return false;
            const origin = userOrigins[s.playerName] ?? selectedUniverseId;
            return isPlayerUnavailableForSeason(season, origin, s.playerName);
          });
          if (blocked) return;
        }
        if (isTournamentMatch && get().tournamentInstance) {
          const inst = get().tournamentInstance!;
          const blocked = [...lineup, ...matchBench.map((n) => ({ playerName: n }))].some(
            (s) => s.playerName && isPlayerInjuredOutForTournament(inst, s.playerName)
          );
          if (blocked) return;
        }

        const playerIsHome =
          isSeasonMatch || isTournamentMatch ? get().seasonPlayerIsHome : true;
        const oppLineup =
          get().opponentLineup.length === 11
            ? get().opponentLineup
            : autoFillLineup(opponentUniverseId, opponentFormationId);
        const oppBench =
          get().opponentBench.length === MATCH_BENCH_SIZE
            ? get().opponentBench
            : pickRandomBench(opponentUniverseId, oppLineup);

        const playerOrigins =
          isSeasonMatch && season?.rosters
            ? rosterToOriginMap(getSeasonTeamRoster(season, selectedUniverseId))
            : undefined;
        const oppOrigins =
          isSeasonMatch && season?.rosters
            ? rosterToOriginMap(getSeasonTeamRoster(season, opponentUniverseId))
            : undefined;

        const playerSetup = {
          universeId: selectedUniverseId,
          formationId,
          lineup,
          bench: matchBench,
          playerOrigins,
        };
        const oppSetup = {
          universeId: opponentUniverseId,
          formationId: opponentFormationId,
          lineup: oppLineup,
          bench: oppBench,
          playerOrigins: oppOrigins,
        };

        const seasonMeta =
          isSeasonMatch && season ? buildSeasonMatchMeta(season) ?? undefined : undefined;

        const tourFixtureId = get().tournamentActiveFixtureId;
        const tournamentMeta = resolveCupKnockoutMeta({
          tournamentActiveFixtureId: tourFixtureId,
          tournament: get().tournament,
          mpFixture: get().mpMatchMeta?.tournamentFixture,
        });

        const homeUni = playerIsHome ? selectedUniverseId : opponentUniverseId;
        const awayUni = playerIsHome ? opponentUniverseId : selectedUniverseId;
        const homeLineup = playerIsHome ? lineup : oppLineup;
        const awayLineup = playerIsHome ? oppLineup : lineup;
        let formMap: Record<string, number> = {};
        if (persistentMatch) {
          if (isSeasonMatch && season) {
            formMap = buildInstanceFormMap(
              homeUni,
              awayUni,
              homeLineup,
              awayLineup,
              season.playerForm
            );
          } else if (isTournamentMatch && get().tournamentInstance) {
            const tf = get().tournamentInstance!.playerForm;
            for (const s of homeLineup) {
              if (s.playerName && homeUni === selectedUniverseId) {
                formMap[s.playerName] = tf[s.playerName] ?? 0;
              }
            }
            for (const s of awayLineup) {
              if (s.playerName) {
                if (awayUni === selectedUniverseId) formMap[s.playerName] = tf[s.playerName] ?? 0;
                else if (homeUni === selectedUniverseId) continue;
                else formMap[s.playerName] = 0;
              }
            }
            for (const s of [...homeLineup, ...awayLineup]) {
              if (!s.playerName) continue;
              if (s.playerName in formMap) continue;
              formMap[s.playerName] = 0;
            }
          }
        }

        let homeSquadStamina: Record<string, number> | undefined;
        let awaySquadStamina: Record<string, number> | undefined;
        if (persistentMatch) {
          if (isSeasonMatch && season) {
            homeSquadStamina = getSeasonTeamStamina(season, homeUni);
            awaySquadStamina = getSeasonTeamStamina(season, awayUni);
          } else if (isTournamentMatch && get().tournamentInstance && selectedUniverseId) {
            const userNames =
              getUniverse(selectedUniverseId)?.players.map((p) => p.name) ?? [];
            const tourStamina = getTournamentSquadStamina(
              get().tournamentInstance!,
              userNames
            );
            if (homeUni === selectedUniverseId) homeSquadStamina = tourStamina;
            if (awayUni === selectedUniverseId) awaySquadStamina = tourStamina;
          }
        }

        const baseOpts = {
          seasonMeta,
          playerForm: formMap,
          persistentMatchMode: persistentMatch,
          homeSquadStamina,
          awaySquadStamina,
        };
        const base = playerIsHome
          ? createInitialMatchState(playerSetup, oppSetup, baseOpts)
          : createInitialMatchState(oppSetup, playerSetup, baseOpts);

        const plannedTactics = get().plannedTactics;
        const cpuTactic = cpuPickTacticForSide(oppSetup.formationId);
        const cpuCaptain = cpuPickCaptain(oppLineup, opponentUniverseId);

        set({
          opponentLineup: oppLineup,
          opponentBench: oppBench,
          pendingReveal: null,
          revealHighlights: null,
          lastMatchContext: tourFixtureId
            ? "tournament"
            : isSeasonMatch
              ? "season"
              : "friendly",
          matchState: {
            ...base,
            localPlayerSide: playerIsHome ? "home" : "away",
            tournamentMeta,
            ...(playerIsHome
              ? {
                  homeTactics: plannedTactics,
                  homeTacticHalf: 0,
                  awayTactics: cpuTactic,
                  awayTacticHalf: 1,
                  awayCaptain: cpuCaptain,
                  awayCaptainHalf: 1,
                  awayCaptainBoostTicks: CAPTAIN_BOOST_TICKS,
                }
              : {
                  awayTactics: plannedTactics,
                  awayTacticHalf: 0,
                  homeTactics: cpuTactic,
                  homeTacticHalf: 1,
                  homeCaptain: cpuCaptain,
                  homeCaptainHalf: 1,
                  homeCaptainBoostTicks: CAPTAIN_BOOST_TICKS,
                }),
          },
        });
      },

      setMatchState: (matchState) => {
        const prev = get().matchState;
        if (!matchState) return set({ matchState: null });

        let finalized = matchState;
        if (prev?.status !== "finished" && matchState.status === "finished" && !matchState.manOfTheMatch) {
          const homeSetup = getHomeMatchSetup();
          const awaySetup = getAwayMatchSetup();
          if (homeSetup && awaySetup) {
            finalized = finalizeMatchStateRatings(
              matchState,
              homeSetup.lineup,
              awaySetup.lineup
            );
          }
        }

        let revealedStats = get().revealedStats;
        let pendingReveal: PendingReveal | null = get().pendingReveal;
        let revealHighlights: RevealHighlight[] | null = get().revealHighlights;
        const patch: Partial<GameStore> = { matchState: finalized };

        if (prev?.status !== "finished" && finalized.status === "finished") {
          const homeSetup = getHomeMatchSetup();
          const awaySetup = getAwayMatchSetup();
          if (homeSetup && awaySetup && finalized.persistentMatchMode) {
            const reports = buildMatchInjuryReports(
              finalized,
              homeSetup.lineup,
              awaySetup.lineup,
              homeSetup.playerOrigins,
              awaySetup.playerOrigins
            );
            finalized = { ...finalized, injuryReports: reports };
            patch.matchState = finalized;
          }

          const playerIsHome =
            (finalized.localPlayerSide ??
              (get().seasonPlayerIsHome ? "home" : "away")) === "home";
          const { myLineup, oppLineup } = getMyAndOpponentLineups();
          const ownPlayed = myLineup
            .map((s) => s.playerName)
            .filter((p): p is string => !!p);
          const oppPlayed = oppLineup
            .map((s) => s.playerName)
            .filter((p): p is string => !!p);
          const playerUniId = myUniverseIdForMatch(finalized);
          const oppUniId = playerIsHome
            ? finalized.awayUniverseId
            : finalized.homeUniverseId;
          const playerScore = playerIsHome ? finalized.score.home : finalized.score.away;
          const oppScore = playerIsHome ? finalized.score.away : finalized.score.home;
          const decided = matchDecidedWinner(finalized);
          const playerWon = decided === (playerIsHome ? "home" : "away");
          const playerLost = decided === (playerIsHome ? "away" : "home");
          const isRegulationDraw = finalized.score.home === finalized.score.away;
          let careerPlayerScore = playerScore;
          let careerOppScore = oppScore;
          if (finalized.penaltyShootout && isRegulationDraw) {
            const homeWonPens = decided === "home";
            const wonPens = playerIsHome ? homeWonPens : !homeWonPens;
            careerPlayerScore = wonPens ? 1 : 0;
            careerOppScore = wonPens ? 0 : 1;
          }

          if (playerWon) {
            const ownRevealable = playersNotFullyRevealed(ownPlayed, revealedStats);
            const oppRevealable = playersNotFullyRevealed(oppPlayed, revealedStats);
            if (ownRevealable.length > 0 || oppRevealable.length > 0) {
              pendingReveal = {
                result: "win",
                ownChoices: ownRevealable,
                awayChoices: oppRevealable,
                message:
                  ownRevealable.length && oppRevealable.length
                    ? "Win reward: reveal one of your players and one opponent you faced."
                    : ownRevealable.length
                      ? "Win reward: reveal one of your players."
                      : "Win reward: reveal one opponent you faced.",
              };
            }
          } else if (decided === "draw") {
            const ownRevealable = playersNotFullyRevealed(ownPlayed, revealedStats);
            if (ownRevealable.length > 0) {
              pendingReveal = {
                result: "draw",
                ownChoices: ownRevealable,
                message: "Draw reward: pick one of your used players to fully reveal.",
              };
            }
          } else if (ownPlayed.length > 0) {
            const pick = pickPlayerForRandomStatReveal(ownPlayed, revealedStats);
            if (pick) {
              const { next, stat } = revealOneRandomStat(revealedStats, pick);
              revealedStats = next;
              pendingReveal = {
                result: "loss",
                message: `Loss: random reveal unlocked ${pick}'s ${stat.toUpperCase()}.`,
              };
              revealHighlights = [
                {
                  universeId: playerUniId,
                  playerName: pick,
                  mode: "single",
                  stat,
                },
              ];
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("fb:sfx", { detail: { kind: "reveal" } }));
              }
            }
          }

          const season = get().season;
          const fixtureId = get().seasonActiveFixtureId;
          if (season?.status === "active" && fixtureId) {
            const fixture = season.fixtures.find((f) => f.id === fixtureId);
            if (fixture) {
              const homeScore = finalized.score.home;
              const awayScore = finalized.score.away;
              const homeStats = finalized.homePlayerStats;
              const awayStats = finalized.awayPlayerStats;
              let nextSeason = season;
              if (homeSetup && awaySetup && finalized.persistentMatchMode) {
                nextSeason = applySeasonMatchPersistence(
                  nextSeason,
                  finalized,
                  homeSetup.lineup,
                  awaySetup.lineup,
                  homeSetup.bench,
                  awaySetup.bench,
                  homeSetup.playerOrigins,
                  awaySetup.playerOrigins
                );
              }
              nextSeason = recordPlayerMatchFromState(
                nextSeason,
                fixture,
                homeScore,
                awayScore,
                homeStats,
                awayStats
              );
              const userStats = playerIsHome
                ? finalized.homePlayerStats
                : finalized.awayPlayerStats;
              for (const [name, row] of Object.entries(userStats)) {
                if (row.redCards > 0) {
                  const userRoster = nextSeason.rosters
                    ? getSeasonTeamRoster(nextSeason, nextSeason.userUniverseId)
                    : [];
                  const origin =
                    userRoster.find((e) => e.playerName === name)?.universeId ??
                    nextSeason.userUniverseId;
                  nextSeason = applyRedCardSuspension(nextSeason, origin, name);
                }
              }
              let seasonHonours = get().seasonHonours;
              if (nextSeason.status === "finished") {
                const summary = buildSeasonSummary(nextSeason);
                if (summary) seasonHonours = [...seasonHonours, summary];
                if (nextSeason.championId === nextSeason.userUniverseId) {
                  const rosterNames = getSeasonTeamRoster(nextSeason, nextSeason.userUniverseId).map(
                    (e) => e.playerName
                  );
                  revealedStats = applySeasonChampionReveal(
                    revealedStats,
                    nextSeason.userUniverseId,
                    nextSeason.length,
                    true,
                    rosterNames
                  );
                }
              }
              patch.season = nextSeason;
              patch.seasonHonours = seasonHonours;
              patch.seasonActiveFixtureId = null;
            }
          }

          const tourFixtureId = get().tournamentActiveFixtureId;
          let tournament = get().tournament;
          const prevTournamentPhase = tournament?.phase;
          if (tournament && tourFixtureId && finalized && homeSetup && awaySetup) {
            const playerIsHome =
              (finalized.localPlayerSide ??
                (get().seasonPlayerIsHome ? "home" : "away")) === "home";
            let tourInstance = get().tournamentInstance;
            if (tourInstance && finalized.persistentMatchMode) {
              tourInstance = applyTournamentMatchPersistence(
                tourInstance,
                finalized,
                get().selectedUniverseId ?? finalized.homeUniverseId,
                homeSetup.lineup,
                awaySetup.lineup,
                homeSetup.bench,
                awaySetup.bench,
                playerIsHome,
                homeSetup.playerOrigins ?? awaySetup.playerOrigins
              );
              tourInstance = tickTournamentAfterFixture(tourInstance);
              patch.tournamentInstance = tourInstance;
            }
            const result = resolveTournamentWinnerFromMatch(
              tournament,
              tourFixtureId,
              finalized
            );
            if (result) {
              tournament = accumulateTournamentMatchStats(tournament, tourFixtureId, finalized);
              tournament = applyFixtureResult(tournament, tourFixtureId, result);
              tournament = simAllCpuFixturesInRound(tournament);
              patch.tournament = tournament;
              patch.tournamentActiveFixtureId = null;
            }
          }

          const userStats = myPlayerStatsForMatch(finalized);
          const squadPlayerNames = getMySquadPlayerNames();
          const careerMode = resolveCareerStatsMode(get().mpMatchMeta, get().lastMatchContext);
          const mpSession = getMultiplayerSession();
          const mpMeta = get().mpMatchMeta;
          const scopeId =
            mpSession?.roomId ??
            (mpMeta?.parentTournamentRoomId && mpMeta.tournamentFixture?.fixtureId
              ? `tour:${mpMeta.parentTournamentRoomId}:${mpMeta.tournamentFixture.fixtureId}`
              : get().tournamentActiveFixtureId
                ? `offline-tour:${get().tournamentActiveFixtureId}`
                : get().seasonActiveFixtureId
                  ? `offline-season:${get().seasonActiveFixtureId}`
                  : `local:${playerUniId}:${finalized.score.home}-${finalized.score.away}`);
          const matchKey = buildMatchCareerKey({
            mode: careerMode,
            scopeId,
            universeId: playerUniId,
            playerScore: careerPlayerScore,
            oppScore: careerOppScore,
            homeScore: finalized.score.home,
            awayScore: finalized.score.away,
            commentaryLength: finalized.commentary.length,
          });
          const prevCareerStats = get().careerStats;
          let nextCareerStats = recordMatchInCareerStats(prevCareerStats, careerMode, {
            universeId: playerUniId,
            playerScore: careerPlayerScore,
            oppScore: careerOppScore,
            playerStats: userStats ?? {},
            matchKey,
            squadPlayerNames,
          });

          const recentUnlocks: string[] = [];

          const finishedSeason = patch.season;
          const prevSeason = get().season;
          if (
            finishedSeason?.status === "finished" &&
            prevSeason?.status !== "finished" &&
            finishedSeason.championId === finishedSeason.userUniverseId
          ) {
            const sKey = seasonWinKey(finishedSeason);
            const wasNewSeasonWin = !prevCareerStats.seasonWinKeys.includes(sKey);
            nextCareerStats = recordSeasonWinInCareerStats(nextCareerStats, sKey);
            if (wasNewSeasonWin) {
              const unlocked = applySquadUnlockAchievement(nextCareerStats, "offline_season");
              nextCareerStats = unlocked.stats;
              recentUnlocks.push(...unlocked.newlyUnlocked);
            }
          }

          if (
            tournament?.phase === "finished" &&
            prevTournamentPhase !== "finished" &&
            isLocalTournamentChampion(tournament)
          ) {
            const tKey = offlineTournamentWinKey(tournament);
            const wasNewTournamentWin = !prevCareerStats.tournamentWinKeys.includes(tKey);
            nextCareerStats = recordTournamentWinInCareerStats(nextCareerStats, tKey, false);
            if (wasNewTournamentWin) {
              const achievement = achievementFromOfflineTournament(tournament.format);
              if (achievement) {
                const unlocked = applySquadUnlockAchievement(nextCareerStats, achievement);
                nextCareerStats = unlocked.stats;
                recentUnlocks.push(...unlocked.newlyUnlocked);
              }
            }
          }

          patch.careerStats = nextCareerStats;
          if (recentUnlocks.length) {
            patch.recentSquadUnlocks = recentUnlocks;
          }

          patch.revealedStats = revealedStats;
          patch.pendingReveal = pendingReveal;
          patch.revealHighlights = revealHighlights;
        }

        set(mirrorSeasonPatchToSlot(get, patch));
      },

      openSubWindow: () => {
        const state = get().matchState;
        if (!state || state.status !== "running") return;
        const playerIsHome = resolvePlayerIsHome();
        const subsUsed = playerIsHome ? state.homeSubsUsed : state.awaySubsUsed;
        if (subsUsed >= MAX_MATCH_SUBS) return;
        set({ matchState: { ...state, status: "sub_window" } });
      },

      confirmSubs: (playerLineup, _subsMade) => {
        const state = get().matchState;
        const {
          opponentUniverseId,
          opponentFormationId,
          opponentLineup,
          opponentBench,
          lineup,
          matchBench,
        } = get();
        if (!state || state.status !== "sub_window" || !opponentUniverseId) return;

        const playerIsHome = resolvePlayerIsHome();
        const playerSide = playerIsHome ? "home" : "away";
        const cpuSide = playerIsHome ? "away" : "home";
        const oldPlayerLineup = lineup;
        const playerStats = playerIsHome ? state.homePlayerStats : state.awayPlayerStats;
        const pinnedPlayerLineup = pinSentOffPlayersInLineup(
          oldPlayerLineup,
          playerLineup,
          sentOffPlayerNames(playerStats)
        );
        const swapAnalysis = analyzeLineupChanges(oldPlayerLineup, pinnedPlayerLineup, matchBench);
        const subsMade = swapAnalysis.subs;
        const persistentSubs = !!state.persistentMatchMode;
        let playerStamina = refreshStaminaAfterLineupChange(
          oldPlayerLineup,
          pinnedPlayerLineup,
          playerIsHome ? state.homeStamina : state.awayStamina,
          { persistentMatch: persistentSubs }
        );
        playerStamina = applyPositionSwapStaminaPenalty(
          playerStamina,
          swapAnalysis.positionSwappedPlayers
        );

        const minute =
          state.half === 1
            ? Math.round((state.tick / state.ticksPerHalf) * 45)
            : 45 + Math.round((state.tick / state.ticksPerHalf) * 45);

        const cpuResult = applyCpuSubsForSide(
          state,
          cpuSide,
          {
            universeId: opponentUniverseId,
            formationId: opponentFormationId,
            lineup: opponentLineup,
            bench: opponentBench,
          },
          get().revealedStats
        );

        const playerTeamLabel = playerIsHome ? "Home" : "Away";
        const cpuTeamLabel = playerIsHome ? "Away" : "Home";
        const subEvents = subAnnouncementLines(oldPlayerLineup, pinnedPlayerLineup, playerTeamLabel).map(
          (text) => ({
            id: commentaryId(),
            minute,
            half: state.half,
            type: "substitution" as const,
            text,
            team: playerSide as "home" | "away",
          })
        );
        const swapEvents = positionSwapAnnouncementLines(
          oldPlayerLineup,
          pinnedPlayerLineup,
          matchBench,
          playerTeamLabel
        ).map((text) => ({
          id: commentaryId(),
          minute,
          half: state.half,
          type: "info" as const,
          text,
          team: playerSide as "home" | "away",
        }));
        const cpuSubEvents = subAnnouncementLines(opponentLineup, cpuResult.lineup, cpuTeamLabel).map(
          (text) => ({
            id: commentaryId(),
            minute,
            half: state.half,
            type: "substitution" as const,
            text,
            team: cpuSide as "home" | "away",
          })
        );

        const homeLineupFinal = playerIsHome ? pinnedPlayerLineup : cpuResult.lineup;
        const awayLineupFinal = playerIsHome ? cpuResult.lineup : pinnedPlayerLineup;
        const seededStats = seedMatchPlayerStats(
          homeLineupFinal,
          awayLineupFinal,
          state.homePlayerStats,
          state.awayPlayerStats
        );

        let nextMatchState: MatchState = {
          ...state,
          status: "running",
          homeStamina: playerIsHome ? playerStamina : cpuResult.stamina,
          awayStamina: playerIsHome ? cpuResult.stamina : playerStamina,
          homeSubsUsed:
            state.homeSubsUsed + (playerIsHome ? subsMade : cpuResult.subsMade),
          awaySubsUsed:
            state.awaySubsUsed + (playerIsHome ? cpuResult.subsMade : subsMade),
          homePlayerStats: seededStats.homePlayerStats,
          awayPlayerStats: seededStats.awayPlayerStats,
          commentary: [...state.commentary, ...subEvents, ...swapEvents, ...cpuSubEvents],
        };
        nextMatchState = applyInjurySubsToState(
          nextMatchState,
          playerSide,
          playersRemovedFromLineup(oldPlayerLineup, pinnedPlayerLineup)
        );
        nextMatchState = applyInjurySubsToState(
          nextMatchState,
          cpuSide,
          playersRemovedFromLineup(opponentLineup, cpuResult.lineup)
        );

        set({
          lineup: pinnedPlayerLineup,
          opponentLineup: cpuResult.lineup,
          matchState: nextMatchState,
        });
      },

      setHomeTactic: (tactics) => {
        const state = get().matchState;
        if (!state || state.status !== "running") return;
        if (state.half === 1 && state.homeTacticHalf === 1) return;
        if (state.half === 2 && state.homeTacticHalf === 2) return;
        set({
          matchState: {
            ...state,
            homeTactics: tactics,
            homeTacticHalf: state.half,
            commentary: [
              ...state.commentary,
              {
                id: commentaryId(),
                minute: Math.round((state.tick / state.ticksPerHalf) * 45),
                half: state.half,
                type: "info",
                text: formatTacticsCommentary("Home", tactics),
                team: "home",
              },
            ],
          },
        });
      },

      callHomeCaptain: (playerName) => {
        const state = get().matchState;
        if (!state || (state.status !== "running" && state.status !== "sub_window")) return;
        if (state.homeCaptainHalf === state.half) return;
        set({
          matchState: {
            ...state,
            homeCaptain: playerName,
            homeCaptainHalf: state.half,
            homeCaptainBoostTicks: CAPTAIN_BOOST_TICKS,
            commentary: [
              ...state.commentary,
              {
                id: commentaryId(),
                minute:
                  state.half === 1
                    ? Math.round((state.tick / state.ticksPerHalf) * 45)
                    : 45 + Math.round((state.tick / state.ticksPerHalf) * 45),
                half: state.half,
                type: "info",
                text: `CAPTAIN'S CALL — ${playerName} takes charge!`,
                team: "home",
                playerName,
              },
            ],
          },
        });
      },

      setAwayTactic: (tactics) => {
        const state = get().matchState;
        if (!state || state.status !== "running") return;
        if (state.half === 1 && state.awayTacticHalf === 1) return;
        if (state.half === 2 && state.awayTacticHalf === 2) return;
        set({
          matchState: {
            ...state,
            awayTactics: tactics,
            awayTacticHalf: state.half,
            commentary: [
              ...state.commentary,
              {
                id: commentaryId(),
                minute: Math.round((state.tick / state.ticksPerHalf) * 45),
                half: state.half,
                type: "info",
                text: formatTacticsCommentary("Away", tactics),
                team: "away",
              },
            ],
          },
        });
      },

      callAwayCaptain: (playerName) => {
        const state = get().matchState;
        if (!state || (state.status !== "running" && state.status !== "sub_window")) return;
        if (state.awayCaptainHalf === state.half) return;
        set({
          matchState: {
            ...state,
            awayCaptain: playerName,
            awayCaptainHalf: state.half,
            awayCaptainBoostTicks: CAPTAIN_BOOST_TICKS,
            commentary: [
              ...state.commentary,
              {
                id: commentaryId(),
                minute:
                  state.half === 1
                    ? Math.round((state.tick / state.ticksPerHalf) * 45)
                    : 45 + Math.round((state.tick / state.ticksPerHalf) * 45),
                half: state.half,
                type: "info",
                text: `CAPTAIN'S CALL — ${playerName} leads the away side!`,
                team: "away",
                playerName,
              },
            ],
          },
        });
      },

      setMpMatchMeta: (meta) => set({ mpMatchMeta: meta }),

      processMatchFinishReveal: () => {
        const matchState = get().matchState;
        if (!matchState || matchState.status !== "finished" || get().pendingReveal) return;
        set({ matchState: { ...matchState, status: "running" } });
        get().setMatchState({ ...matchState, status: "finished" });
      },

      confirmHalftime: (playerLineup, _subsMade, tactics, captain) => {
        const state = get().matchState;
        const {
          opponentUniverseId,
          opponentFormationId,
          opponentLineup,
          opponentBench,
          lineup,
          matchBench,
        } = get();
        if (!state || !opponentUniverseId) return;

        const playerIsHome = resolvePlayerIsHome();
        const playerSide = playerIsHome ? "home" : "away";
        const cpuSide = playerIsHome ? "away" : "home";
        const oldPlayerLineup = lineup;
        const playerStats = playerIsHome ? state.homePlayerStats : state.awayPlayerStats;
        const pinnedPlayerLineup = pinSentOffPlayersInLineup(
          oldPlayerLineup,
          playerLineup,
          sentOffPlayerNames(playerStats)
        );
        const swapAnalysis = analyzeLineupChanges(oldPlayerLineup, pinnedPlayerLineup, matchBench);
        const subsMade = swapAnalysis.subs;
        const persistentHalftime = !!state.persistentMatchMode;
        let playerStamina = refreshStaminaAfterLineupChange(
          oldPlayerLineup,
          pinnedPlayerLineup,
          playerIsHome ? state.homeStamina : state.awayStamina,
          { persistentMatch: persistentHalftime }
        );
        playerStamina = applyPositionSwapStaminaPenalty(
          playerStamina,
          swapAnalysis.positionSwappedPlayers
        );

        const cpuResult = applyCpuSubsForSide(
          state,
          cpuSide,
          {
            universeId: opponentUniverseId,
            formationId: opponentFormationId,
            lineup: opponentLineup,
            bench: opponentBench,
          },
          get().revealedStats
        );

        const cpuCaptain = cpuPickCaptain(cpuResult.lineup, opponentUniverseId);
        const cpuTactic = cpuPickTacticForSide(opponentFormationId);

        const subNotes: string[] = [];
        if (subsMade > 0) subNotes.push(`${subsMade} change(s) for your side.`);
        if (swapAnalysis.positionSwappedPlayers.length > 0) {
          subNotes.push(`${swapAnalysis.positionSwappedPlayers.length} player(s) reshuffled.`);
        }
        if (cpuResult.subsMade > 0) subNotes.push(`CPU makes ${cpuResult.subsMade} sub(s).`);

        const playerTeamLabel = playerIsHome ? "Home" : "Away";
        const homeLineupFinal = playerIsHome ? pinnedPlayerLineup : cpuResult.lineup;
        const awayLineupFinal = playerIsHome ? cpuResult.lineup : pinnedPlayerLineup;
        const seededStats = seedMatchPlayerStats(
          homeLineupFinal,
          awayLineupFinal,
          state.homePlayerStats,
          state.awayPlayerStats
        );

        const nextState: MatchState = {
          ...state,
          status: "running",
          half: 2,
          tick: 0,
          homeStamina: playerIsHome ? playerStamina : cpuResult.stamina,
          awayStamina: playerIsHome ? cpuResult.stamina : playerStamina,
          homeSubsUsed:
            state.homeSubsUsed + (playerIsHome ? subsMade : cpuResult.subsMade),
          awaySubsUsed:
            state.awaySubsUsed + (playerIsHome ? cpuResult.subsMade : subsMade),
          homePlayerStats: seededStats.homePlayerStats,
          awayPlayerStats: seededStats.awayPlayerStats,
          ...(playerIsHome
            ? {
                homeTactics: tactics ?? state.homeTactics,
                homeTacticHalf: tactics ? 2 : state.homeTacticHalf,
                homeCaptain: captain ?? state.homeCaptain,
                homeCaptainHalf: captain ? 2 : state.homeCaptainHalf,
                homeCaptainBoostTicks: captain ? CAPTAIN_BOOST_TICKS : state.homeCaptainBoostTicks,
                awayTactics: cpuTactic,
                awayTacticHalf: 2,
                awayCaptain: cpuCaptain,
                awayCaptainHalf: 2,
                awayCaptainBoostTicks: CAPTAIN_BOOST_TICKS,
              }
            : {
                awayTactics: tactics ?? state.awayTactics,
                awayTacticHalf: tactics ? 2 : state.awayTacticHalf,
                awayCaptain: captain ?? state.awayCaptain,
                awayCaptainHalf: captain ? 2 : state.awayCaptainHalf,
                awayCaptainBoostTicks: captain ? CAPTAIN_BOOST_TICKS : state.awayCaptainBoostTicks,
                homeTactics: cpuTactic,
                homeTacticHalf: 2,
                homeCaptain: cpuCaptain,
                homeCaptainHalf: 2,
                homeCaptainBoostTicks: CAPTAIN_BOOST_TICKS,
              }),
          commentary: [
            ...state.commentary,
            ...subAnnouncementLines(oldPlayerLineup, pinnedPlayerLineup, playerTeamLabel).map(
              (text) => ({
                id: commentaryId(),
                minute: 45,
                half: 1 as const,
                type: "substitution" as const,
                text,
                team: playerSide as "home" | "away",
              })
            ),
            ...positionSwapAnnouncementLines(
              oldPlayerLineup,
              pinnedPlayerLineup,
              matchBench,
              playerTeamLabel
            ).map((text) => ({
              id: commentaryId(),
              minute: 45,
              half: 1 as const,
              type: "info" as const,
              text,
              team: playerSide as "home" | "away",
            })),
            {
              id: commentaryId(),
              minute: 45,
              half: 1,
              type: "info",
              text: `SECOND HALF — ${subNotes.join(" ") || "No changes."}`,
            },
            ...(tactics
              ? [
                  {
                    id: commentaryId(),
                    minute: 45,
                    half: 1 as const,
                    type: "info" as const,
                    text: formatTacticsCommentary(playerTeamLabel, tactics),
                    team: playerSide as "home" | "away",
                  },
                ]
              : []),
          ],
        };

        set({
          lineup: pinnedPlayerLineup,
          opponentLineup: cpuResult.lineup,
          matchState: resetSetPieceBudgetForHalf(nextState),
        });
      },

      confirmExtraTime: (approach: ExtraTimeApproach) => {
        const state = get().matchState;
        if (!state || state.status !== "extra_time_choice") return;

        const playerIsHome = resolvePlayerIsHome();
        const homeApproach = playerIsHome
          ? approach
          : cpuPickExtraTimeApproach(state.score, true);
        const awayApproach = playerIsHome
          ? cpuPickExtraTimeApproach(state.score, false)
          : approach;

        const mins = state.stoppageMinutes;
        set({
          matchState: {
            ...state,
            status: "running",
            inStoppageTime: true,
            stoppageTick: 0,
            homeExtraTimeApproach: homeApproach,
            awayExtraTimeApproach: awayApproach,
            commentary: [
              ...state.commentary,
              {
                id: commentaryId(),
                minute: 90,
                half: 2,
                type: "stoppage",
                text: `ADDED TIME — Home: ${extraTimeLabel(homeApproach)}. Away: ${extraTimeLabel(awayApproach)}. ${mins} minute${mins === 1 ? "" : "s"} to play.`,
              },
            ],
          },
        });
      },

      chooseDrawReveal: (playerName) => {
        const pending = get().pendingReveal;
        const { myUniId } = playerRevealUniverses();
        if (!pending || pending.result !== "draw" || !myUniId) return;
        const next = revealAllForPlayer(get().revealedStats, playerName);
        set({
          revealedStats: next,
          pendingReveal: null,
          revealHighlights: [{ universeId: myUniId, playerName, mode: "full" }],
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("fb:sfx", { detail: { kind: "reveal" } }));
        }
      },

      chooseWinReveal: (ownPlayerName, awayPlayerName) => {
        const pending = get().pendingReveal;
        const { myUniId, oppUniId } = playerRevealUniverses();
        if (!pending || pending.result !== "win" || !myUniId || !oppUniId) return;
        let next = get().revealedStats;
        const highlights: RevealHighlight[] = [];
        if (ownPlayerName) {
          next = revealAllForPlayer(next, ownPlayerName);
          highlights.push({ universeId: myUniId, playerName: ownPlayerName, mode: "full" });
        }
        if (awayPlayerName) {
          next = revealAllForPlayer(next, awayPlayerName);
          highlights.push({ universeId: oppUniId, playerName: awayPlayerName, mode: "full" });
        }
        if (!highlights.length) return;
        set({
          revealedStats: next,
          pendingReveal: null,
          revealHighlights: highlights,
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("fb:sfx", { detail: { kind: "reveal" } }));
        }
      },

      clearPendingReveal: () => set({ pendingReveal: null, revealHighlights: null }),

      isStatRevealed: (playerName, stat) =>
        (get().revealedStats[playerName] ?? []).includes(stat),

      isPlayerFullyRevealed: (playerName) => {
        const setVals = new Set(get().revealedStats[playerName] ?? []);
        return (
          setVals.has("pace") &&
          setVals.has("power") &&
          setVals.has("stamina") &&
          setVals.has("tackling") &&
          setVals.has("passing") &&
          setVals.has("gk")
        );
      },

      resetMatch: () => {
        clearMultiplayerSession();
        set({
          matchState: null,
          pendingReveal: null,
          revealHighlights: null,
          seasonActiveFixtureId: null,
          tournamentActiveFixtureId: null,
          seasonPlayerIsHome: true,
          mpMatchMeta: null,
          lastMatchContext: null,
        });
      },

      clearRecentSquadUnlocks: () => set({ recentSquadUnlocks: [] }),

      resetAll: () =>
        set({
          selectedUniverseId: null,
          formationId: DEFAULT_FORMATION,
          lineup: emptyLineupForFormation(DEFAULT_FORMATION),
          matchState: null,
          season: null,
          seasonSaveSlots: emptySeasonSaveSlots(),
          activeSeasonSlot: null,
          seasonActiveFixtureId: null,
          seasonPlayerIsHome: true,
        }),

      startSeason: (userUniverseId, length) => {
        get().startSeasonInSlot(0, userUniverseId, length);
      },

      startSeasonInSlot: (slot, userUniverseId, length) => {
        const unlockedSquads = normalizeUnlockedSquads(get().careerStats.unlockedSquads);
        if (!isSquadUnlocked(userUniverseId, unlockedSquads)) return;
        const season = createSeason(userUniverseId, length, 1, unlockedSquads);
        const seasonSaveSlots = writeSeasonToSlot(get().seasonSaveSlots, slot, season);
        set({
          season,
          seasonSaveSlots,
          activeSeasonSlot: slot,
          seasonHonours: get().seasonHonours,
          seasonActiveFixtureId: null,
          seasonPlayerIsHome: true,
          selectedUniverseId: userUniverseId,
          lineup: emptyLineupForFormation(get().formationId),
          matchBench: [],
        });
      },

      loadSeasonSlot: (slot) => {
        const slotData = get().seasonSaveSlots[slot];
        if (!slotData) return false;
        set({
          activeSeasonSlot: slot,
          season: slotData.season,
          seasonActiveFixtureId: null,
          seasonPlayerIsHome: true,
          selectedUniverseId: slotData.season.userUniverseId,
          lineup: emptyLineupForFormation(get().formationId),
          matchBench: [],
        });
        return true;
      },

      saveSeasonSlot: () => {
        const slot = get().activeSeasonSlot;
        const season = get().season;
        if (slot == null || !season) return;
        set({
          seasonSaveSlots: writeSeasonToSlot(get().seasonSaveSlots, slot, season),
        });
      },

      continueSeason: () => {
        const season = get().season;
        const slot = get().activeSeasonSlot;
        if (!season || slot == null || !canContinueSeasonCampaign(season)) return false;
        const unlockedSquads = normalizeUnlockedSquads(get().careerStats.unlockedSquads);
        const next = buildContinuedSeason(season, unlockedSquads);
        set({
          season: next,
          seasonSaveSlots: writeSeasonToSlot(get().seasonSaveSlots, slot, next),
          seasonActiveFixtureId: null,
          seasonPlayerIsHome: true,
          selectedUniverseId: next.userUniverseId,
          lineup: emptyLineupForFormation(get().formationId),
          matchBench: [],
        });
        return true;
      },

      abandonSeason: () => {
        const slot = get().activeSeasonSlot;
        const season = get().season;
        const seasonSaveSlots = [...get().seasonSaveSlots] as SeasonSaveSlots;
        if (slot != null && season?.status === "active") {
          seasonSaveSlots[slot] = null;
        }
        set({
          season: null,
          activeSeasonSlot: null,
          seasonSaveSlots,
          seasonActiveFixtureId: null,
          seasonPlayerIsHome: true,
        });
      },

      prepareSeasonMatch: () => {
        const rawSeason = get().season;
        if (!rawSeason || rawSeason.status !== "active") return false;
        const season = ensureSeasonRosters(rawSeason);
        const fixture = getPlayerFixture(season);
        if (!fixture) return false;

        clearMultiplayerSession();
        const isHome = fixture.homeUniverseId === season.userUniverseId;
        const oppId = isHome ? fixture.awayUniverseId : fixture.homeUniverseId;
        let nextSeason = season;
        const opp = prepareCpuOpponentFromSeason(nextSeason, oppId);
        nextSeason = opp.season;

        set({
          season: nextSeason,
          selectedUniverseId: season.userUniverseId,
          seasonPlayerIsHome: isHome,
          seasonActiveFixtureId: fixture.id,
          tournamentActiveFixtureId: null,
          lineup: emptyLineupForFormation(get().formationId),
          matchBench: [],
          opponentUniverseId: oppId,
          opponentFormationId: opp.formationId,
          opponentLineup: opp.lineup,
          opponentBench: opp.bench,
        });
        return true;
      },

      setTournament: (tournament) => {
        if (!tournament) {
          set({ tournament: null, tournamentInstance: null });
          return;
        }
        const wasNull = !get().tournament;
        set({
          tournament,
          tournamentInstance: wasNull
            ? emptyTournamentInstance(newTournamentInstanceKey())
            : get().tournamentInstance ?? emptyTournamentInstance(newTournamentInstanceKey()),
        });
      },
      setTournamentActiveFixture: (fixtureId) => set({ tournamentActiveFixtureId: fixtureId }),

      setCareerStats: (stats) => set({ careerStats: stats }),

      executeSeasonTransfer: (partnerTeamId, outgoing, incoming) => {
        const raw = get().season;
        if (!raw) return { ok: false, error: "No active season." };
        const season = ensureSeasonRosters(raw);
        const { season: next, error } = executeSeasonSwap(season, partnerTeamId, outgoing, incoming);
        if (error) return { ok: false, error };
        const slot = get().activeSeasonSlot;
        const userId = next.userUniverseId;
        const sanitized = sanitizeLineupForSeasonRoster(
          next,
          userId,
          get().lineup,
          get().matchBench
        );
        const patch: Partial<GameStore> = {
          season: next,
          lineup: sanitized.lineup,
          matchBench: sanitized.matchBench,
        };
        if (slot != null) {
          patch.seasonSaveSlots = writeSeasonToSlot(get().seasonSaveSlots, slot, next);
        }
        set(patch);
        return { ok: true };
      },
    }),
    {
      name: "fantasy-build-store",
      partialize: (s) => ({
        selectedUniverseId: s.selectedUniverseId,
        formationId: s.formationId,
        lineup: s.lineup,
        opponentUniverseId: s.opponentUniverseId,
        savedLineups: s.savedLineups,
        plannedTactics: s.plannedTactics,
      }),
    }
  )
);

export function getHomeSetup(): TeamSetup | null {
  return getHomeMatchSetup();
}

export function getAwaySetup(): TeamSetup | null {
  return getAwayMatchSetup();
}
