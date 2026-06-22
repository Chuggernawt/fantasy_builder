import type { LineupSlot, MatchState, TeamTactics } from "./types";
import type { MpMatchMeta, MpPlayerAction } from "./multiplayer-types";
import { useGameStore } from "@/store/game-store";
import { commentaryId } from "./simulation-utils";
import { resetSetPieceBudgetForHalf } from "./set-piece-interactive";
import { refreshStaminaAfterLineupChange, applyPositionSwapStaminaPenalty } from "./subs";
import {
  analyzeLineupChanges,
  positionSwapAnnouncementLines,
  subAnnouncementLines,
} from "./sub-utils";
import { seedMatchPlayerStats } from "./background-match-stats";
import { CAPTAIN_BOOST_TICKS, MAX_MATCH_SUBS } from "./constants";
import {
  beginMpSubPause,
  canResumePause,
} from "./multiplayer-match-flow";
import { cpuPickExtraTimeApproach, extraTimeLabel } from "./stoppage-time";
import type { ExtraTimeApproach } from "./types";
import { mergeSetPiecePick } from "./set-piece-interactive";
export function confirmMultiplayerSubs(
  homeLineup: LineupSlot[],
  homeSubsMade: number,
  awayLineup: LineupSlot[],
  awaySubsMade: number
): void {
  const state = useGameStore.getState().matchState;
  const oldHome = useGameStore.getState().lineup;
  const oldAway = useGameStore.getState().opponentLineup;
  const homeBench = useGameStore.getState().matchBench;
  const awayBench = useGameStore.getState().opponentBench;
  if (!state || state.status !== "sub_window") return;

  const homeSwap = analyzeLineupChanges(oldHome, homeLineup, homeBench);
  const awaySwap = analyzeLineupChanges(oldAway, awayLineup, awayBench);
  let homeStamina = refreshStaminaAfterLineupChange(
    oldHome,
    homeLineup,
    state.homeStamina
  );
  let awayStamina = refreshStaminaAfterLineupChange(
    oldAway,
    awayLineup,
    state.awayStamina
  );
  homeStamina = applyPositionSwapStaminaPenalty(homeStamina, homeSwap.positionSwappedPlayers);
  awayStamina = applyPositionSwapStaminaPenalty(awayStamina, awaySwap.positionSwappedPlayers);

  const minute =
    state.half === 1
      ? Math.round((state.tick / state.ticksPerHalf) * 45)
      : 45 + Math.round((state.tick / state.ticksPerHalf) * 45);

  const homeEvents = subAnnouncementLines(oldHome, homeLineup, "Home").map((text) => ({
    id: commentaryId(),
    minute,
    half: state.half,
    type: "substitution" as const,
    text,
    team: "home" as const,
  }));
  const awayEvents = subAnnouncementLines(oldAway, awayLineup, "Away").map((text) => ({
    id: commentaryId(),
    minute,
    half: state.half,
    type: "substitution" as const,
    text,
    team: "away" as const,
  }));
  const homeSwapEvents = positionSwapAnnouncementLines(oldHome, homeLineup, homeBench, "Home").map(
    (text) => ({
      id: commentaryId(),
      minute,
      half: state.half,
      type: "info" as const,
      text,
      team: "home" as const,
    })
  );
  const awaySwapEvents = positionSwapAnnouncementLines(oldAway, awayLineup, awayBench, "Away").map(
    (text) => ({
      id: commentaryId(),
      minute,
      half: state.half,
      type: "info" as const,
      text,
      team: "away" as const,
    })
  );

  const seededStats = seedMatchPlayerStats(
    homeLineup,
    awayLineup,
    state.homePlayerStats,
    state.awayPlayerStats
  );

  useGameStore.setState({
    lineup: homeLineup,
    opponentLineup: awayLineup,
    matchState: {
      ...state,
      status: "running",
      homeStamina,
      awayStamina,
      homeSubsUsed: state.homeSubsUsed + homeSubsMade,
      awaySubsUsed: state.awaySubsUsed + awaySubsMade,
      homePlayerStats: seededStats.homePlayerStats,
      awayPlayerStats: seededStats.awayPlayerStats,
      commentary: [...state.commentary, ...homeEvents, ...awayEvents, ...homeSwapEvents, ...awaySwapEvents],
    },
    mpMatchMeta: { ...useGameStore.getState().mpMatchMeta!, pause: null },
  });
}

