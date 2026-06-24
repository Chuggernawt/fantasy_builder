import type { StatKey } from "./types";
import {
  emptySeasonSaveSlots,
  normalizeSeasonSaveSlots,
  type SeasonSaveSlotIndex,
  type SeasonSaveSlots,
} from "./season-saves";
import type { SeasonHonour, SeasonState } from "./season-types";
import type { TournamentState } from "./tournament-types";
import {
  emptyCareerStats,
  mergeCareerStats,
  normalizeCareerStats,
  reconcileCareerStats,
  type PlayerCareerStats,
} from "./career-stats";
import { ALL_STAT_KEYS } from "./reveal";
import type { MultiplayerProfile } from "./multiplayer-types";

/** Progress tied to an account (or guest), not shared browser-wide. */
export interface AccountProgress {
  careerStats: PlayerCareerStats;
  revealedStats: Record<string, StatKey[]>;
  playerForm: Record<string, Record<string, number>>;
  seasonHonours: SeasonHonour[];
  season: SeasonState | null;
  seasonSaveSlots: SeasonSaveSlots;
  activeSeasonSlot: SeasonSaveSlotIndex | null;
  tournament: TournamentState | null;
}

const GUEST_STORAGE_KEY = "fb_account_progress_guest";
const LEGACY_MIGRATED_KEY = "fb_account_progress_legacy_migrated";

function userStorageKey(userId: string): string {
  return `fb_account_progress_${userId}`;
}

export function emptyAccountProgress(): AccountProgress {
  return {
    careerStats: emptyCareerStats(),
    revealedStats: {},
    playerForm: {},
    seasonHonours: [],
    season: null,
    seasonSaveSlots: emptySeasonSaveSlots(),
    activeSeasonSlot: null,
    tournament: null,
  };
}

export function mergeRevealedStats(
  local: Record<string, StatKey[]>,
  remote: Record<string, StatKey[]>
): Record<string, StatKey[]> {
  const out: Record<string, StatKey[]> = { ...local };
  for (const [playerName, remoteStats] of Object.entries(remote)) {
    const merged = new Set([...(out[playerName] ?? []), ...remoteStats]);
    out[playerName] = ALL_STAT_KEYS.filter((k) => merged.has(k));
  }
  return out;
}

export function revealedStatsActivity(revealed: Record<string, StatKey[]>): number {
  return Object.values(revealed).reduce((sum, stats) => sum + stats.length, 0);
}

export function hasAccountProgressActivity(progress: AccountProgress): boolean {
  const cs = progress.careerStats;
  const matchCount =
    cs.online.matchWins +
    cs.online.matchLosses +
    cs.online.matchDraws +
    cs.offline.matchWins +
    cs.offline.matchLosses +
    cs.offline.matchDraws;
  return (
    matchCount > 0 ||
    cs.onlineTournamentWins + cs.offlineTournamentWins + cs.offlineSeasonWins > 0 ||
    revealedStatsActivity(progress.revealedStats) > 0 ||
    progress.seasonHonours.length > 0 ||
    !!progress.season ||
    progress.seasonSaveSlots.some((s) => s != null) ||
    !!progress.tournament
  );
}

function normalizeRevealedStats(raw: unknown): Record<string, StatKey[]> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, StatKey[]> = {};
  for (const [name, stats] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(stats)) continue;
    out[name] = stats.filter((s): s is StatKey => typeof s === "string");
  }
  return out;
}

export function normalizeAccountProgress(raw: unknown): AccountProgress {
  if (!raw || typeof raw !== "object") return emptyAccountProgress();
  const o = raw as Partial<AccountProgress>;
  const seasonSaveSlots = normalizeSeasonSaveSlots(o.seasonSaveSlots);
  const legacySeason = (o.season as SeasonState | null) ?? null;
  if (legacySeason && !seasonSaveSlots.some((s) => s != null)) {
    seasonSaveSlots[0] = {
      season: legacySeason,
      savedAt: new Date().toISOString(),
    };
  }
  const activeSeasonSlot: SeasonSaveSlotIndex | null =
    typeof o.activeSeasonSlot === "number" && o.activeSeasonSlot >= 0 && o.activeSeasonSlot <= 2
      ? (o.activeSeasonSlot as SeasonSaveSlotIndex)
      : null;
  return {
    careerStats: normalizeCareerStats(o.careerStats),
    revealedStats: normalizeRevealedStats(o.revealedStats),
    playerForm:
      o.playerForm && typeof o.playerForm === "object"
        ? (o.playerForm as AccountProgress["playerForm"])
        : {},
    seasonHonours: Array.isArray(o.seasonHonours) ? o.seasonHonours : [],
    season: legacySeason,
    seasonSaveSlots,
    activeSeasonSlot,
    tournament: (o.tournament as TournamentState | null) ?? null,
  };
}

