"use client";

import type { LineupSlot, TacticalStyle } from "@/lib/types";
import type { MpPlayerAction } from "@/lib/multiplayer-types";
import { MAX_MATCH_SUBS } from "@/lib/constants";
import {
  beginMpSubPause,
  canResumePause,
  defaultMpMatchMeta,
} from "@/lib/multiplayer-match-flow";
import { applyMpActionToMeta, tryResumeMpPause } from "@/lib/multiplayer-host";
import { updateMyMpAction } from "@/lib/multiplayer";
import type { MatchSide } from "@/lib/multiplayer-perspective";
import { useGameStore } from "@/store/game-store";

export async function requestMultiplayerSubs(
  roomId: string,
  side: MatchSide,
  isHost: boolean
): Promise<void> {
  const state = useGameStore.getState().matchState;
  if (!state || state.status !== "running") return;
  const subsUsed = side === "home" ? state.homeSubsUsed : state.awaySubsUsed;
  if (subsUsed >= MAX_MATCH_SUBS) return;

  if (isHost) {
    useGameStore.getState().setMatchState({ ...state, status: "sub_window" });
    const meta = useGameStore.getState().mpMatchMeta ?? defaultMpMatchMeta();
    useGameStore.getState().setMpMatchMeta(beginMpSubPause(meta));
    return;
  }

  await updateMyMpAction(roomId, { type: "request_subs" });
}

export async function signalMultiplayerTactic(
  roomId: string,
  side: MatchSide,
  isHost: boolean,
  tactic: TacticalStyle
): Promise<void> {
  if (isHost && side === "home") {
    useGameStore.getState().setHomeTactic(tactic);
    return;
  }
  if (isHost && side === "away") {
    useGameStore.getState().setAwayTactic(tactic);
    return;
  }
  await updateMyMpAction(roomId, { type: "set_tactic", tactic });
}

export async function signalMultiplayerCaptain(
  roomId: string,
  side: MatchSide,
  isHost: boolean,
  playerName: string
): Promise<void> {
  if (isHost && side === "home") {
    useGameStore.getState().callHomeCaptain(playerName);
    return;
  }
  if (isHost && side === "away") {
    useGameStore.getState().callAwayCaptain(playerName);
    return;
  }
  await updateMyMpAction(roomId, { type: "set_captain", playerName });
}

export async function confirmMultiplayerSubsPause(
  roomId: string,
  side: MatchSide,
  isHost: boolean,
  lineup: LineupSlot[],
  subsMade: number
): Promise<void> {
  const action: MpPlayerAction = { type: "subs_ready", lineup, subsMade };

  if (isHost) {
    const meta = useGameStore.getState().mpMatchMeta ?? defaultMpMatchMeta();
    const nextMeta = applyMpActionToMeta(meta, action, side);
    useGameStore.getState().setMpMatchMeta(nextMeta);
    if (nextMeta.pause && canResumePause(nextMeta.pause)) {
      tryResumeMpPause(nextMeta);
    }
    return;
  }

  await updateMyMpAction(roomId, action);
}

export async function confirmMultiplayerHalftimePause(
  roomId: string,
  side: MatchSide,
  isHost: boolean,
  lineup: LineupSlot[],
  subsMade: number,
  tactic?: TacticalStyle | null,
  captain?: string | null
): Promise<void> {
  const action: MpPlayerAction = {
    type: "halftime_ready",
    lineup,
    subsMade,
    tactic: tactic ?? null,
    captain: captain ?? null,
  };

  if (isHost) {
    const meta = useGameStore.getState().mpMatchMeta ?? defaultMpMatchMeta();
    const nextMeta = applyMpActionToMeta(meta, action, side);
    useGameStore.getState().setMpMatchMeta(nextMeta);
    if (nextMeta.pause && canResumePause(nextMeta.pause)) {
      tryResumeMpPause(nextMeta);
    }
    return;
  }

  await updateMyMpAction(roomId, action);
}

export async function signalMultiplayerRematch(
  roomId: string,
  side: MatchSide,
  isHost: boolean
): Promise<void> {
  if (isHost) {
    const meta = useGameStore.getState().mpMatchMeta ?? defaultMpMatchMeta();
    useGameStore.getState().setMpMatchMeta({
      ...meta,
      rematch: { ...meta.rematch, host: true },
    });
    return;
  }
  await updateMyMpAction(roomId, { type: "rematch" });
}

export function hostForceResumePause(): void {
  const meta = useGameStore.getState().mpMatchMeta;
  if (!meta?.pause) return;
  tryResumeMpPause(meta);
}
