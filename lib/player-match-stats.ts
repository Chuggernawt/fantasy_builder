import type { PlayerMatchStats } from "./types";

export function emptyPlayerStats(): PlayerMatchStats {
  return {
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    passes: 0,
    passesCompleted: 0,
    shots: 0,
    shotsOnTarget: 0,
    dribbles: 0,
    dribblesCompleted: 0,
    tackles: 0,
    tacklesCompleted: 0,
    clearances: 0,
    shotsBlocked: 0,
    saves: 0,
  };
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

export function isPlayerSentOff(
  map: Record<string, PlayerMatchStats>,
  playerName: string
): boolean {
  return (map[playerName]?.redCards ?? 0) > 0;
}

export function recordPass(
  map: Record<string, PlayerMatchStats>,
  player: string,
  completed: boolean
): void {
  const row = ensurePlayerStats(map, player);
  row.passes++;
  if (completed) row.passesCompleted++;
}

export function recordDribble(
  map: Record<string, PlayerMatchStats>,
  player: string,
  completed: boolean
): void {
  const row = ensurePlayerStats(map, player);
  row.dribbles++;
  if (completed) row.dribblesCompleted++;
}

export function recordTackle(
  map: Record<string, PlayerMatchStats>,
  player: string,
  won: boolean
): void {
  const row = ensurePlayerStats(map, player);
  row.tackles++;
  if (won) row.tacklesCompleted++;
}

export function recordClearance(
  map: Record<string, PlayerMatchStats>,
  player: string
): void {
  ensurePlayerStats(map, player).clearances++;
}

export function recordShotBlocked(
  map: Record<string, PlayerMatchStats>,
  player: string
): void {
  ensurePlayerStats(map, player).shotsBlocked++;
}

export function recordShot(
  map: Record<string, PlayerMatchStats>,
  player: string,
  onTarget: boolean
): void {
  const row = ensurePlayerStats(map, player);
  row.shots++;
  if (onTarget) row.shotsOnTarget++;
}

export function recordSave(
  map: Record<string, PlayerMatchStats>,
  keeper: string
): void {
  ensurePlayerStats(map, keeper).saves++;
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
    .filter(([, s]) => hasVisibleStats(s))
    .map(([name, stats]) => ({ name, stats }))
    .sort((a, b) => {
      const ra = a.stats.matchRating ?? ratingSortScore(a.stats);
      const rb = b.stats.matchRating ?? ratingSortScore(b.stats);
      return rb - ra;
    });
}

function hasVisibleStats(s: PlayerMatchStats): boolean {
  return (
    s.matchRating != null ||
    s.goals > 0 ||
    s.assists > 0 ||
    s.yellowCards > 0 ||
    s.redCards > 0 ||
    s.passes > 0 ||
    s.shots > 0 ||
    s.tackles > 0 ||
    s.clearances > 0 ||
    s.saves > 0
  );
}

function ratingSortScore(s: PlayerMatchStats): number {
  return (
    s.goals * 10 +
    s.assists * 5 +
    s.shotsOnTarget * 2 +
    s.tacklesCompleted +
    s.saves * 2 -
    s.yellowCards
  );
}

export function seedLineupPlayerStats(
  map: Record<string, PlayerMatchStats>,
  names: string[]
): Record<string, PlayerMatchStats> {
  const next = { ...map };
  for (const name of names) {
    if (name && name !== "Unknown") ensurePlayerStats(next, name);
  }
  return next;
}
