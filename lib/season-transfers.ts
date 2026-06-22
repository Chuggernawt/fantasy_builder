import { getPlayer } from "./squads";
import type { SeasonRosterEntry, SeasonState, SeasonTransferRecord } from "./season-types";
import {
  getSeasonTeamRoster,
  rosterEntryKey,
  rosterEntriesToPlayers,
  SEASON_ROSTER_SIZE,
} from "./season-rosters";

export const TRANSFER_WINDOW_INTERVAL = 4;
export const MAX_SWAPS_PER_WINDOW = 2;
const VALUE_FAIRNESS = 0.92;

function statKey(universeId: string, playerName: string): string {
  return `${universeId}::${playerName}`;
}

function isSuspended(season: SeasonState, universeId: string, playerName: string): boolean {
  return (season.suspensions?.[`${universeId}:${playerName}`] ?? 0) > 0;
}

export interface SwapEvaluation {
  accepted: boolean;
  reason: string;
  outValue: number;
  inValue: number;
}

export function userHasPlayedCurrentMatchday(season: SeasonState): boolean {
  return season.fixtures.some(
    (f) => f.matchday === season.currentMatchday && f.isPlayerMatch && f.played
  );
}

/** Window opens after MD 4, 8, 12… until the user plays their next fixture. */
export function isTransferWindowOpen(season: SeasonState): boolean {
  if (season.status !== "active") return false;
  const completed = season.currentMatchday - 1;
  if (completed < TRANSFER_WINDOW_INTERVAL || completed % TRANSFER_WINDOW_INTERVAL !== 0) {
    return false;
  }
  return !userHasPlayedCurrentMatchday(season);
}

export function transfersRemainingThisWindow(season: SeasonState): number {
  return Math.max(0, MAX_SWAPS_PER_WINDOW - (season.transfersThisWindow ?? 0));
}

export function transferWindowLabel(season: SeasonState): string {
  const completed = season.currentMatchday - 1;
  return `Transfer window · after matchday ${completed}`;
}

/** Matchday when the next transfer window opens (5, 9, 13, …). */
export function getNextTransferWindowMatchday(currentMatchday: number): number {
  if (currentMatchday <= TRANSFER_WINDOW_INTERVAL) {
    return TRANSFER_WINDOW_INTERVAL + 1;
  }
  return Math.ceil(currentMatchday / TRANSFER_WINDOW_INTERVAL) * TRANSFER_WINDOW_INTERVAL + 1;
}

export interface TransferHubStatus {
  open: boolean;
  swapsRemaining: number;
  matchdaysUntilOpen: number;
  opensAfterMatchday: number;
  shortLabel: string;
  buttonLabel: string;
}

export function getTransferHubStatus(season: SeasonState): TransferHubStatus {
  if (season.status !== "active") {
    return {
      open: false,
      swapsRemaining: 0,
      matchdaysUntilOpen: 0,
      opensAfterMatchday: 0,
      shortLabel: "",
      buttonLabel: "Transfer hub",
    };
  }

  const open = isTransferWindowOpen(season);
  const swapsRemaining = transfersRemainingThisWindow(season);

  if (open) {
    return {
      open: true,
      swapsRemaining,
      matchdaysUntilOpen: 0,
      opensAfterMatchday: season.currentMatchday - 1,
      shortLabel: `Open now · ${swapsRemaining} swap${swapsRemaining === 1 ? "" : "s"} left`,
      buttonLabel: `Transfer hub (${swapsRemaining} left)`,
    };
  }

  const nextMd = getNextTransferWindowMatchday(season.currentMatchday);
  const until = Math.max(0, nextMd - season.currentMatchday);
  const opensAfter = nextMd - 1;
  const untilText = until === 1 ? "1 matchday" : `${until} matchdays`;

  return {
    open: false,
    swapsRemaining: 0,
    matchdaysUntilOpen: until,
    opensAfterMatchday: opensAfter,
    shortLabel: `Opens after matchday ${opensAfter} · ${untilText} away`,
    buttonLabel: `Transfer hub · ${untilText}`,
  };
}

function playerTransferValue(entry: SeasonRosterEntry, season: SeasonState): number {
  const p = getPlayer(entry.universeId, entry.playerName);
  if (!p) return 0;
  let value = p.ovr;
  const row = season.playerStats[statKey(entry.universeId, entry.playerName)];
  if (row) {
    value += row.goals * 2 + row.assists;
  }
  return value;
}

function topStarKeys(roster: SeasonRosterEntry[], count = 3): Set<string> {
  const ranked = rosterEntriesToPlayers(roster)
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, count);
  return new Set(ranked.map((p) => rosterEntryKey({ universeId: p.originUniverseId, playerName: p.name })));
}

