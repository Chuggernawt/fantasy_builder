"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import {
  applySnapshotToStore,
  createSnapshotFromStore,
} from "@/lib/multiplayer-snapshot";
import type { MultiplayerSnapshot } from "@/lib/multiplayer-types";
import { updateRoomSnapshot } from "@/lib/multiplayer";
import {
  getMultiplayerSession,
  isMultiplayerSimHost,
  resolveRoomId,
  consumeMultiplayerSyncReset,
  setMultiplayerSession,
  bumpMultiplayerSyncGeneration,
} from "@/lib/multiplayer-session";
import { useGameStore } from "@/store/game-store";
import type { MatchState } from "@/lib/types";
import type { MpMatchMeta } from "@/lib/multiplayer-types";

const DRAFT_PUSH_MS = 800;
const CLIENT_POLL_MS = 350;

function shootoutKicksTaken(state: MatchState): number {
  const ps = state.penaltyShootout;
  if (!ps) return 0;
  return ps.homeTaken + ps.awayTaken;
}

function matchProgressRank(state: MatchState): number {
  const statusRank: Record<string, number> = {
    idle: 0,
    running: 1,
    halftime: 2,
    sub_window: 3,
    set_piece_pause: 4,
    extra_time_choice: 5,
    finished: 10,
  };
  const piecePhase = state.interactiveSetPiece?.phase === "reveal" ? 1 : 0;
  const stoppageBoost = state.inStoppageTime ? 100_000 + (state.stoppageTick ?? 0) * 100 : 0;
  return (
    stoppageBoost +
    (statusRank[state.status] ?? 0) * 1_000_000 +
    shootoutKicksTaken(state) * 10_000 +
    state.half * 1_000 +
    state.tick * 10 +
    state.commentary.length +
    piecePhase
  );
}

/** Ignore stale poll/realtime payloads that would rewind an in-progress match. */
export function isSnapshotMatchAhead(
  prev: MatchState | null | undefined,
  incoming: MatchState
): boolean {
  if (!prev) return true;
  if (incoming.status === "finished" && prev.status !== "finished") return true;

  // Host resumes open play after a corner/penalty — same tick, lower status rank.
  if (
    prev.status === "set_piece_pause" &&
    (incoming.status === "running" || incoming.status === "finished")
  ) {
    return true;
  }

  if (
    incoming.status === "extra_time_choice" &&
    prev.status === "running" &&
    prev.half === 2 &&
    !prev.inStoppageTime
  ) {
    return true;
  }

  if (
    incoming.inStoppageTime &&
    (incoming.stoppageTick ?? 0) > (prev.stoppageTick ?? 0)
  ) {
    return true;
  }

  if (
    incoming.inStoppageTime &&
    !prev.inStoppageTime &&
    incoming.half === prev.half &&
    incoming.tick === prev.tick
  ) {
    return true;
  }

  // Penalty shootout advances kick-to-kick while status stays set_piece_pause.
  if (prev.status === "set_piece_pause" && incoming.status === "set_piece_pause") {
    if (shootoutKicksTaken(incoming) > shootoutKicksTaken(prev)) return true;

    const prevPiece = prev.interactiveSetPiece;
    const nextPiece = incoming.interactiveSetPiece;
    if (prevPiece?.phase === "choose" && nextPiece?.phase === "reveal") return true;
    if (prevPiece?.phase === "reveal" && nextPiece?.phase === "choose") return true;
    if (prevPiece && !nextPiece) return true;
  }

  return matchProgressRank(incoming) >= matchProgressRank(prev);
}

function mpSyncKey(meta: MpMatchMeta | null | undefined): string {
  const p = meta?.pause;
  if (!p) return "mp:idle";
  return `mp:${p.kind}:${p.endsAt}:${p.homeReady}:${p.awayReady}:${p.pendingHomeSubsMade ?? 0}:${p.pendingAwaySubsMade ?? 0}`;
}

