import type { AccountProgress } from "./account-progress";
import {
  accountProgressFromStoreState,
  applyAccountProgressToStorePatch,
  emptyAccountProgress,
  hasAccountProgressActivity,
  loadLocalAccountProgress,
  mergeAccountProgress,
  migrateLegacySharedStoreProgress,
  reconcileAccountProgressWithProfile,
  saveLocalAccountProgress,
} from "./account-progress";
import { saveProfileProgress } from "./multiplayer";
import { useGameStore } from "@/store/game-store";

let activeUserId: string | null | undefined = undefined;
let localSaveTimer: ReturnType<typeof setTimeout> | null = null;
let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null;

export function getActiveAccountUserId(): string | null | undefined {
  return activeUserId;
}

function persistCurrentProgressToLocal(userId: string | null): void {
  const snapshot = accountProgressFromStoreState(useGameStore.getState());
  saveLocalAccountProgress(userId, snapshot);
}

export function scheduleAccountProgressLocalSave(): void {
  if (typeof window === "undefined") return;
  if (activeUserId === undefined) return;
  if (localSaveTimer) clearTimeout(localSaveTimer);
  localSaveTimer = setTimeout(() => {
    localSaveTimer = null;
    persistCurrentProgressToLocal(activeUserId ?? null);
  }, 400);
}

export function scheduleAccountProgressCloudSync(): void {
  if (typeof window === "undefined") return;
  if (!activeUserId) return;
  const userId = activeUserId;
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    cloudSyncTimer = null;
    const snapshot = accountProgressFromStoreState(useGameStore.getState());
    saveLocalAccountProgress(userId, snapshot);
    void saveProfileProgress(snapshot).catch(() => {
      // Offline — local per-account cache is enough for now.
    });
  }, 1500);
}

export function notifyAccountProgressChanged(): void {
  scheduleAccountProgressLocalSave();
  scheduleAccountProgressCloudSync();
}

/** Swap in progress for the signed-in user (or guest when signed out). */
export async function switchAccountProgress(nextUserId: string | null): Promise<void> {
  if (typeof window === "undefined") return;

  const previousUserId = activeUserId;
  const outgoingSnapshot = accountProgressFromStoreState(useGameStore.getState());

  if (previousUserId !== undefined) {
    saveLocalAccountProgress(previousUserId ?? null, outgoingSnapshot);
  }

  let nextProgress = emptyAccountProgress();

  if (nextUserId) {
    let cached = loadLocalAccountProgress(nextUserId);
    const legacy = migrateLegacySharedStoreProgress();
    if (legacy && !hasAccountProgressActivity(cached)) {
      cached = mergeAccountProgress(cached, legacy);
    }

    const guestSession =
      previousUserId === null || previousUserId === undefined
        ? outgoingSnapshot
        : emptyAccountProgress();
    const guestCache =
      previousUserId === null ? guestSession : loadLocalAccountProgress(null);

    let merged = cached;
    if (hasAccountProgressActivity(guestCache)) {
      merged = mergeAccountProgress(merged, guestCache);
    }

    try {
      const { getMyProfile } = await import("./multiplayer");
      const profile = await getMyProfile();
      merged = reconcileAccountProgressWithProfile(merged, profile);
    } catch {
      // Unsigned or profile unavailable — local merge only.
    }

    nextProgress = merged;
    saveLocalAccountProgress(nextUserId, nextProgress);

    if (previousUserId === null && hasAccountProgressActivity(guestCache)) {
      saveLocalAccountProgress(null, emptyAccountProgress());
    }
  } else {
    nextProgress = loadLocalAccountProgress(null);
    if (!hasAccountProgressActivity(nextProgress)) {
      const legacy = migrateLegacySharedStoreProgress();
      if (legacy) {
        nextProgress = legacy;
        saveLocalAccountProgress(null, legacy);
      }
    }
  }

  activeUserId = nextUserId;
  useGameStore.setState(applyAccountProgressToStorePatch(nextProgress));

  if (nextUserId) {
    scheduleAccountProgressCloudSync();
  }
}

export function installAccountProgressPersistence(): () => void {
  return useGameStore.subscribe((state, prev) => {
    if (activeUserId === undefined) return;
    if (
      state.careerStats === prev.careerStats &&
      state.revealedStats === prev.revealedStats &&
      state.playerForm === prev.playerForm &&
      state.seasonHonours === prev.seasonHonours &&
      state.season === prev.season &&
      state.seasonSaveSlots === prev.seasonSaveSlots &&
      state.activeSeasonSlot === prev.activeSeasonSlot &&
      state.tournament === prev.tournament
    ) {
      return;
    }
    notifyAccountProgressChanged();
  });
}

/** @deprecated Use notifyAccountProgressChanged — kept for tournament win hooks. */
export function scheduleCareerStatsSync(): void {
  notifyAccountProgressChanged();
}

export type { AccountProgress };