export function evaluateSeasonSwap(
  season: SeasonState,
  partnerTeamId: string,
  outgoing: SeasonRosterEntry,
  incoming: SeasonRosterEntry
): SwapEvaluation {
  if (!isTransferWindowOpen(season)) {
    return { accepted: false, reason: "Transfer window is closed.", outValue: 0, inValue: 0 };
  }
  if (transfersRemainingThisWindow(season) <= 0) {
    return { accepted: false, reason: "No swaps left this window.", outValue: 0, inValue: 0 };
  }
  if (partnerTeamId === season.userUniverseId) {
    return { accepted: false, reason: "Pick a league opponent.", outValue: 0, inValue: 0 };
  }

  const userRoster = getSeasonTeamRoster(season, season.userUniverseId);
  const partnerRoster = getSeasonTeamRoster(season, partnerTeamId);

  const outKey = rosterEntryKey(outgoing);
  const inKey = rosterEntryKey(incoming);

  if (!userRoster.some((e) => rosterEntryKey(e) === outKey)) {
    return { accepted: false, reason: "That player is not on your squad.", outValue: 0, inValue: 0 };
  }
  if (!partnerRoster.some((e) => rosterEntryKey(e) === inKey)) {
    return { accepted: false, reason: "That player is not on their squad.", outValue: 0, inValue: 0 };
  }

  if (isSuspended(season, outgoing.universeId, outgoing.playerName)) {
    return { accepted: false, reason: "Suspended players cannot be transferred.", outValue: 0, inValue: 0 };
  }
  if (isSuspended(season, incoming.universeId, incoming.playerName)) {
    return { accepted: false, reason: "Cannot sign a suspended player.", outValue: 0, inValue: 0 };
  }

  const alreadyDealt = (season.transferHistory ?? []).some(
    (t) =>
      t.matchday === season.currentMatchday &&
      t.partnerTeamId === partnerTeamId
  );
  if (alreadyDealt) {
    return {
      accepted: false,
      reason: "You can only swap with each club once per window.",
      outValue: 0,
      inValue: 0,
    };
  }

  const partnerStars = topStarKeys(partnerRoster);
  const userStars = topStarKeys(userRoster);

  if (partnerStars.has(inKey) && !userStars.has(outKey)) {
    return {
      accepted: false,
      reason: "They want a star of yours in return for their best players.",
      outValue: 0,
      inValue: 0,
    };
  }

  const outValue = playerTransferValue(outgoing, season);
  const inValue = playerTransferValue(incoming, season);

  if (outValue < inValue * VALUE_FAIRNESS) {
    return {
      accepted: false,
      reason: `Offer too light (${Math.round(outValue)} vs ${Math.round(inValue)} needed).`,
      outValue,
      inValue,
    };
  }

  return {
    accepted: true,
    reason: "They accept the swap.",
    outValue,
    inValue,
  };
}

export function executeSeasonSwap(
  season: SeasonState,
  partnerTeamId: string,
  outgoing: SeasonRosterEntry,
  incoming: SeasonRosterEntry
): { season: SeasonState; error?: string } {
  const evaluation = evaluateSeasonSwap(season, partnerTeamId, outgoing, incoming);
  if (!evaluation.accepted) {
    return { season, error: evaluation.reason };
  }

  const ensured = season.rosters ? season : { ...season, rosters: {} };
  const userId = season.userUniverseId;
  const userRoster = [...getSeasonTeamRoster(ensured, userId)];
  const partnerRoster = [...getSeasonTeamRoster(ensured, partnerTeamId)];

  const outIdx = userRoster.findIndex((e) => rosterEntryKey(e) === rosterEntryKey(outgoing));
  const inIdx = partnerRoster.findIndex((e) => rosterEntryKey(e) === rosterEntryKey(incoming));
  if (outIdx < 0 || inIdx < 0) {
    return { season, error: "Players not found on squads." };
  }

  userRoster[outIdx] = incoming;
  partnerRoster[inIdx] = outgoing;

  if (userRoster.length !== SEASON_ROSTER_SIZE || partnerRoster.length !== SEASON_ROSTER_SIZE) {
    return { season, error: "Squad size error." };
  }

  const record: SeasonTransferRecord = {
    matchday: season.currentMatchday,
    partnerTeamId,
    out: outgoing,
    in: incoming,
    completedAt: new Date().toISOString(),
  };

  const next: SeasonState = {
    ...ensured,
    rosters: {
      ...(ensured.rosters ?? {}),
      [userId]: userRoster,
      [partnerTeamId]: partnerRoster,
    },
    transfersThisWindow: (ensured.transfersThisWindow ?? 0) + 1,
    transferWindowMatchday: ensured.transferWindowMatchday ?? season.currentMatchday,
    transferHistory: [...(ensured.transferHistory ?? []), record].slice(-10),
  };

  return { season: next };
}

export function openTransferWindowIfNeeded(season: SeasonState): SeasonState {
  const md = season.currentMatchday;
  if (md <= 1 || (md - 1) % TRANSFER_WINDOW_INTERVAL !== 0) return season;
  if (season.transferWindowMatchday === md) return season;
  return {
    ...season,
    transferWindowMatchday: md,
    transfersThisWindow: 0,
  };
}