function staminaStatsKey(state: MatchState): string {
  const sumStamina = (map: Record<string, number>) =>
    Object.values(map)
      .reduce((a, b) => a + b, 0)
      .toFixed(0);
  const sumRating = (stats: MatchState["homePlayerStats"]) =>
    Object.values(stats ?? {})
      .reduce((a, row) => a + (row.matchRating ?? 0), 0)
      .toFixed(1);
  return `st:${sumStamina(state.homeStamina)}-${sumStamina(state.awayStamina)}:rt:${sumRating(state.homePlayerStats)}-${sumRating(state.awayPlayerStats)}`;
}

function matchSyncKey(
  state: MatchState | null | undefined,
  mp: MpMatchMeta | null | undefined
): string | null {
  if (!state) return null;
  const base = `${state.status}:${state.half}:${state.tick}:${state.inStoppageTime ? 1 : 0}:${state.stoppageTick ?? 0}:${state.stoppageMinutes ?? 0}:${state.score.home}-${state.score.away}:${state.commentary.length}`;
  const piece = state.interactiveSetPiece;
  const setPieceKey = piece
    ? `sp:${piece.kind}:${piece.phase}:${piece.attacking}:${piece.attackerPick ?? ""}:${piece.defenderPick ?? ""}:${piece.goalScored ?? ""}:${piece.chooseEndsAt}:${piece.revealEndsAt ?? ""}`
    : "sp:none";
  const ps = state.penaltyShootout;
  const shootoutKey = ps
    ? `ps:${ps.homeTaken}-${ps.awayTaken}:${ps.home}-${ps.away}:${ps.homeKicks?.length ?? 0}-${ps.awayKicks?.length ?? 0}`
    : "ps:none";
  return `${base}|${mpSyncKey(mp)}|${setPieceKey}|${shootoutKey}|${staminaStatsKey(state)}`;
}

function resolveSharedFixtureRoomId(
  mp: MpMatchMeta | null | undefined
): string | null {
  const tf = mp?.tournamentFixture;
  if (!tf || tf.localCpuMatch) return null;
  return mp?.fixtureRoomId ?? null;
}

interface UseMultiplayerSyncOptions {
  roomId?: string | null;
  enabled?: boolean;
  pushDraftChanges?: boolean;
}