export function confirmMultiplayerHalftime(
  homeLineup: LineupSlot[],
  homeSubsMade: number,
  awayLineup: LineupSlot[],
  awaySubsMade: number,
  homeTactics: TeamTactics | null | undefined,
  homeCaptain: string | null | undefined,
  awayTactics: TeamTactics | null | undefined,
  awayCaptain: string | null | undefined
): void {
  const state = useGameStore.getState().matchState;
  const oldHome = useGameStore.getState().lineup;
  const oldAway = useGameStore.getState().opponentLineup;
  const homeBench = useGameStore.getState().matchBench;
  const awayBench = useGameStore.getState().opponentBench;
  if (!state || state.status !== "halftime") return;

  const homeSwap = analyzeLineupChanges(oldHome, homeLineup, homeBench);
  const awaySwap = analyzeLineupChanges(oldAway, awayLineup, awayBench);
  let homeStamina = refreshStaminaAfterLineupChange(
    oldHome,
    homeLineup,
    state.homeStamina
  );
  let awayStamina = refreshStaminaAfterLineupChange(
    oldAway,
    awayLineup,
    state.awayStamina
  );
  homeStamina = applyPositionSwapStaminaPenalty(homeStamina, homeSwap.positionSwappedPlayers);
  awayStamina = applyPositionSwapStaminaPenalty(awayStamina, awaySwap.positionSwappedPlayers);

  const seededStats = seedMatchPlayerStats(
    homeLineup,
    awayLineup,
    state.homePlayerStats,
    state.awayPlayerStats
  );

  const nextState: MatchState = {
    ...state,
    status: "running",
    half: 2,
    tick: 0,
    homeStamina,
    awayStamina,
    homeSubsUsed: state.homeSubsUsed + homeSubsMade,
    awaySubsUsed: state.awaySubsUsed + awaySubsMade,
    homePlayerStats: seededStats.homePlayerStats,
    awayPlayerStats: seededStats.awayPlayerStats,
    homeTactics: homeTactics ?? state.homeTactics,
    homeTacticHalf: homeTactics ? 2 : state.homeTacticHalf,
    homeCaptain: homeCaptain ?? state.homeCaptain,
    homeCaptainHalf: homeCaptain ? 2 : state.homeCaptainHalf,
    homeCaptainBoostTicks: homeCaptain ? CAPTAIN_BOOST_TICKS : state.homeCaptainBoostTicks,
    awayTactics: awayTactics ?? state.awayTactics,
    awayTacticHalf: awayTactics ? 2 : state.awayTacticHalf,
    awayCaptain: awayCaptain ?? state.awayCaptain,
    awayCaptainHalf: awayCaptain ? 2 : state.awayCaptainHalf,
    awayCaptainBoostTicks: awayCaptain ? CAPTAIN_BOOST_TICKS : state.awayCaptainBoostTicks,
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
      ...subAnnouncementLines(oldAway, awayLineup, "Away").map((text) => ({
        id: commentaryId(),
        minute: 45,
        half: 1 as const,
        type: "substitution" as const,
        text,
        team: "away" as const,
      })),
      ...positionSwapAnnouncementLines(oldHome, homeLineup, homeBench, "Home").map((text) => ({
        id: commentaryId(),
        minute: 45,
        half: 1 as const,
        type: "info" as const,
        text,
        team: "home" as const,
      })),
      ...positionSwapAnnouncementLines(oldAway, awayLineup, awayBench, "Away").map((text) => ({
        id: commentaryId(),
        minute: 45,
        half: 1 as const,
        type: "info" as const,
        text,
        team: "away" as const,
      })),
      {
        id: commentaryId(),
        minute: 45,
        half: 1,
        type: "info",
        text: "SECOND HALF — Both managers are ready.",
      },
    ],
  };

  useGameStore.setState({
    lineup: homeLineup,
    opponentLineup: awayLineup,
    matchState: resetSetPieceBudgetForHalf(nextState),
    mpMatchMeta: { ...useGameStore.getState().mpMatchMeta!, pause: null },
  });
}

export function applyMpActionToMeta(
  meta: MpMatchMeta,
  action: MpPlayerAction,
  side: "home" | "away"
): MpMatchMeta {
  const pause = meta.pause;
  if (!pause) return meta;

  if (action.type === "subs_ready" && pause.kind === "subs") {
    if (side === "home") {
      return {
        ...meta,
        pause: {
          ...pause,
          homeReady: true,
          pendingHomeLineup: action.lineup,
          pendingHomeSubsMade: action.subsMade,
        },
      };
    }
    return {
      ...meta,
      pause: {
        ...pause,
        awayReady: true,
        pendingAwayLineup: action.lineup,
        pendingAwaySubsMade: action.subsMade,
      },
    };
  }

  if (action.type === "extra_time_ready" && pause.kind === "extra_time") {
    if (side === "home") {
      return {
        ...meta,
        pause: {
          ...pause,
          homeReady: true,
          pendingHomeExtraTime: action.approach,
        },
      };
    }
    return {
      ...meta,
      pause: {
        ...pause,
        awayReady: true,
        pendingAwayExtraTime: action.approach,
      },
    };
  }

  if (action.type === "halftime_ready" && pause.kind === "halftime") {
    if (side === "home") {
      return {
        ...meta,
        pause: {
          ...pause,
          homeReady: true,
          pendingHomeLineup: action.lineup,
          pendingHomeSubsMade: action.subsMade,
          pendingHomeTactics: action.tactic ?? null,
          pendingHomeCaptain: action.captain ?? null,
        },
      };
    }
    return {
      ...meta,
      pause: {
        ...pause,
        awayReady: true,
        pendingAwayLineup: action.lineup,
        pendingAwaySubsMade: action.subsMade,
        pendingAwayTactics: action.tactic ?? null,
        pendingAwayCaptain: action.captain ?? null,
      },
    };
  }

  if (action.type === "rematch") {
    return {
      ...meta,
      rematch: {
        ...meta.rematch,
        [side === "home" ? "host" : "away"]: true,
      },
    };
  }

  return meta;
}

