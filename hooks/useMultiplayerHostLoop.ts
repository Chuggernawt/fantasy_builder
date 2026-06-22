"use client";

import { useEffect, useRef } from "react";
import {
  clearMemberMpAction,
  listRoomMembers,
  resetRoomForRematch,
} from "@/lib/multiplayer";
import {
  beginMpHalftimePause,
  beginMpExtraTimePause,
  canResumePause,
  defaultMpMatchMeta,
} from "@/lib/multiplayer-match-flow";
import { processMemberMpAction, tryResumeMpPause } from "@/lib/multiplayer-host";
import { useGameStore } from "@/store/game-store";
import type { MpMatchMeta, MpPlayerAction } from "@/lib/multiplayer-types";
import type { MemberRole } from "@/lib/multiplayer-types";

function resolveMemberMatchSide(
  member: { user_id: string; role: MemberRole },
  meta: MpMatchMeta | null | undefined
): "home" | "away" | null {
  const tf = meta?.tournamentFixture;
  if (tf) {
    if (member.user_id === tf.homeUserId) return "home";
    if (member.user_id === tf.awayUserId) return "away";
    return null;
  }
  return member.role === "host" ? "home" : member.role === "away" ? "away" : null;
}

const HOST_POLL_MS = 1000;

interface UseMultiplayerHostLoopOptions {
  roomId: string | null;
  enabled: boolean;
  pushSnapshot: () => Promise<void>;
  onRematchReset?: () => void;
}

export function useMultiplayerHostLoop({
  roomId,
  enabled,
  pushSnapshot,
  onRematchReset,
}: UseMultiplayerHostLoopOptions) {
  const rematchHandled = useRef(false);

  useEffect(() => {
    if (!enabled || !roomId) return;

    let active = true;

    const tick = async () => {
      if (!active) return;

      const state = useGameStore.getState().matchState;
      let meta = useGameStore.getState().mpMatchMeta ?? defaultMpMatchMeta();

      if (state?.status === "halftime" && !meta.pause) {
        meta = beginMpHalftimePause(meta);
        useGameStore.getState().setMpMatchMeta(meta);
        await pushSnapshot();
      }

      if (state?.status === "extra_time_choice" && !meta.pause) {
        meta = beginMpExtraTimePause(meta);
        useGameStore.getState().setMpMatchMeta(meta);
        await pushSnapshot();
      }

      try {
        const members = await listRoomMembers(roomId);
        const meta = useGameStore.getState().mpMatchMeta ?? defaultMpMatchMeta();
        for (const m of members) {
          if (!m.mp_action) continue;
          const side = resolveMemberMatchSide(m, meta);
          if (!side) continue;
          processMemberMpAction(m.mp_action, side);
          await clearMemberMpAction(roomId, m.user_id);
        }
      } catch {
        // Retry next tick.
      }

      meta = useGameStore.getState().mpMatchMeta ?? defaultMpMatchMeta();

      if (meta.pause && canResumePause(meta.pause)) {
        tryResumeMpPause(meta);
        await pushSnapshot();
      }

      if (meta.rematch.host && meta.rematch.away && !rematchHandled.current) {
        rematchHandled.current = true;
        try {
          await resetRoomForRematch(roomId);
          useGameStore.getState().resetMatch();
          onRematchReset?.();
        } catch {
          rematchHandled.current = false;
        }
        return;
      }

      await pushSnapshot();
    };

    const timer = setInterval(() => {
      void tick();
    }, HOST_POLL_MS);

    void tick();

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enabled, roomId, pushSnapshot, onRematchReset]);
}