export function mergeSeasonSaveSlots(
  local: SeasonSaveSlots,
  remote: SeasonSaveSlots
): SeasonSaveSlots {
  return local.map((localSlot, i) => {
    const remoteSlot = remote[i];
    if (!localSlot) return remoteSlot;
    if (!remoteSlot) return localSlot;
    const localTime = new Date(localSlot.savedAt).getTime();
    const remoteTime = new Date(remoteSlot.savedAt).getTime();
    return remoteTime > localTime ? remoteSlot : localSlot;
  }) as SeasonSaveSlots;
}

function mergeSeasonHonours(
  local: SeasonHonour[],
  remote: SeasonHonour[]
): SeasonHonour[] {
  const seen = new Set<string>();
  const out: SeasonHonour[] = [];
  for (const honour of [...local, ...remote]) {
    const key = `${honour.universeId}:${honour.seasonNumber}:${honour.completedAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(honour);
  }
  return out;
}

function resolveActiveSeason(
  season: SeasonState | null,
  activeSlot: SeasonSaveSlotIndex | null,
  slots: SeasonSaveSlots
): SeasonState | null {
  if (season) return season;
  if (activeSlot != null && slots[activeSlot]) return slots[activeSlot].season;
  return null;
}

/** Cloud-synced fields stored on profiles (career/revealed stay in their own columns). */
export type ProfileCloudProgress = Pick<
  AccountProgress,
  | "seasonSaveSlots"
  | "activeSeasonSlot"
  | "season"
  | "seasonHonours"
  | "playerForm"
  | "tournament"
>;

export function accountProgressToCloudPayload(
  progress: AccountProgress
): ProfileCloudProgress {
  return {
    seasonSaveSlots: progress.seasonSaveSlots,
    activeSeasonSlot: progress.activeSeasonSlot,
    season: progress.season,
    seasonHonours: progress.seasonHonours,
    playerForm: progress.playerForm,
    tournament: progress.tournament,
  };
}

export function normalizeProfileCloudProgress(
  raw: unknown
): ProfileCloudProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<ProfileCloudProgress>;
  const seasonSaveSlots = normalizeSeasonSaveSlots(o.seasonSaveSlots);
  const activeSeasonSlot: SeasonSaveSlotIndex | null =
    typeof o.activeSeasonSlot === "number" && o.activeSeasonSlot >= 0 && o.activeSeasonSlot <= 2
      ? (o.activeSeasonSlot as SeasonSaveSlotIndex)
      : null;
  return {
    seasonSaveSlots,
    activeSeasonSlot,
    season: (o.season as SeasonState | null) ?? null,
    seasonHonours: Array.isArray(o.seasonHonours) ? o.seasonHonours : [],
    playerForm:
      o.playerForm && typeof o.playerForm === "object"
        ? (o.playerForm as AccountProgress["playerForm"])
        : {},
    tournament: (o.tournament as TournamentState | null) ?? null,
  };
}

export function mergeProfileCloudProgress(
  local: AccountProgress,
  remote: ProfileCloudProgress | null
): AccountProgress {
  if (!remote) return local;

  const seasonSaveSlots = mergeSeasonSaveSlots(local.seasonSaveSlots, remote.seasonSaveSlots);
  const activeSeasonSlot = remote.activeSeasonSlot ?? local.activeSeasonSlot;
  const season = resolveActiveSeason(
    remote.season ?? local.season,
    activeSeasonSlot,
    seasonSaveSlots
  );

  return {
    ...local,
    seasonSaveSlots,
    activeSeasonSlot,
    season,
    seasonHonours: mergeSeasonHonours(local.seasonHonours, remote.seasonHonours),
    playerForm: { ...local.playerForm, ...remote.playerForm },
    tournament: remote.tournament ?? local.tournament,
  };
}

export function mergeAccountProgress(
  primary: AccountProgress,
  secondary: AccountProgress
): AccountProgress {
  const seasonSaveSlots = mergeSeasonSaveSlots(
    primary.seasonSaveSlots,
    secondary.seasonSaveSlots
  );
  const activeSeasonSlot = primary.activeSeasonSlot ?? secondary.activeSeasonSlot;
  return {
    careerStats: mergeCareerStats(primary.careerStats, secondary.careerStats),
    revealedStats: mergeRevealedStats(primary.revealedStats, secondary.revealedStats),
    playerForm: { ...secondary.playerForm, ...primary.playerForm },
    seasonHonours: mergeSeasonHonours(primary.seasonHonours, secondary.seasonHonours),
    season: resolveActiveSeason(
      primary.season ?? secondary.season,
      activeSeasonSlot,
      seasonSaveSlots
    ),
    seasonSaveSlots,
    activeSeasonSlot,
    tournament: primary.tournament ?? secondary.tournament,
  };
}

export function reconcileAccountProgressWithProfile(
  local: AccountProgress,
  profile: Pick<
    MultiplayerProfile,
    "career_stats" | "revealed_stats" | "account_progress"
  > | null
): AccountProgress {
  if (!profile) return local;

  const remoteCareer = normalizeCareerStats(profile.career_stats);
  const remoteRevealed = normalizeRevealedStats(profile.revealed_stats);
  const remoteCloud = normalizeProfileCloudProgress(profile.account_progress);

  const merged = mergeProfileCloudProgress(local, remoteCloud);

  return {
    ...merged,
    careerStats: reconcileCareerStats(local.careerStats, remoteCareer),
    revealedStats: mergeRevealedStats(local.revealedStats, remoteRevealed),
  };
}

export function loadLocalAccountProgress(userId: string | null): AccountProgress {
  if (typeof window === "undefined") return emptyAccountProgress();
  const key = userId ? userStorageKey(userId) : GUEST_STORAGE_KEY;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return emptyAccountProgress();
    return normalizeAccountProgress(JSON.parse(raw));
  } catch {
    return emptyAccountProgress();
  }
}

export function saveLocalAccountProgress(
  userId: string | null,
  progress: AccountProgress
): void {
  if (typeof window === "undefined") return;
  const key = userId ? userStorageKey(userId) : GUEST_STORAGE_KEY;
  localStorage.setItem(key, JSON.stringify(progress));
}

/** One-time migration from the old shared `fantasy-build-store` blob. */
export function migrateLegacySharedStoreProgress(): AccountProgress | null {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem(LEGACY_MIGRATED_KEY)) return null;

  try {
    const raw = localStorage.getItem("fantasy-build-store");
    if (!raw) {
      localStorage.setItem(LEGACY_MIGRATED_KEY, "1");
      return null;
    }
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    const state = parsed.state;
    if (!state) {
      localStorage.setItem(LEGACY_MIGRATED_KEY, "1");
      return null;
    }

    const legacy = normalizeAccountProgress({
      careerStats: state.careerStats,
      revealedStats: state.revealedStats,
      playerForm: state.playerForm,
      seasonHonours: state.seasonHonours,
      season: state.season,
      tournament: state.tournament,
    });

    if (!hasAccountProgressActivity(legacy)) {
      localStorage.setItem(LEGACY_MIGRATED_KEY, "1");
      return null;
    }

    localStorage.setItem(LEGACY_MIGRATED_KEY, "1");
    return legacy;
  } catch {
    localStorage.setItem(LEGACY_MIGRATED_KEY, "1");
    return null;
  }
}

export function accountProgressFromStoreState(state: {
  careerStats: PlayerCareerStats;
  revealedStats: Record<string, StatKey[]>;
  playerForm: Record<string, Record<string, number>>;
  seasonHonours: SeasonHonour[];
  season: SeasonState | null;
  seasonSaveSlots: SeasonSaveSlots;
  activeSeasonSlot: SeasonSaveSlotIndex | null;
  tournament: TournamentState | null;
}): AccountProgress {
  return {
    careerStats: state.careerStats,
    revealedStats: state.revealedStats,
    playerForm: state.playerForm,
    seasonHonours: state.seasonHonours,
    season: state.season,
    seasonSaveSlots: state.seasonSaveSlots,
    activeSeasonSlot: state.activeSeasonSlot,
    tournament: state.tournament,
  };
}

export function applyAccountProgressToStorePatch(progress: AccountProgress): {
  careerStats: PlayerCareerStats;
  revealedStats: Record<string, StatKey[]>;
  playerForm: Record<string, Record<string, number>>;
  seasonHonours: SeasonHonour[];
  season: SeasonState | null;
  seasonSaveSlots: SeasonSaveSlots;
  activeSeasonSlot: SeasonSaveSlotIndex | null;
  tournament: TournamentState | null;
  tournamentActiveFixtureId: null;
} {
  return {
    careerStats: progress.careerStats,
    revealedStats: progress.revealedStats,
    playerForm: progress.playerForm,
    seasonHonours: progress.seasonHonours,
    season: progress.season,
    seasonSaveSlots: progress.seasonSaveSlots,
    activeSeasonSlot: progress.activeSeasonSlot,
    tournament: progress.tournament,
    tournamentActiveFixtureId: null,
  };
}
