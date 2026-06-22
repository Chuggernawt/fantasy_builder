import type { PlayerCareerStats } from "./career-stats";
import { notifyAccountProgressChanged } from "./account-progress-sync";
import { useGameStore } from "@/store/game-store";

export function applyCareerStatsUpdate(
  updater: (stats: PlayerCareerStats) => PlayerCareerStats
): void {
  const prev = useGameStore.getState().careerStats;
  const next = updater(prev);
  useGameStore.setState({ careerStats: next });
  notifyAccountProgressChanged();
}

/** Debounced push of account progress to per-user local cache + cloud profile. */
export function scheduleCareerStatsSync(_stats?: PlayerCareerStats): void {
  notifyAccountProgressChanged();
}

export { notifyAccountProgressChanged };