export function useMultiplayerSync({
  roomId: roomIdProp,
  enabled = true,
  pushDraftChanges = false,
}: UseMultiplayerSyncOptions = {}) {
  const mpMatchMeta = useGameStore((s) => s.mpMatchMeta);
  const [sessionRepairTick, setSessionRepairTick] = useState(0);

  const syncRoomId = useMemo(() => {
    const fixtureRoomId = resolveSharedFixtureRoomId(mpMatchMeta);
    if (fixtureRoomId) return fixtureRoomId;
    return resolveRoomId(roomIdProp ?? null);
  }, [mpMatchMeta, roomIdProp, sessionRepairTick]);

  const isHost = isMultiplayerSimHost();
  const lastPushedKey = useRef<string | null>(null);
  const lastAppliedKey = useRef<string | null>(null);
  const pushInFlight = useRef(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const tf = mpMatchMeta?.tournamentFixture;
    const fixtureRoomId = mpMatchMeta?.fixtureRoomId;
    if (!tf || tf.localCpuMatch || !fixtureRoomId) return;

    const session = getMultiplayerSession();
    if (session?.roomId === fixtureRoomId) return;

    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const uid = data.user?.id;
      if (!uid) return;
      const isHome = uid === tf.homeUserId;
      const isAway = uid === tf.awayUserId;
      if (!isHome && !isAway) return;

      setMultiplayerSession(fixtureRoomId, isHome ? "host" : "away", {
        matchSide: isHome ? "home" : "away",
        simHost: isHome,
      });
      bumpMultiplayerSyncGeneration();
      lastAppliedKey.current = null;
      lastPushedKey.current = null;
      setSessionRepairTick((n) => n + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, mpMatchMeta]);

  const applyRemoteSnapshot = useCallback(
    (snapshot: MultiplayerSnapshot | null | undefined) => {
      if (!snapshot?.matchState) return;
      const prev = useGameStore.getState().matchState;
      if (!isSnapshotMatchAhead(prev, snapshot.matchState)) return;
      const key = matchSyncKey(snapshot.matchState, snapshot.mp ?? null);
      if (!key || key === lastAppliedKey.current) return;
      if (isMultiplayerSimHost() && key === lastPushedKey.current) return;
      lastAppliedKey.current = key;
      applySnapshotToStore(snapshot);
    },
    []
  );

  const fetchRemoteSnapshot = useCallback(async () => {
    if (!syncRoomId) return;
    const { data, error } = await supabase
      .from("mp_rooms")
      .select("state")
      .eq("id", syncRoomId)
      .single();
    if (error || !data?.state) return;
    applyRemoteSnapshot(data.state as MultiplayerSnapshot);
  }, [syncRoomId, applyRemoteSnapshot]);

  const pushSnapshot = useCallback(async () => {
    if (!syncRoomId || !isMultiplayerSimHost() || pushInFlight.current) return;
    const snapshot = createSnapshotFromStore();
    const key = matchSyncKey(snapshot.matchState, snapshot.mp ?? null);
    if (key && key === lastPushedKey.current) return;

    pushInFlight.current = true;
    try {
      await updateRoomSnapshot(syncRoomId, snapshot);
      if (key) lastPushedKey.current = key;
    } catch {
      // Retry on next tick / draft change.
    } finally {
      pushInFlight.current = false;
    }
  }, [syncRoomId]);

  useEffect(() => {
    if (!enabled || !syncRoomId) return;

    if (consumeMultiplayerSyncReset()) {
      lastAppliedKey.current = null;
      lastPushedKey.current = null;
    }

    let active = true;

    void fetchRemoteSnapshot().then(() => {
      if (!active) return;
    });

    const channel = supabase
      .channel(`mp-sync-${syncRoomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mp_rooms", filter: `id=eq.${syncRoomId}` },
        (payload) => {
          const next = (payload.new as { state?: MultiplayerSnapshot | null })?.state;
          applyRemoteSnapshot(next);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [enabled, syncRoomId, applyRemoteSnapshot, fetchRemoteSnapshot]);

  useEffect(() => {
    if (!enabled || !syncRoomId || isMultiplayerSimHost()) return;
    const timer = setInterval(() => {
      void fetchRemoteSnapshot();
    }, CLIENT_POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, syncRoomId, fetchRemoteSnapshot, sessionRepairTick]);

  useEffect(() => {
    if (!enabled || !syncRoomId || !pushDraftChanges || !isMultiplayerSimHost()) return;

    const schedulePush = () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(() => {
        void pushSnapshot();
      }, DRAFT_PUSH_MS);
    };

    const unsub = useGameStore.subscribe((state, prev) => {
      if (
        state.lineup !== prev.lineup ||
        state.matchBench !== prev.matchBench ||
        state.formationId !== prev.formationId ||
        state.selectedUniverseId !== prev.selectedUniverseId ||
        state.opponentLineup !== prev.opponentLineup ||
        state.opponentBench !== prev.opponentBench ||
        state.opponentFormationId !== prev.opponentFormationId ||
        state.opponentUniverseId !== prev.opponentUniverseId
      ) {
        schedulePush();
      }
    });

    return () => {
      unsub();
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [enabled, syncRoomId, pushDraftChanges, pushSnapshot, sessionRepairTick]);

  useEffect(() => {
    if (!enabled || !syncRoomId || !isMultiplayerSimHost()) return;

    const unsub = useGameStore.subscribe((state, prev) => {
      if (state.matchState !== prev.matchState || state.mpMatchMeta !== prev.mpMatchMeta) {
        void pushSnapshot();
      }
    });

    return () => unsub();
  }, [enabled, syncRoomId, pushSnapshot, sessionRepairTick]);

  return {
    roomId: syncRoomId,
    session: getMultiplayerSession(),
    isHost,
    isClient: !!syncRoomId && !isMultiplayerSimHost(),
    pushSnapshot,
  };
}
