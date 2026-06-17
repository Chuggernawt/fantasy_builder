"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  FormationId,
  LineupSlot,
  MatchState,
  StatKey,
  TacticalStyle,
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
import { TACTICAL_OPTIONS } from "@/lib/match-influence";
import { subAnnouncementLines } from "@/lib/sub-utils";
import { cpuHalftimeSubs, cpuChooseSubCount, refreshStaminaAfterLineupChange } from "@/lib/subs";
import { getPlayer } from "@/lib/squads";
import { revealAllForPlayer, revealOneRandomStat } from "@/lib/reveal";
import type { RevealHighlight } from "@/lib/reveal";
import type { SeasonHonour, SeasonLength, SeasonState } from "@/lib/season-types";
import type { TournamentState } from "@/lib/tournament-types";
import {
  applyFixtureResult,
  simAllCpuFixturesInRound,
} from "@/lib/tournament";
import { resolveTournamentWinnerFromMatch } from "@/lib/tournament-match";
import type { MpMatchMeta } from "@/lib/multiplayer-types";
import { getMultiplayerSession, clearMultiplayerSession } from "@/lib/multiplayer-session";
import { playerRevealUniverses } from "@/lib/multiplayer-perspective";
import { resolvePlayerIsHome, getHomeMatchSetup, getAwayMatchSetup } from "@/lib/player-side";
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
import { prepareCpuOpponentForSeason } from "@/lib/season-lite";

export interface SavedLineup {
  formationId: FormationId;
  lineup: LineupSlot[];
  matchBench: string[];
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
  seasonHonours: SeasonHonour[];
  seasonActiveFixtureId: string | null;
  seasonPlayerIsHome: boolean;
  tournament: TournamentState | null;
  tournamentActiveFixtureId: string | null;
  mpMatchMeta: MpMatchMeta | null;

  selectUniverse: (id: string) => void;
  setFormation: (id: FormationId) => void;
  setLineupSlot: (slotId: string, playerName: string | null) => void;
  swapLineupSlots: (slotA: string, slotB: string) => void;
  autoPickLineup: () => void;
  fillLineupRest: () => void;
  clearLineup: () => void;
  toggleMatchBenchPlayer: (playerName: string) => void;
  autoPickMatchBench: () => void;
  saveLineup: () => void;
  loadSavedLineup: () => boolean;
  hasSavedLineup: (universeId?: string) => boolean;
  setOpponent: (universeId: string) => void;
  startMatch: () => void;
  setMatchState: (state: MatchState | null) => void;
  openSubWindow: () => void;
  confirmSubs: (homeLineup: LineupSlot[], subsMade: number) => void;
  setHomeTactic: (tactic: TacticalStyle) => void;
  setAwayTactic: (tactic: TacticalStyle) => void;
  callHomeCaptain: (playerName: string) => void;
  callAwayCaptain: (playerName: string) => void;
  setMpMatchMeta: (meta: MpMatchMeta | null) => void;
  processMatchFinishReveal: () => void;
  confirmHalftime: (
    homeLineup: LineupSlot[],
    subsMade: number,
    tactic?: TacticalStyle | null,
    captain?: string | null
  ) => void;
  chooseDrawReveal: (playerName: string) => void;
  chooseWinReveal: (ownPlayerName: string, awayPlayerName: string) => void;
  clearPendingReveal: () => void;
  isStatRevealed: (playerName: string, stat: StatKey) => boolean;
  isPlayerFullyRevealed: (playerName: string) => boolean;
  resetMatch: () => void;
  resetAll: () => void;
  startSeason: (userUniverseId: string, length: SeasonLength) => void;
  abandonSeason: () => void;
  prepareSeasonMatch: () => boolean;
  setTournament: (tournament: TournamentState | null) => void;
  setTournamentActiveFixture: (fixtureId: string | null) => void;
}

