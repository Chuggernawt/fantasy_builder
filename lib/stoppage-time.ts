import type { CommentaryType, ExtraTimeApproach, MatchScore, MatchState } from "./types";

export const TICKS_PER_STOPPAGE_MINUTE = 3;
export const MAX_STOPPAGE_MINUTES = 10;

export const EXTRA_TIME_OPTIONS: {
  id: ExtraTimeApproach;
  label: string;
  hint: string;
}[] = [
  { id: "park_bus", label: "Park the Bus", hint: "+20% defence, −30% attack" },
  { id: "defend", label: "Defend", hint: "+10% defence, −10% attack" },
  { id: "balanced", label: "Balanced", hint: "No change to shape" },
  { id: "attack", label: "Attack", hint: "+10% attack, −10% defence" },
  { id: "kitchen_sink", label: "Kitchen Sink", hint: "+20% attack, −30% defence" },
];

const EXTRA_TIME_LABELS: Record<ExtraTimeApproach, string> = {
  park_bus: "Park the Bus",
  defend: "Defend",
  balanced: "Balanced",
  attack: "Attack",
  kitchen_sink: "Kitchen Sink",
};

export function extraTimeLabel(approach: ExtraTimeApproach): string {
  return EXTRA_TIME_LABELS[approach];
}

export function extraTimeMultipliers(approach: ExtraTimeApproach | null): {
  atk: number;
  def: number;
} {
  switch (approach) {
    case "park_bus":
      return { atk: 0.7, def: 1.2 };
    case "defend":
      return { atk: 0.9, def: 1.1 };
    case "attack":
      return { atk: 1.1, def: 0.9 };
    case "kitchen_sink":
      return { atk: 1.2, def: 0.7 };
    default:
      return { atk: 1, def: 1 };
  }
}

/** Display clock for a stoppage tick (1-based tick index). */
export function stoppageClockDisplay(stoppageTick: number): { minute: number; second: number } {
  const idx = Math.max(0, stoppageTick - 1);
  const second = ((idx % TICKS_PER_STOPPAGE_MINUTE) + 1) * 15;
  const minute = 90 + Math.floor(idx / TICKS_PER_STOPPAGE_MINUTE);
  return { minute, second };
}

export function formatStoppageClock(stoppageTick: number): string {
  const { minute, second } = stoppageClockDisplay(stoppageTick);
  return `${minute}:${String(second).padStart(2, "0")}`;
}

export function formatMatchClock(state: MatchState): string {
  if (state.inStoppageTime && state.stoppageTick > 0) {
    return formatStoppageClock(state.stoppageTick);
  }
  if (state.status === "extra_time_choice") {
    return "90:00";
  }
  const minute =
    state.half === 1
      ? Math.round((state.tick / state.ticksPerHalf) * 45)
      : Math.min(90, 45 + Math.round((state.tick / state.ticksPerHalf) * 45));
  return `${minute}'`;
}

const STOPPAGE_WEIGHTS: Partial<Record<CommentaryType, number>> = {
  goal: 2,
  foul: 1,
  yellowcard: 1,
  redcard: 2,
  substitution: 1,
  corner: 0.5,
  freekick: 0.5,
  penalty: 1.5,
  save: 0.25,
};

export function stoppageWeightForEvent(type: CommentaryType): number {
  return STOPPAGE_WEIGHTS[type] ?? 0;
}

/** Compute added minutes (1–10, average ~4). */
export function computeStoppageMinutes(stoppageCount: number, score: MatchScore): number {
  let mins = 2 + stoppageCount * 0.38;
  if (score.home === 0 && score.away === 0) {
    mins += 1.75;
  }
  mins += (Math.random() - 0.5) * 1.2;
  return Math.max(1, Math.min(MAX_STOPPAGE_MINUTES, Math.round(mins)));
}

export function cpuPickExtraTimeApproach(
  score: MatchScore,
  isHome: boolean
): ExtraTimeApproach {
  const goalsFor = isHome ? score.home : score.away;
  const goalsAgainst = isHome ? score.away : score.home;
  const diff = goalsFor - goalsAgainst;

  if (diff < 0) {
    return Math.random() < 0.65 ? "kitchen_sink" : "attack";
  }
  if (diff > 0) {
    return Math.random() < 0.6 ? "park_bus" : "defend";
  }
  const roll = Math.random();
  if (roll < 0.2) return "park_bus";
  if (roll < 0.4) return "defend";
  if (roll < 0.6) return "balanced";
  if (roll < 0.8) return "attack";
  return "kitchen_sink";
}

export function spreadStoppageEventMinutes(
  events: { minute: number }[],
  stoppageTick: number
): void {
  if (!events.length) return;
  const { minute } = stoppageClockDisplay(stoppageTick);
  for (const e of events) {
    e.minute = minute;
  }
}
