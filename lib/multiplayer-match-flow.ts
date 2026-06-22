import type { MpMatchMeta, MpPauseState } from "./multiplayer-types";

export const MP_SUB_PAUSE_MS = 20_000;
export const MP_HALFTIME_PAUSE_MS = 30_000;
export const MP_EXTRA_TIME_PAUSE_MS = 15_000;

export function defaultMpMatchMeta(): MpMatchMeta {
  return { pause: null, rematch: { host: false, away: false } };
}

export function beginMpSubPause(meta: MpMatchMeta): MpMatchMeta {
  return {
    ...meta,
    pause: {
      kind: "subs",
      endsAt: new Date(Date.now() + MP_SUB_PAUSE_MS).toISOString(),
      homeReady: false,
      awayReady: false,
    },
  };
}

export function beginMpHalftimePause(meta: MpMatchMeta): MpMatchMeta {
  return {
    ...meta,
    pause: {
      kind: "halftime",
      endsAt: new Date(Date.now() + MP_HALFTIME_PAUSE_MS).toISOString(),
      homeReady: false,
      awayReady: false,
    },
  };
}

export function beginMpExtraTimePause(meta: MpMatchMeta): MpMatchMeta {
  return {
    ...meta,
    pause: {
      kind: "extra_time",
      endsAt: new Date(Date.now() + MP_EXTRA_TIME_PAUSE_MS).toISOString(),
      homeReady: false,
      awayReady: false,
    },
  };
}

export function pauseTimeLeft(pause: MpPauseState | null | undefined): number {
  if (!pause?.endsAt) return 0;
  return Math.max(0, Math.ceil((new Date(pause.endsAt).getTime() - Date.now()) / 1000));
}

export function pauseExpired(pause: MpPauseState | null | undefined): boolean {
  if (!pause?.endsAt) return false;
  return Date.now() >= new Date(pause.endsAt).getTime();
}

export function bothPauseReady(pause: MpPauseState | null | undefined): boolean {
  return !!pause?.homeReady && !!pause?.awayReady;
}

export function canResumePause(pause: MpPauseState | null | undefined): boolean {
  if (!pause) return false;
  return bothPauseReady(pause) || pauseExpired(pause);
}
