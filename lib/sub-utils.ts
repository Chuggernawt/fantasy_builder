import type { LineupSlot } from "./types";

export function countSubs(oldLineup: LineupSlot[], newLineup: LineupSlot[]): number {
  return newLineup.filter((s, i) => s.playerName !== oldLineup[i]?.playerName).length;
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
