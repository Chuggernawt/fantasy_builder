"use client";

import { useCallback, useEffect, useRef } from "react";
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
} from "@/lib/multiplayer-session";
import { useGameStore } from "@/store/game-store";
import type { MatchState } from "@/lib/types";
import type { MpMatchMeta } from "@/lib/multiplayer-types";

const DRAFT_PUSH_MS = 800;
const CLIENT_POLL_MS = 1000;

function mpSyncKey(meta: MpMatchMeta | null | undefined): string {
  const p = meta?.pause;
  if (!p) return "mp:idle";
  return `mp:${p.kind}:${p.endsAt}:${p.homeReady}:${p.awayReady}:${p.pendingHomeSubsMade ?? 0}:${p.pendingAwaySubsMade ?? 0}`;
}

function matchSyncKey(
  state: MatchState | null | undefined,
  mp: MpMatchMeta | null | undefined
): string | null {
  if (!state) return null;
  const base = `${state.status}:${state.half}:${state.tick}:${state.score.home}-${state.score.away}:${state.commentary.length}`;
  return `${base}|${mpSyncKey(mp)}`;
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
  const roomId = resolveRoomId(roomIdProp ?? null);
  const isHost = isMultiplayerSimHost();
  const lastPushedKey = useRef<string | null>(null);
  const lastAppliedKey = useRef<string | null>(null);
  const pushInFlight = useRef(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyRemoteSnapshot = useCallback(
    (snapshot: MultiplayerSnapshot | null | undefined) => {
      if (!snapshot?.matchState) return;
      const key = matchSyncKey(snapshot.matchState, snapshot.mp ?? null);
      if (!key || key === lastAppliedKey.current) return;
      if (isHost && key === lastPushedKey.current) return;
      lastAppliedKey.current = key;
      applySnapshotToStore(snapshot);
    },
    [isHost]
  );

  const fetchRemoteSnapshot = useCallback(async () => {
    if (!roomId) return;
    const { data, error } = await supabase
      .from("mp_rooms")
      .select("state")
      .eq("id", roomId)
      .single();
    if (error || !data?.state) return;
    applyRemoteSnapshot(data.state as MultiplayerSnapshot);
  }, [roomId, applyRemoteSnapshot]);

  const pushSnapshot = useCallback(async () => {
    if (!roomId || !isHost || pushInFlight.current) return;
    const snapshot = createSnapshotFromStore();
    const key = matchSyncKey(snapshot.matchState, snapshot.mp ?? null);
    if (key && key === lastPushedKey.current) return;

    pushInFlight.current = true;
    try {
      await updateRoomSnapshot(roomId, snapshot);
      if (key) lastPushedKey.current = key;
    } catch {
      // Retry on next tick / draft change.
    } finally {
      pushInFlight.current = false;
    }
  }, [roomId, isHost]);

  useEffect(() => {
    if (!enabled || !roomId) return;

    let active = true;

    void fetchRemoteSnapshot().then(() => {
      if (!active) return;
    });

    const channel = supabase
      .channel(`mp-sync-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mp_rooms", filter: `id=eq.${roomId}` },
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
  }, [enabled, roomId, applyRemoteSnapshot, fetchRemoteSnapshot]);

  useEffect(() => {
    if (!enabled || !roomId || isHost) return;
    const timer = setInterval(() => {
      void fetchRemoteSnapshot();
    }, CLIENT_POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, roomId, isHost, fetchRemoteSnapshot]);

  useEffect(() => {
    if (!enabled || !roomId || !pushDraftChanges || !isHost) return;

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
  }, [enabled, roomId, pushDraftChanges, isHost, pushSnapshot]);

  useEffect(() => {
    if (!enabled || !roomId || !isHost) return;

    const unsub = useGameStore.subscribe((state, prev) => {
      if (state.matchState !== prev.matchState || state.mpMatchMeta !== prev.mpMatchMeta) {
        void pushSnapshot();
      }
    });

    return () => unsub();
  }, [enabled, roomId, isHost, pushSnapshot]);

  return {
    roomId,
    session: getMultiplayerSession(),
    isHost,
    isClient: !!roomId && !isHost,
    pushSnapshot,
  };
}
