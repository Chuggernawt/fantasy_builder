/** 20 ticks × 3s = 60s per half */
export const TICKS_PER_HALF = 20;
export const TICK_MS = 3000;

export function commentaryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function minuteFromTick(half: 1 | 2, tick: number): number {
  const base = half === 1 ? 0 : 45;
  return base + Math.min(45, Math.round((tick / TICKS_PER_HALF) * 45));
}

/** In-game minute range covered by a single sim tick. */
export function tickMinuteWindow(
  half: 1 | 2,
  tick: number
): { start: number; end: number } {
  const base = half === 1 ? 0 : 45;
  const cap = half === 1 ? 45 : 90;
  const end = Math.min(cap, minuteFromTick(half, tick));
  const prev =
    tick <= 1 ? base : Math.min(cap, minuteFromTick(half, tick - 1));
  const start = tick <= 1 ? base : Math.max(base + 1, prev);
  return { start, end: Math.max(start, end) };
}

/** Spread multiple same-tick events across distinct minutes in the tick window. */
export function spreadEventMinutes(
  events: { minute: number }[],
  half: 1 | 2,
  tick: number
): void {
  if (!events.length) return;
  const { start, end } = tickMinuteWindow(half, tick);
  const cap = half === 1 ? 45 : 90;

  if (events.length === 1) {
    events[0].minute = end;
    return;
  }

  const span = Math.max(1, end - start);
  events.forEach((e, i) => {
    const step = Math.round((span * (i + 1)) / events.length);
    const minute = start + step;
    e.minute = Math.min(cap, Math.max(start + (i === 0 ? 0 : 1), minute));
  });
}
