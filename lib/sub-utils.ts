import type { LineupSlot, PlayerMatchStats } from "./types";
import { isPlayerSentOff } from "./player-match-stats";

export interface LineupChangeAnalysis {
  subs: number;
  /** Players who swapped pitch positions (not from bench). */
  positionSwappedPlayers: string[];
}

export function analyzeLineupChanges(
  oldLineup: LineupSlot[],
  newLineup: LineupSlot[],
  bench: string[]
): LineupChangeAnalysis {
  const benchSet = new Set(bench);
  const oldBySlot = new Map(oldLineup.map((s) => [s.slotId, s.playerName]));
  const positionSwappedPlayers = new Set<string>();
  let subs = 0;

  for (const slot of newLineup) {
    const oldName = oldBySlot.get(slot.slotId);
    const newName = slot.playerName;
    if (!newName || oldName === newName) continue;

    if (benchSet.has(newName)) {
      subs++;
      continue;
    }

    if (oldName) {
      positionSwappedPlayers.add(oldName);
      positionSwappedPlayers.add(newName);
    }
  }

  return { subs, positionSwappedPlayers: [...positionSwappedPlayers] };
}

export function countSubs(oldLineup: LineupSlot[], newLineup: LineupSlot[], bench: string[]): number {
  return analyzeLineupChanges(oldLineup, newLineup, bench).subs;
}

export function sentOffPlayerNames(
  playerStats: Record<string, PlayerMatchStats> | undefined
): Set<string> {
  if (!playerStats) return new Set();
  return new Set(
    Object.keys(playerStats).filter((name) => isPlayerSentOff(playerStats, name))
  );
}

/** Sent-off players stay in their lineup slot — they cannot be subbed off. */
export function pinSentOffPlayersInLineup(
  previous: LineupSlot[],
  proposed: LineupSlot[],
  sentOff: Set<string>
): LineupSlot[] {
  if (!sentOff.size) return proposed;
  return proposed.map((slot) => {
    const prev = previous.find((s) => s.slotId === slot.slotId);
    const prevName = prev?.playerName;
    if (prevName && sentOff.has(prevName)) {
      return { ...slot, playerName: prevName };
    }
    return slot;
  });
}

export function subAnnouncementLines(
  oldLineup: LineupSlot[],
  newLineup: LineupSlot[],
  teamLabel: string
): string[] {
  const lines: string[] = [];
  newLineup.forEach((slot, i) => {
    const off = oldLineup[i]?.playerName;
    const on = slot.playerName;
    if (off && on && off !== on) {
      lines.push(`SUB — ${teamLabel}: ${off} off, ${on} on.`);
    }
  });
  return lines;
}

export function positionSwapAnnouncementLines(
  oldLineup: LineupSlot[],
  newLineup: LineupSlot[],
  bench: string[],
  teamLabel: string
): string[] {
  const { positionSwappedPlayers } = analyzeLineupChanges(oldLineup, newLineup, bench);
  if (!positionSwappedPlayers.length) return [];
  const names = positionSwappedPlayers.join(" & ");
  return [`${teamLabel} reshuffle — ${names} switch positions (−5 fitness each).`];
}
