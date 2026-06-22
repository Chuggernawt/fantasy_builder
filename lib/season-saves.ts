import type { SeasonState } from "./season-types";

export const SEASON_SAVE_SLOT_COUNT = 3;
export const SEASON_TRANSFER_LOG_LIMIT = 10;
export const SEASON_RELEGATION_ZONE = 3;

export type SeasonSaveSlotIndex = 0 | 1 | 2;

export interface SeasonSaveSlot {
  season: SeasonState;
  savedAt: string;
}

export type SeasonSaveSlots = [
  SeasonSaveSlot | null,
  SeasonSaveSlot | null,
  SeasonSaveSlot | null,
];

export function emptySeasonSaveSlots(): SeasonSaveSlots {
  return [null, null, null];
}

export function normalizeSeasonSaveSlots(raw: unknown): SeasonSaveSlots {
  const empty = emptySeasonSaveSlots();
  if (!Array.isArray(raw)) return empty;
  return empty.map((_, i) => {
    const slot = raw[i];
    if (!slot || typeof slot !== "object") return null;
    const s = slot as Partial<SeasonSaveSlot>;
    if (!s.season || typeof s.savedAt !== "string") return null;
    return { season: s.season as SeasonState, savedAt: s.savedAt };
  }) as SeasonSaveSlots;
}

export function seasonSaveSlotSummary(slot: SeasonSaveSlot | null): string {
  if (!slot) return "Empty";
  const s = slot.season;
  const md =
    s.status === "finished"
      ? s.length
      : Math.max(0, s.currentMatchday - 1);
  return `Season ${s.seasonNumber} · MD ${md}/${s.length} · ${s.status === "finished" ? "Complete" : "In progress"}`;
}

export function capTransferHistory<T>(history: T[] | undefined): T[] {
  if (!history?.length) return [];
  return history.slice(-SEASON_TRANSFER_LOG_LIMIT);
}
