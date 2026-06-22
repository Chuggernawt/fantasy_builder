import type { MemberRole } from "./multiplayer-types";
import type { MatchSide } from "./multiplayer-perspective";

const ROOM_KEY = "fb_mp_room_id";
const ROLE_KEY = "fb_mp_role";
const MATCH_SIDE_KEY = "fb_mp_match_side";
const SIM_HOST_KEY = "fb_mp_sim_host";
const SYNC_RESET_KEY = "fb_mp_sync_reset";

export function bumpMultiplayerSyncGeneration(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SYNC_RESET_KEY, String(Date.now()));
}

export function consumeMultiplayerSyncReset(): boolean {
  if (typeof window === "undefined") return false;
  const v = sessionStorage.getItem(SYNC_RESET_KEY);
  if (!v) return false;
  sessionStorage.removeItem(SYNC_RESET_KEY);
  return true;
}

export interface MultiplayerSession {
  roomId: string;
  role: MemberRole;
  /** Active fixture perspective (tournament or friendly). */
  matchSide?: MatchSide | null;
  /** Runs simulation ticks and pushes snapshots to the room. */
  simHost?: boolean;
}

export function getMultiplayerSession(): MultiplayerSession | null {
  if (typeof window === "undefined") return null;
  const roomId = sessionStorage.getItem(ROOM_KEY);
  const role = sessionStorage.getItem(ROLE_KEY) as MemberRole | null;
  if (!roomId || !role) return null;
  const matchSideRaw = sessionStorage.getItem(MATCH_SIDE_KEY) as MatchSide | null;
  const simHostRaw = sessionStorage.getItem(SIM_HOST_KEY);
  return {
    roomId,
    role,
    matchSide: matchSideRaw ?? undefined,
    simHost: simHostRaw === null ? undefined : simHostRaw === "true",
  };
}

export function setMultiplayerSession(
  roomId: string,
  role: MemberRole,
  opts?: { matchSide?: MatchSide | null; simHost?: boolean }
): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ROOM_KEY, roomId);
  sessionStorage.setItem(ROLE_KEY, role);

  if (opts?.matchSide) {
    sessionStorage.setItem(MATCH_SIDE_KEY, opts.matchSide);
  } else if (role === "host" || role === "away") {
    sessionStorage.setItem(MATCH_SIDE_KEY, role === "host" ? "home" : "away");
  } else {
    sessionStorage.removeItem(MATCH_SIDE_KEY);
  }

  const simHost =
    opts?.simHost ?? (role === "host" ? true : role === "away" ? false : undefined);
  if (simHost !== undefined) {
    sessionStorage.setItem(SIM_HOST_KEY, String(simHost));
  } else {
    sessionStorage.removeItem(SIM_HOST_KEY);
  }
}

export function clearMultiplayerSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ROOM_KEY);
  sessionStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem(MATCH_SIDE_KEY);
  sessionStorage.removeItem(SIM_HOST_KEY);
}

export function isMultiplayerSimHost(): boolean {
  const session = getMultiplayerSession();
  if (!session) return false;
  if (session.simHost !== undefined) return session.simHost;
  return session.role === "host";
}

/** @deprecated Use isMultiplayerSimHost for simulation authority. */
export function isMultiplayerHost(): boolean {
  return isMultiplayerSimHost();
}

export function isMultiplayerClient(): boolean {
  const session = getMultiplayerSession();
  return !!session && !isMultiplayerSimHost();
}

export function resolveRoomId(queryRoomId: string | null): string | null {
  return queryRoomId || getMultiplayerSession()?.roomId || null;
}

/** True when the client is already in a child fixture room — don't overwrite from hub polls. */
export function isForeignMultiplayerSession(hubRoomId: string): boolean {
  const existing = getMultiplayerSession();
  return !!existing?.roomId && existing.roomId !== hubRoomId;
}
