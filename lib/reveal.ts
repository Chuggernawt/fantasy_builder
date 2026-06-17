import type { StatKey } from "./types";

export interface RevealHighlight {
  universeId: string;
  playerName: string;
  mode: "full" | "single";
  stat?: StatKey;
}

export const ALL_STAT_KEYS: StatKey[] = [
  "pace",
  "power",
  "stamina",
  "tackling",
  "passing",
  "gk",
];

export function isStatRevealed(
  revealed: Record<string, StatKey[]>,
  playerName: string,
  stat: StatKey
): boolean {
  return (revealed[playerName] ?? []).includes(stat);
}

export function isPlayerFullyRevealed(
  revealed: Record<string, StatKey[]>,
  playerName: string
): boolean {
  const set = new Set(revealed[playerName] ?? []);
  return ALL_STAT_KEYS.every((k) => set.has(k));
}

export function revealAllForPlayer(
  revealed: Record<string, StatKey[]>,
  playerName: string
): Record<string, StatKey[]> {
  return { ...revealed, [playerName]: [...ALL_STAT_KEYS] };
}

export function revealOneRandomStat(
  revealed: Record<string, StatKey[]>,
  playerName: string
): { next: Record<string, StatKey[]>; stat: StatKey } {
  const current = new Set(revealed[playerName] ?? []);
  const remaining = ALL_STAT_KEYS.filter((k) => !current.has(k));
  const picked = remaining.length
    ? remaining[Math.floor(Math.random() * remaining.length)]
    : ALL_STAT_KEYS[Math.floor(Math.random() * ALL_STAT_KEYS.length)];
  current.add(picked);
  return { next: { ...revealed, [playerName]: [...current] }, stat: picked };
}
