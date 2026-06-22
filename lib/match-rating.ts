import type { LineupSlot, PlayerMatchStats, Role } from "./types";

export const FORM_MIN = -5;
export const FORM_MAX = 5;

export interface ManOfTheMatch {
  playerName: string;
  team: "home" | "away";
  rating: number;
}

export interface MatchRatingContext {
  teamGoals?: number;
  oppGoals?: number;
  goalsConceded?: number;
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
  pts += passRate * Math.min(stats.passes, 12) * 0.06;
  pts += dribRate * Math.min(stats.dribbles, 6) * 0.09;
  pts += tackleRate * Math.min(stats.tackles, 8) * 0.08;
  pts += stats.shotsOnTarget * 0.22;
  pts += stats.goals * 0.4;
  pts += stats.assists * 0.28;
  pts += role === "GK" ? stats.saves * 0.18 : stats.saves * 0.35;
  pts += stats.clearances * 0.14;
  pts += stats.shotsBlocked * 0.2;
  pts -= stats.yellowCards * 0.35;
  pts -= stats.redCards * 1.5;
  if (role === "CB" || role === "FB") pts += stats.clearances * 0.06;

  return Math.max(-1.2, Math.min(2, pts));
}

/**
 * Match rating on a 1–10 scale calibrated to real football distributions.
 * Most players cluster around 6.0; 8+ is a stand-out; 9+ is rare.
 */
export function computePlayerMatchRating(
  stats: PlayerMatchStats,
  role: Role,
  ctx: MatchRatingContext = {}
): number {
  const teamGoals = ctx.teamGoals ?? 0;
  const oppGoals = ctx.oppGoals ?? ctx.goalsConceded ?? 0;
  const goalsConceded = ctx.goalsConceded ?? oppGoals;
  const margin = teamGoals - oppGoals;

  const passRate =
    stats.passes > 0 ? stats.passesCompleted / stats.passes : 0.5;
  const tackleRate =
    stats.tackles > 0 ? stats.tacklesCompleted / stats.tackles : 0;
  const dribRate =
    stats.dribbles > 0 ? stats.dribblesCompleted / stats.dribbles : 0;

  let score = role === "GK" ? 6.0 : 6.0;

  // Direct contributions — strongest signal
  score += stats.goals * 0.85;
  score += stats.assists * 0.5;
  score += stats.shotsOnTarget * 0.1;
  score -= Math.max(0, stats.shots - stats.shotsOnTarget) * 0.04;

  // Volume stats with diminishing returns (background sim inflates raw counts)
  score += Math.min(0.35, passRate * Math.sqrt(stats.passes) * 0.04);
  score += Math.min(0.3, tackleRate * Math.sqrt(stats.tacklesCompleted) * 0.08);
  score += Math.min(0.2, dribRate * Math.sqrt(stats.dribblesCompleted) * 0.09);
  score += Math.min(0.28, stats.clearances * 0.035);
  score += Math.min(0.15, stats.shotsBlocked * 0.05);

  if (role === "GK") {
    score += Math.min(0.9, stats.saves * 0.065);
    score -= goalsConceded * 0.38;
    if (goalsConceded === 0 && teamGoals > 0) score += 0.2;
  } else {
    score += Math.min(0.12, stats.saves * 0.08);
  }

  score -= stats.yellowCards * 0.45;
  score -= stats.redCards * 1.8;

  if (role === "CB" || role === "FB" || role === "DM") {
    if (goalsConceded === 0) score += 0.15;
    score += stats.goals * 0.25;
  }

  // Team result — heavy defeats drag ratings down unless you scored
  if (margin <= -1) {
    const drag = Math.min(1.1, 0.2 * Math.abs(margin));
    if (stats.goals > 0) score -= drag * 0.3;
    else if (role === "GK") score -= drag * 0.55;
    else score -= drag;
  } else if (margin >= 2 && stats.goals === 0 && stats.assists === 0) {
    score += Math.min(0.3, 0.07 * margin);
  }

  // Cap: 10 is exceptional (hat-trick+), 9.5 great, most winners 6.5–8
  let cap = 9.0;
  if (stats.goals >= 3) cap = 9.8;
  else if (stats.goals >= 2) cap = 9.2;
  else if (stats.goals >= 1 && stats.assists >= 1) cap = 9.0;

  score = Math.max(4.0, Math.min(cap, score));
  return Math.round(score * 10) / 10;
}

/** Live rating from current match stats (before final whistle). */
export function livePlayerMatchRating(
  stats: PlayerMatchStats | undefined,
  role: Role,
  ctx: MatchRatingContext = {}
): number | null {
  if (!stats) return null;
  return (
    stats.matchRating ??
    computePlayerMatchRating(stats, role, {
      ...ctx,
      goalsConceded: role === "GK" ? ctx.goalsConceded ?? ctx.oppGoals : undefined,
    })
  );
}

export function liveRatingsForLineup(
  lineup: LineupSlot[],
  playerStats: Record<string, PlayerMatchStats>,
  ctx: MatchRatingContext = {}
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const slot of lineup) {
    if (!slot.playerName) continue;
    const rating = livePlayerMatchRating(playerStats[slot.playerName], slot.role, {
      ...ctx,
      goalsConceded: slot.role === "GK" ? ctx.goalsConceded ?? ctx.oppGoals : undefined,
    });
    if (rating != null) out[slot.playerName] = rating;
  }
  return out;
}

export function ratingDisplayClass(rating: number): string {
  if (rating >= 7.5) return "text-green-400";
  if (rating >= 6.8) return "text-broadcast-highlight";
  if (rating <= 5.0) return "text-red-400";
  if (rating <= 5.8) return "text-orange-400";
  return "text-slate-300";
}

export function hasMatchActivity(stats?: PlayerMatchStats): boolean {
  if (!stats) return false;
  return (
    stats.goals > 0 ||
    stats.assists > 0 ||
    stats.passes > 0 ||
    stats.shots > 0 ||
    stats.tackles > 0 ||
    stats.dribbles > 0 ||
    stats.saves > 0 ||
    stats.clearances > 0 ||
    stats.yellowCards > 0 ||
    stats.redCards > 0
  );
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
  candidates.sort((a, b) => {
    const aGk = roles[a.playerName] === "GK" ? 0.35 : 0;
    const bGk = roles[b.playerName] === "GK" ? 0.35 : 0;
    return b.rating - bGk - (a.rating - aGk);
  });
  return candidates[0];
}

export function finalizePlayerRatings(
  statsMap: Record<string, PlayerMatchStats>,
  roles: Record<string, Role>,
  teamGoals: number,
  oppGoals: number
): Record<string, PlayerMatchStats> {
  const next: Record<string, PlayerMatchStats> = {};
  for (const [name, stats] of Object.entries(statsMap)) {
    const role = roles[name] ?? "CM";
    next[name] = {
      ...stats,
      matchRating: computePlayerMatchRating(stats, role, {
        teamGoals,
        oppGoals,
        goalsConceded: role === "GK" ? oppGoals : undefined,
      }),
    };
  }
  return next;
}
