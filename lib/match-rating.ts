import type { PlayerMatchStats, Role } from "./types";

export const FORM_MIN = -5;
export const FORM_MAX = 5;

export interface ManOfTheMatch {
  playerName: string;
  team: "home" | "away";
  rating: number;
}

/** Small buff/nerf from carried form (-5..+5) applied to effective ratings. */
export function formRatingBonus(form: number): number {
  const clamped = Math.max(FORM_MIN, Math.min(FORM_MAX, form));
  return clamped * 0.35;
}

/** Update form after a match from final rating (1–10 scale). */
export function formDeltaFromRating(rating: number): number {
  if (rating >= 8.5) return 1.2;
  if (rating >= 7.5) return 0.7;
  if (rating >= 6.8) return 0.3;
  if (rating <= 4.5) return -1.2;
  if (rating <= 5.5) return -0.7;
  if (rating <= 6.2) return -0.3;
  return 0;
}

export function applyFormDelta(current: number, delta: number): number {
  return Math.max(FORM_MIN, Math.min(FORM_MAX, current + delta));
}

/** In-match performance boost from accumulated actions (replaces stamina as main dynamic). */
export function inMatchPerformanceBoost(
  stats: PlayerMatchStats | undefined,
  role: Role
): number {
  if (!stats) return 0;
  const passRate =
    stats.passes > 0 ? stats.passesCompleted / stats.passes : 0;
  const dribRate =
    stats.dribbles > 0 ? stats.dribblesCompleted / stats.dribbles : 0;
  const tackleRate =
    stats.tackles > 0 ? stats.tacklesCompleted / stats.tackles : 0;

  let pts = 0;
  pts += passRate * Math.min(stats.passes, 12) * 0.08;
  pts += dribRate * Math.min(stats.dribbles, 6) * 0.12;
  pts += tackleRate * Math.min(stats.tackles, 8) * 0.1;
  pts += stats.shotsOnTarget * 0.35;
  pts += stats.goals * 1.1;
  pts += stats.assists * 0.65;
  pts += stats.saves * 0.45;
  pts += stats.clearances * 0.18;
  pts += stats.shotsBlocked * 0.25;
  pts -= stats.yellowCards * 0.35;
  pts -= stats.redCards * 1.5;

  if (role === "GK") pts += stats.saves * 0.2;
  if (role === "CB" || role === "FB") pts += stats.clearances * 0.08;

  return Math.max(-1.5, Math.min(3.5, pts));
}

export function computePlayerMatchRating(stats: PlayerMatchStats, role: Role): number {
  const passRate =
    stats.passes > 0 ? stats.passesCompleted / stats.passes : 0.5;
  const dribRate =
    stats.dribbles > 0 ? stats.dribblesCompleted / stats.dribbles : 0;
  const tackleRate =
    stats.tackles > 0 ? stats.tacklesCompleted / stats.tackles : 0;

  let score = 6;

  score += stats.goals * 1.35;
  score += stats.assists * 0.85;
  score += stats.shotsOnTarget * 0.22;
  score -= Math.max(0, stats.shots - stats.shotsOnTarget) * 0.06;
  score += passRate * Math.min(stats.passes, 40) * 0.035;
  score += dribRate * Math.min(stats.dribbles, 12) * 0.08;
  score += tackleRate * Math.min(stats.tackles, 14) * 0.07;
  score += stats.clearances * 0.12;
  score += stats.shotsBlocked * 0.18;
  score += stats.saves * 0.28;
  score -= stats.yellowCards * 0.55;
  score -= stats.redCards * 2;

  if (role === "GK") {
    score += stats.saves * 0.15;
    score -= stats.goals * 0.5;
  }
  if (role === "CB" || role === "FB") {
    score += stats.clearances * 0.06;
    score += stats.goals * 0.4;
  }
  if (role === "ST" || role === "W") {
    score += stats.shotsOnTarget * 0.08;
  }

  return Math.round(Math.max(3, Math.min(10, score)) * 10) / 10;
}

export function pickManOfTheMatch(
  homeStats: Record<string, PlayerMatchStats>,
  awayStats: Record<string, PlayerMatchStats>,
  roles: Record<string, Role>
): ManOfTheMatch | null {
  const candidates: ManOfTheMatch[] = [];

  for (const [name, stats] of Object.entries(homeStats)) {
    const rating = stats.matchRating ?? computePlayerMatchRating(stats, roles[name] ?? "CM");
    candidates.push({ playerName: name, team: "home", rating });
  }
  for (const [name, stats] of Object.entries(awayStats)) {
    const rating = stats.matchRating ?? computePlayerMatchRating(stats, roles[name] ?? "CM");
    candidates.push({ playerName: name, team: "away", rating });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.rating - a.rating);
  return candidates[0];
}

export function finalizePlayerRatings(
  statsMap: Record<string, PlayerMatchStats>,
  roles: Record<string, Role>
): Record<string, PlayerMatchStats> {
  const next: Record<string, PlayerMatchStats> = {};
  for (const [name, stats] of Object.entries(statsMap)) {
    next[name] = {
      ...stats,
      matchRating: computePlayerMatchRating(stats, roles[name] ?? "CM"),
    };
  }
  return next;
}
