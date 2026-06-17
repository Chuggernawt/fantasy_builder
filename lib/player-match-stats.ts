import type { PlayerMatchStats } from "./types";

export function emptyPlayerStats(): PlayerMatchStats {
  return { goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
}

export function ensurePlayerStats(
  map: Record<string, PlayerMatchStats>,
  name: string
): PlayerMatchStats {
  if (!map[name]) map[name] = emptyPlayerStats();
  return map[name];
}

export function recordGoal(
  map: Record<string, PlayerMatchStats>,
  scorer: string
): void {
  ensurePlayerStats(map, scorer).goals++;
}

export function recordAssist(
  map: Record<string, PlayerMatchStats>,
  assister: string
): void {
  ensurePlayerStats(map, assister).assists++;
}

export function recordYellow(
  map: Record<string, PlayerMatchStats>,
  player: string
): void {
  ensurePlayerStats(map, player).yellowCards++;
}

export function recordRed(
  map: Record<string, PlayerMatchStats>,
  player: string
): void {
  ensurePlayerStats(map, player).redCards++;
}

/** Pick assist: last phase mention (not scorer), else playmaker/crosser/taker. */
export function resolveAssist(
  scorer: string,
  phaseMentions: string[],
  playmaker?: string | null,
  crosser?: string | null,
  taker?: string | null
): string | null {
  const fromMentions = [...phaseMentions].reverse().find((n) => n !== scorer && n !== "Unknown");
  if (fromMentions) return fromMentions;

  const candidates = [playmaker, crosser, taker].filter(
    (n): n is string => !!n && n !== scorer && n !== "Unknown"
  );
  return candidates[0] ?? null;
}

export function playersWithMatchContributions(
  map: Record<string, PlayerMatchStats>
): { name: string; stats: PlayerMatchStats }[] {
  return Object.entries(map)
    .filter(([, s]) => s.goals > 0 || s.assists > 0 || s.yellowCards > 0 || s.redCards > 0)
    .map(([name, stats]) => ({ name, stats }))
    .sort((a, b) => {
      const ga = a.stats.goals * 10 + a.stats.assists * 5 - a.stats.yellowCards;
      const gb = b.stats.goals * 10 + b.stats.assists * 5 - b.stats.yellowCards;
      return gb - ga;
    });
}
