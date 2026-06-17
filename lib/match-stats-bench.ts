import type { LineupSlot } from "./types";
import { getUniverse } from "./squads";

/** Players available to come on — named bench minus anyone already on the pitch. */
export function getBenchPlayerNames(
  universeId: string,
  lineup: LineupSlot[],
  selectedBench?: string[]
): string[] {
  const onPitch = new Set(lineup.map((l) => l.playerName).filter(Boolean));

  if (selectedBench?.length) {
    return selectedBench.filter((name) => !onPitch.has(name));
  }

  const universe = getUniverse(universeId);
  if (!universe) return [];
  return universe.players.filter((p) => !onPitch.has(p.name)).map((p) => p.name);
}
