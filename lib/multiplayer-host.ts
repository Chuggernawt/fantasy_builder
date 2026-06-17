import type { LineupSlot, MatchState, TacticalStyle } from "./types";
import type { MpMatchMeta, MpPlayerAction } from "./multiplayer-types";
import { useGameStore } from "@/store/game-store";
import { commentaryId } from "./simulation-utils";
import { resetSetPieceBudgetForHalf } from "./set-piece-interactive";
import { refreshStaminaAfterLineupChange } from "./subs";
import { subAnnouncementLines } from "./sub-utils";
import { CAPTAIN_BOOST_TICKS, MAX_MATCH_SUBS } from "./constants";
import {
  beginMpSubPause,
  canResumePause,
} from "./multiplayer-match-flow";
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
  if (!state || state.status !== "sub_window") return;

  const homeStamina = refreshStaminaAfterLineupChange(
    oldHome,
    homeLineup,
    state.homeStamina
  );
  const awayStamina = refreshStaminaAfterLineupChange(
    oldAway,
    awayLineup,
    state.awayStamina
  );

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
      commentary: [...state.commentary, ...homeEvents, ...awayEvents],
    },
    mpMatchMeta: { ...useGameStore.getState().mpMatchMeta!, pause: null },
  });
}

export function confirmMultiplayerHalftime(
  homeLineup: LineupSlot[],
  homeSubsMade: number,
  awayLineup: LineupSlot[],
  awaySubsMade: number,
  homeTactic: TacticalStyle | null | undefined,
  homeCaptain: string | null | undefined,
  awayTactic: TacticalStyle | null | undefined,
  awayCaptain: string | null | undefined
): void {
  const state = useGameStore.getState().matchState;
  const oldHome = useGameStore.getState().lineup;
  const oldAway = useGameStore.getState().opponentLineup;
  if (!state || state.status !== "halftime") return;

  const homeStamina = refreshStaminaAfterLineupChange(
    oldHome,
    homeLineup,
    state.homeStamina
  );
  const awayStamina = refreshStaminaAfterLineupChange(
    oldAway,
    awayLineup,
    state.awayStamina
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
    homeTactic: homeTactic ?? state.homeTactic,
    homeTacticHalf: homeTactic ? 2 : state.homeTacticHalf,
    homeCaptain: homeCaptain ?? state.homeCaptain,
    homeCaptainHalf: homeCaptain ? 2 : state.homeCaptainHalf,
    homeCaptainBoostTicks: homeCaptain ? CAPTAIN_BOOST_TICKS : state.homeCaptainBoostTicks,
    awayTactic: awayTactic ?? state.awayTactic,
    awayTacticHalf: awayTactic ? 2 : state.awayTacticHalf,
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

  if (action.type === "halftime_ready" && pause.kind === "halftime") {
    if (side === "home") {
      return {
        ...meta,
        pause: {
          ...pause,
          homeReady: true,
          pendingHomeLineup: action.lineup,
          pendingHomeSubsMade: action.subsMade,
          pendingHomeTactic: action.tactic ?? null,
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
        pendingAwayTactic: action.tactic ?? null,
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
    if (side === "away") store.setAwayTactic(action.tactic as TacticalStyle);
    else store.setHomeTactic(action.tactic as TacticalStyle);
    return;
  }

  if (action.type === "set_piece_pick") {
    const state = store.matchState;
    if (!state?.interactiveSetPiece || state.status !== "set_piece_pause") return;
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
      (pause.pendingHomeTactic as TacticalStyle | null) ?? undefined,
      pause.pendingHomeCaptain ?? undefined,
      (pause.pendingAwayTactic as TacticalStyle | null) ?? undefined,
      pause.pendingAwayCaptain ?? undefined
    );
    return true;
  }

  return false;
}