function cpuPickTactic(): TacticalStyle {
  const opts = TACTICAL_OPTIONS.map((t) => t.id);
  return opts[Math.floor(Math.random() * opts.length)];
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

function applyAwayCpuSubs(
  state: MatchState,
  opponentLineup: LineupSlot[],
  opponentUniverseId: string,
  opponentFormationId: FormationId,
  opponentBench: string[],
  revealedStats: Record<string, StatKey[]>
): { lineup: LineupSlot[]; subsMade: number; stamina: Record<string, number> } {
  const awaySetup = {
    universeId: opponentUniverseId,
    formationId: opponentFormationId,
    lineup: opponentLineup,
    bench: opponentBench,
  };
  const remaining = MAX_MATCH_SUBS - state.awaySubsUsed;
  if (remaining <= 0) {
    return { lineup: opponentLineup, subsMade: 0, stamina: state.awayStamina };
  }
  const subsBudget = cpuChooseSubCount(opponentLineup, state.awayStamina, remaining);
  const newLineup = cpuHalftimeSubs(
    awaySetup,
    state.awayStamina,
    revealedStats,
    subsBudget
  );
  let subsMade = newLineup.filter(
    (s, i) => s.playerName !== opponentLineup[i]?.playerName
  ).length;
  subsMade = Math.min(subsMade, remaining);
  const stamina = refreshStaminaAfterLineupChange(
    opponentLineup,
    newLineup,
    state.awayStamina
  );
  return { lineup: newLineup, subsMade, stamina };
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
      seasonHonours: [],
      seasonActiveFixtureId: null,
      seasonPlayerIsHome: true,
      tournament: null,
      tournamentActiveFixtureId: null,
      mpMatchMeta: null,

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

      setLineupSlot: (slotId, playerName) => {
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
        const { selectedUniverseId, formationId } = get();
        if (!selectedUniverseId) return;
        const lineup = randomFillLineup(selectedUniverseId, formationId);
        set({
          lineup,
          matchBench: pickRandomBench(selectedUniverseId, lineup),
        });
      },

      fillLineupRest: () => {
        const { selectedUniverseId, lineup } = get();
        if (!selectedUniverseId) return;
        set({ lineup: fillLineupRestRandom(lineup, selectedUniverseId) });
      },

      clearLineup: () => {
        set({
          lineup: emptyLineupForFormation(get().formationId),
          matchBench: [],
        });
      },

      toggleMatchBenchPlayer: (playerName) => {
        const { matchBench, lineup, selectedUniverseId } = get();
        if (!selectedUniverseId) return;
        if (lineup.some((s) => s.playerName === playerName)) return;
        if (matchBench.includes(playerName)) {
          set({ matchBench: matchBench.filter((n) => n !== playerName) });
          return;
        }
        if (matchBench.length >= MATCH_BENCH_SIZE) return;
        set({ matchBench: [...matchBench, playerName] });
      },

      autoPickMatchBench: () => {
        const { selectedUniverseId, lineup } = get();
        if (!selectedUniverseId) return;
        set({ matchBench: pickRandomBench(selectedUniverseId, lineup) });
      },

      saveLineup: () => {
        const { selectedUniverseId, formationId, lineup, matchBench } = get();
        if (!selectedUniverseId) return;
        set({
          savedLineups: {
            ...get().savedLineups,
            [selectedUniverseId]: {
              formationId,
              lineup,
              matchBench,
              savedAt: new Date().toISOString(),
            },
          },
        });
      },

      loadSavedLineup: () => {
        const { selectedUniverseId, savedLineups } = get();
        if (!selectedUniverseId) return false;
        const saved = savedLineups[selectedUniverseId];
        if (!saved) return false;
        set({
          formationId: saved.formationId,
          lineup: saved.lineup,
          matchBench: saved.matchBench ?? [],
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
        if (isSeasonMatch && season) {
          const suspended = lineup
            .map((s) => s.playerName)
            .filter(
              (name): name is string =>
                !!name && isPlayerSuspended(season, selectedUniverseId, name)
            );
          if (suspended.length) return;
        }

        const playerIsHome = isSeasonMatch ? get().seasonPlayerIsHome : true;
        const oppLineup =
          get().opponentLineup.length === 11
            ? get().opponentLineup
            : autoFillLineup(opponentUniverseId, opponentFormationId);
        const oppBench =
          get().opponentBench.length === MATCH_BENCH_SIZE
            ? get().opponentBench
            : pickRandomBench(opponentUniverseId, oppLineup);

        const playerSetup = {
          universeId: selectedUniverseId,
          formationId,
          lineup,
          bench: matchBench,
        };
        const oppSetup = {
          universeId: opponentUniverseId,
          formationId: opponentFormationId,
          lineup: oppLineup,
          bench: oppBench,
        };

        const seasonMeta =
          isSeasonMatch && season ? buildSeasonMatchMeta(season) ?? undefined : undefined;

        const tourFixtureId = get().tournamentActiveFixtureId;
        const tournament = get().tournament;
        const isCupKnockout =
          !!tourFixtureId && tournament && tournament.format !== "round_robin";
        const tournamentMeta =
          isCupKnockout && tournament
            ? { cupKnockout: true, penaltyMode: tournament.penaltyMode }
            : undefined;

        const base = playerIsHome
          ? createInitialMatchState(playerSetup, oppSetup, { seasonMeta })
          : createInitialMatchState(oppSetup, playerSetup, { seasonMeta });

        set({
          opponentLineup: oppLineup,
          opponentBench: oppBench,
          matchState: {
            ...base,
            tournamentMeta,
            awayTactic: cpuPickTactic(),
            awayTacticHalf: 1,
            awayCaptain: cpuPickCaptain(oppLineup, opponentUniverseId),
            awayCaptainHalf: 1,
            awayCaptainBoostTicks: CAPTAIN_BOOST_TICKS,
          },
        });
      },

      setMatchState: (matchState) => {
        const prev = get().matchState;
        if (!matchState) return set({ matchState: null });

        let revealedStats = get().revealedStats;
        let pendingReveal: PendingReveal | null = get().pendingReveal;
        let revealHighlights: RevealHighlight[] | null = get().revealHighlights;
        const patch: Partial<GameStore> = { matchState };

        if (prev?.status !== "finished" && matchState.status === "finished") {
          const playerIsHome = resolvePlayerIsHome();
          const ownPlayed = get()
            .lineup.map((s) => s.playerName)
            .filter((p): p is string => !!p);
          const oppPlayed = get()
            .opponentLineup.map((s) => s.playerName)
            .filter((p): p is string => !!p);
          const playerUniId = (playerIsHome
            ? get().selectedUniverseId
            : get().opponentUniverseId) ?? "";
          const oppUniId = (playerIsHome
            ? get().opponentUniverseId
            : get().selectedUniverseId) ?? matchState.awayUniverseId ?? "";
          const playerScore = playerIsHome ? matchState.score.home : matchState.score.away;
          const oppScore = playerIsHome ? matchState.score.away : matchState.score.home;

          if (playerScore > oppScore) {
            pendingReveal = {
              result: "win",
              ownChoices: ownPlayed,
              awayChoices: oppPlayed,
              message:
                "Win reward: reveal one of your players and one opponent you faced.",
            };
          } else if (playerScore === oppScore) {
            pendingReveal = {
              result: "draw",
              ownChoices: ownPlayed,
              message: "Draw reward: pick one of your used players to fully reveal.",
            };
          } else if (ownPlayed.length > 0) {
            const pick = ownPlayed[Math.floor(Math.random() * ownPlayed.length)];
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

          const season = get().season;
          const fixtureId = get().seasonActiveFixtureId;
          if (season?.status === "active" && fixtureId) {
            const fixture = season.fixtures.find((f) => f.id === fixtureId);
            if (fixture) {
              const homeScore = playerIsHome ? matchState.score.home : matchState.score.away;
              const awayScore = playerIsHome ? matchState.score.away : matchState.score.home;
              const homeStats = playerIsHome
                ? matchState.homePlayerStats
                : matchState.awayPlayerStats;
              const awayStats = playerIsHome
                ? matchState.awayPlayerStats
                : matchState.homePlayerStats;
              let nextSeason = recordPlayerMatchFromState(
                season,
                fixture,
                homeScore,
                awayScore,
                homeStats,
                awayStats
              );
              const userStats = playerIsHome
                ? matchState.homePlayerStats
                : matchState.awayPlayerStats;
              for (const [name, row] of Object.entries(userStats)) {
                if (row.redCards > 0) {
                  nextSeason = applyRedCardSuspension(
                    nextSeason,
                    nextSeason.userUniverseId,
                    name
                  );
                }
              }
              let seasonHonours = get().seasonHonours;
              if (nextSeason.status === "finished") {
                const summary = buildSeasonSummary(nextSeason);
                if (summary) seasonHonours = [...seasonHonours, summary];
                if (nextSeason.championId === nextSeason.userUniverseId) {
                  revealedStats = applySeasonChampionReveal(
                    revealedStats,
                    nextSeason.userUniverseId,
                    nextSeason.length,
                    true
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
          if (tournament && tourFixtureId && matchState) {
            const result = resolveTournamentWinnerFromMatch(
              tournament,
              tourFixtureId,
              matchState
            );
            if (result) {
              tournament = applyFixtureResult(tournament, tourFixtureId, result);
              tournament = simAllCpuFixturesInRound(tournament);
              patch.tournament = tournament;
              patch.tournamentActiveFixtureId = null;
            }
          }

          patch.revealedStats = revealedStats;
          patch.pendingReveal = pendingReveal;
          patch.revealHighlights = revealHighlights;
        }

        set(patch);
      },

      openSubWindow: () => {
        const state = get().matchState;
        if (!state || state.status !== "running") return;
        if (state.homeSubsUsed >= MAX_MATCH_SUBS) return;
        set({ matchState: { ...state, status: "sub_window" } });
      },

      confirmSubs: (homeLineup, subsMade) => {
        const state = get().matchState;
        const { opponentUniverseId, opponentFormationId, opponentLineup, opponentBench, lineup } = get();
        if (!state || state.status !== "sub_window" || !opponentUniverseId) return;

        const oldHome = lineup;
        const homeStamina = refreshStaminaAfterLineupChange(
          oldHome,
          homeLineup,
          state.homeStamina
        );

        const minute =
          state.half === 1
            ? Math.round((state.tick / state.ticksPerHalf) * 45)
            : 45 + Math.round((state.tick / state.ticksPerHalf) * 45);

        const subEvents = subAnnouncementLines(oldHome, homeLineup, "Home").map((text) => ({
          id: commentaryId(),
          minute,
          half: state.half,
          type: "substitution" as const,
          text,
          team: "home" as const,
        }));

        const awayResult = applyAwayCpuSubs(
          state,
          opponentLineup,
          opponentUniverseId,
          opponentFormationId,
          opponentBench,
          get().revealedStats
        );
        const awaySubEvents = subAnnouncementLines(opponentLineup, awayResult.lineup, "Away").map(
          (text) => ({
            id: commentaryId(),
            minute,
            half: state.half,
            type: "substitution" as const,
            text,
            team: "away" as const,
          })
        );

        set({
          lineup: homeLineup,
          opponentLineup: awayResult.lineup,
          matchState: {
            ...state,
            status: "running",
            homeStamina,
            awayStamina: awayResult.stamina,
            homeSubsUsed: state.homeSubsUsed + subsMade,
            awaySubsUsed: state.awaySubsUsed + awayResult.subsMade,
            commentary: [...state.commentary, ...subEvents, ...awaySubEvents],
          },
        });
      },

      setHomeTactic: (tactic) => {
        const state = get().matchState;
        if (!state || state.status !== "running") return;
        if (state.homeTacticHalf === state.half) return;
        set({
          matchState: {
            ...state,
            homeTactic: tactic,
            homeTacticHalf: state.half,
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
                text: `TACTIC — Home switches to ${tactic.replaceAll("_", " ")}.`,
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

      setAwayTactic: (tactic) => {
        const state = get().matchState;
        if (!state || state.status !== "running") return;
        if (state.awayTacticHalf === state.half) return;
        set({
          matchState: {
            ...state,
            awayTactic: tactic,
            awayTacticHalf: state.half,
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
                text: `TACTIC — Away switches to ${tactic.replaceAll("_", " ")}.`,
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

      confirmHalftime: (homeLineup, subsMade, tactic, captain) => {
        const state = get().matchState;
        const { opponentUniverseId, opponentFormationId, opponentLineup, opponentBench } = get();
        if (!state || !opponentUniverseId) return;

        const oldHome = get().lineup;
        const homeStamina = refreshStaminaAfterLineupChange(
          oldHome,
          homeLineup,
          state.homeStamina
        );

        const awayResult = applyAwayCpuSubs(
          state,
          opponentLineup,
          opponentUniverseId,
          opponentFormationId,
          opponentBench,
          get().revealedStats
        );

        const awayCaptain = cpuPickCaptain(awayResult.lineup, opponentUniverseId);
        const awayTactic = cpuPickTactic();

        const subNotes: string[] = [];
        if (subsMade > 0) subNotes.push(`${subsMade} change(s) for your side.`);
        if (awayResult.subsMade > 0) subNotes.push(`CPU makes ${awayResult.subsMade} sub(s).`);

        const nextState: MatchState = {
          ...state,
          status: "running",
          half: 2,
          tick: 0,
          homeStamina,
          awayStamina: awayResult.stamina,
          homeSubsUsed: state.homeSubsUsed + subsMade,
          awaySubsUsed: state.awaySubsUsed + awayResult.subsMade,
          homeTactic: tactic ?? state.homeTactic,
          homeTacticHalf: tactic ? 2 : state.homeTacticHalf,
          homeCaptain: captain ?? state.homeCaptain,
          homeCaptainHalf: captain ? 2 : state.homeCaptainHalf,
          homeCaptainBoostTicks: captain ? CAPTAIN_BOOST_TICKS : state.homeCaptainBoostTicks,
          awayTactic,
          awayTacticHalf: 2,
          awayCaptain,
          awayCaptainHalf: 2,
          awayCaptainBoostTicks: CAPTAIN_BOOST_TICKS,
          commentary: [
            ...state.commentary,
            ...subAnnouncementLines(oldHome, homeLineup, "Home").map((text) => ({
              id: commentaryId(),
              minute: 45,
              half: 1 as const,
              type: "substitution" as const,
              text,
              team: "home" as const,
            })),
            {
              id: commentaryId(),
              minute: 45,
              half: 1,
              type: "info",
              text: `SECOND HALF — ${subNotes.join(" ") || "No changes."}`,
            },
          ],
        };

        set({
          lineup: homeLineup,
          opponentLineup: awayResult.lineup,
          matchState: resetSetPieceBudgetForHalf(nextState),
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
        let next = revealAllForPlayer(get().revealedStats, ownPlayerName);
        next = revealAllForPlayer(next, awayPlayerName);
        set({
          revealedStats: next,
          pendingReveal: null,
          revealHighlights: [
            { universeId: myUniId, playerName: ownPlayerName, mode: "full" },
            { universeId: oppUniId, playerName: awayPlayerName, mode: "full" },
          ],
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
          seasonPlayerIsHome: true,
          mpMatchMeta: null,
        });
      },

      resetAll: () =>
        set({
          selectedUniverseId: null,
          formationId: DEFAULT_FORMATION,
          lineup: emptyLineupForFormation(DEFAULT_FORMATION),
          matchState: null,
          season: null,
          seasonActiveFixtureId: null,
          seasonPlayerIsHome: true,
        }),

      startSeason: (userUniverseId, length) => {
        const seasonNumber =
          get().seasonHonours.filter(
            (h) => h.universeId === userUniverseId && h.seasonLength === length
          ).length + 1;
        set({
          season: createSeason(userUniverseId, length, seasonNumber),
          seasonHonours: get().seasonHonours,
          seasonActiveFixtureId: null,
          seasonPlayerIsHome: true,
          selectedUniverseId: userUniverseId,
          lineup: emptyLineupForFormation(get().formationId),
          matchBench: [],
        });
      },

      abandonSeason: () =>
        set({
          season: null,
          seasonActiveFixtureId: null,
          seasonPlayerIsHome: true,
        }),

      prepareSeasonMatch: () => {
        const season = get().season;
        if (!season || season.status !== "active") return false;
        const fixture = getPlayerFixture(season);
        if (!fixture) return false;

        clearMultiplayerSession();
        const isHome = fixture.homeUniverseId === season.userUniverseId;
        const oppId = isHome ? fixture.awayUniverseId : fixture.homeUniverseId;
        const opp = prepareCpuOpponentForSeason(oppId);

        set({
          selectedUniverseId: season.userUniverseId,
          seasonPlayerIsHome: isHome,
          seasonActiveFixtureId: fixture.id,
          lineup: emptyLineupForFormation(get().formationId),
          matchBench: [],
          opponentUniverseId: oppId,
          opponentFormationId: opp.formationId,
          opponentLineup: opp.lineup,
          opponentBench: opp.bench,
        });
        return true;
      },

      setTournament: (tournament) => set({ tournament }),
      setTournamentActiveFixture: (fixtureId) => set({ tournamentActiveFixtureId: fixtureId }),
    }),
    {
      name: "fantasy-build-store",
      partialize: (s) => ({
        selectedUniverseId: s.selectedUniverseId,
        formationId: s.formationId,
        lineup: s.lineup,
        opponentUniverseId: s.opponentUniverseId,
        revealedStats: s.revealedStats,
        savedLineups: s.savedLineups,
        season: s.season,
        seasonHonours: s.seasonHonours,
        tournament: s.tournament,
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