export function processMemberMpAction(
  action: MpPlayerAction,
  side: "home" | "away"
): void {
  const store = useGameStore.getState();
  const meta = store.mpMatchMeta ?? { pause: null, rematch: { host: false, away: false } };
  const matchState = store.matchState;

  if (action.type === "request_subs") {
    if (matchState?.status === "running") {
      const subsUsed = side === "home" ? matchState.homeSubsUsed : matchState.awaySubsUsed;
      if (subsUsed >= 3) return; // MAX_MATCH_SUBS
      store.setMatchState({ ...matchState, status: "sub_window" });
      store.setMpMatchMeta(beginMpSubPause(meta));
    }
    return;
  }

  if (action.type === "set_tactic") {
    if (side === "away") store.setAwayTactic(action.tactic);
    else store.setHomeTactic(action.tactic);
    return;
  }

  if (action.type === "set_piece_pick") {
    const state = store.matchState;
    if (!state?.interactiveSetPiece || state.status !== "set_piece_pause") return;
    const piece = state.interactiveSetPiece;
    const onAttackingSide = side === piece.attacking;
    if (action.role === "attack" && !onAttackingSide) return;
    if (action.role === "defend" && onAttackingSide) return;
    const isAttacker = action.role === "attack";
    const next = mergeSetPiecePick(state, isAttacker, action.choice);
    store.setMatchState(next);
    return;
  }

  if (action.type === "set_captain") {
    if (side === "away") store.callAwayCaptain(action.playerName);
    else store.callHomeCaptain(action.playerName);
    return;
  }

  const nextMeta = applyMpActionToMeta(meta, action, side);
  store.setMpMatchMeta(nextMeta);

  if (nextMeta.pause && canResumePause(nextMeta.pause)) {
    tryResumeMpPause(nextMeta);
  }
}

export function tryResumeMpPause(meta: MpMatchMeta): boolean {
  const pause = meta.pause;
  if (!pause) return false;

  const { lineup, opponentLineup } = useGameStore.getState();
  const homeLineup = (pause.pendingHomeLineup as LineupSlot[] | undefined) ?? lineup;
  const awayLineup = (pause.pendingAwayLineup as LineupSlot[] | undefined) ?? opponentLineup;
  const homeSubs = pause.pendingHomeSubsMade ?? 0;
  const awaySubs = pause.pendingAwaySubsMade ?? 0;

  if (pause.kind === "subs") {
    confirmMultiplayerSubs(homeLineup, homeSubs, awayLineup, awaySubs);
    return true;
  }

  if (pause.kind === "halftime") {
    confirmMultiplayerHalftime(
      homeLineup,
      homeSubs,
      awayLineup,
      awaySubs,
      pause.pendingHomeTactics ?? undefined,
      pause.pendingHomeCaptain ?? undefined,
      pause.pendingAwayTactics ?? undefined,
      pause.pendingAwayCaptain ?? undefined
    );
    return true;
  }

  if (pause.kind === "extra_time") {
    resumeMultiplayerExtraTime(meta);
    return true;
  }

  return false;
}

export function resumeMultiplayerExtraTime(meta: MpMatchMeta): void {
  const state = useGameStore.getState().matchState;
  if (!state || state.status !== "extra_time_choice") return;
  const pause = meta.pause;
  if (!pause) return;

  const homeApproach =
    (pause.pendingHomeExtraTime as ExtraTimeApproach | undefined) ??
    cpuPickExtraTimeApproach(state.score, true);
  const awayApproach =
    (pause.pendingAwayExtraTime as ExtraTimeApproach | undefined) ??
    cpuPickExtraTimeApproach(state.score, false);
  const mins = state.stoppageMinutes;

  useGameStore.setState({
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
    mpMatchMeta: { ...meta, pause: null },
  });
}
