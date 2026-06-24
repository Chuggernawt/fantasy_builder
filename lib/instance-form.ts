import { FORM_MAX, FORM_MIN, applyFormDelta, formDeltaFromRating } from "./match-rating";
import type { LineupSlot, PlayerMatchStats } from "./types";

/** Per-universe player form for a season or tournament instance. */
export type InstanceFormMap = Record<string, Record<string, number>>;

export function getPlayerFormValue(
  formMap: InstanceFormMap | undefined,
  universeId: string,
  playerName: string
): number {
  return formMap?.[universeId]?.[playerName] ?? 0;
}

export function buildInstanceFormMap(
  homeUni: string,
  awayUni: string,
  homeLineup: LineupSlot[],
  awayLineup: LineupSlot[],
  formMap: InstanceFormMap | undefined
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of homeLineup) {
    if (s.playerName) map[s.playerName] = getPlayerFormValue(formMap, homeUni, s.playerName);
  }
  for (const s of awayLineup) {
    if (s.playerName) map[s.playerName] = getPlayerFormValue(formMap, awayUni, s.playerName);
  }
  return map;
}

export function updateTeamFormFromMatch(
  formMap: InstanceFormMap,
  universeId: string,
  stats: Record<string, PlayerMatchStats>,
  lineup: LineupSlot[]
): InstanceFormMap {
  const uni = { ...(formMap[universeId] ?? {}) };
  for (const s of lineup) {
    if (!s.playerName) continue;
    const row = stats[s.playerName];
    if (!row?.matchRating) continue;
    const delta = formDeltaFromRating(row.matchRating);
    uni[s.playerName] = applyFormDelta(uni[s.playerName] ?? 0, delta);
  }
  return { ...formMap, [universeId]: uni };
}

export function emptyTeamForm(playerNames: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const n of playerNames) map[n] = 0;
  return map;
}

export type FormBand = "poor" | "low" | "neutral" | "good" | "hot";

export function formBand(value: number): FormBand {
  const v = Math.max(FORM_MIN, Math.min(FORM_MAX, value));
  if (v <= -3) return "poor";
  if (v <= -1) return "low";
  if (v <= 1) return "neutral";
  if (v <= 3) return "good";
  return "hot";
}

export function formBandClass(band: FormBand): string {
  switch (band) {
    case "poor":
      return "bg-red-500/80 text-white";
    case "low":
      return "bg-orange-500/70 text-white";
    case "neutral":
      return "bg-slate-600/80 text-slate-200";
    case "good":
      return "bg-emerald-600/70 text-white";
    case "hot":
      return "bg-emerald-400/90 text-stadium";
  }
}

/** Solid bar colour for form indicators (no text). */
export function formBarBgClass(value: number): string {
  switch (formBand(value)) {
    case "poor":
      return "bg-red-500";
    case "low":
      return "bg-orange-500";
    case "neutral":
      return "bg-slate-500";
    case "good":
      return "bg-emerald-600";
    case "hot":
      return "bg-emerald-400";
  }
}

export function formDisplayValue(value: number): string {
  const v = Math.max(FORM_MIN, Math.min(FORM_MAX, Math.round(value * 10) / 10));
  return v > 0 ? `+${v}` : `${v}`;
}
