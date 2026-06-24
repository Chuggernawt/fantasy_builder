import type { CommentaryEvent } from "./types";

export interface MatchGoalEvent {
  id: string;
  team: "home" | "away";
  scorer: string;
  minute: number;
  assist: string | null;
  isPenalty: boolean;
}

export interface MatchRedCardEvent {
  id: string;
  team: "home" | "away";
  playerName: string;
  minute: number;
}

export interface GroupedScorerGoals {
  scorer: string;
  goals: MatchGoalEvent[];
}

function parseGoalScorer(text: string): string {
  const patterns = [
    /GOAL!\s*(.+?)\s+finds the net/i,
    /GOAL!\s*(.+?)\s+buries it/i,
    /GOAL!\s*What a finish from\s+(.+?)!/i,
    /GOAL!\s*(.+?)\s+scores/i,
    /GOAL!\s*(.+?)\s+tucks it away/i,
    /GOAL!\s*Back of the net!\s*(.+?)\s+with the finish/i,
    /GOAL!\s*(.+?)\s+makes no mistake/i,
    /GOAL!\s*Sensational strike by\s+(.+?)!/i,
    /GOAL!\s*(.+?)\s+thumps it home/i,
    /GOAL!\s*Clinical from\s+(.+?)!/i,
    /GOAL!\s*(.+?)\s+— take a bow/i,
    /GOAL!\s*Top bins!\s*(.+?)\s+with a screamer/i,
    /GOAL!\s*(.+?)\s+slots it past the keeper/i,
    /GOAL!\s*.+?\.\.\.\s*(.+?)\s+scores/i,
    /—\s*(.+?)\s+finds the net/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "Unknown";
}

function isScoredPenaltyEvent(e: CommentaryEvent): boolean {
  return e.type === "penalty" && !!e.playerName;
}

export function extractMatchGoals(commentary: CommentaryEvent[]): MatchGoalEvent[] {
  const goals: MatchGoalEvent[] = [];
  for (const e of commentary) {
    const isPenalty = isScoredPenaltyEvent(e);
    if (e.type !== "goal" && !isPenalty) continue;
    if (e.team !== "home" && e.team !== "away") continue;
    goals.push({
      id: e.id,
      team: e.team,
      scorer: e.playerName ?? parseGoalScorer(e.text),
      minute: e.minute,
      assist: e.assistPlayerName ?? null,
      isPenalty,
    });
  }
  return goals;
}

export function extractRedCards(commentary: CommentaryEvent[]): MatchRedCardEvent[] {
  const cards: MatchRedCardEvent[] = [];
  for (const e of commentary) {
    if (e.type !== "redcard" || (e.team !== "home" && e.team !== "away")) continue;
    cards.push({
      id: e.id,
      team: e.team,
      playerName: e.playerName ?? "Unknown",
      minute: e.minute,
    });
  }
  return cards;
}

export function goalsForTeam(goals: MatchGoalEvent[], team: "home" | "away"): MatchGoalEvent[] {
  return goals.filter((g) => g.team === team);
}

export function redCardsForTeam(cards: MatchRedCardEvent[], team: "home" | "away"): MatchRedCardEvent[] {
  return cards.filter((c) => c.team === team);
}

/** One row per scorer — e.g. Salah 12', 45' (pen) */
export function groupGoalsByScorer(goals: MatchGoalEvent[]): GroupedScorerGoals[] {
  const order: string[] = [];
  const map = new Map<string, MatchGoalEvent[]>();
  for (const g of goals) {
    if (!map.has(g.scorer)) {
      order.push(g.scorer);
      map.set(g.scorer, []);
    }
    map.get(g.scorer)!.push(g);
  }
  return order.map((scorer) => ({
    scorer,
    goals: (map.get(scorer) ?? []).sort((a, b) => a.minute - b.minute),
  }));
}

export function formatGoalMinuteTags(goals: MatchGoalEvent[]): string {
  return goals
    .map((g) => `${g.minute}'${g.isPenalty ? " (pen)" : ""}`)
    .join(", ");
}

/** @deprecated use formatGoalMinuteTags */
export function formatGroupedGoalMinutes(minutes: number[]): string {
  return minutes.map((m) => `${m}'`).join(", ");
}

export function formatGoalListForReport(
  goals: { scorer: string; minute: number; isPenalty?: boolean }[]
): string {
  if (!goals.length) return "none";
  const grouped = groupGoalsByScorer(
    goals.map((g, i) => ({
      id: `report-${i}`,
      team: "home" as const,
      scorer: g.scorer,
      minute: g.minute,
      assist: null,
      isPenalty: g.isPenalty ?? false,
    }))
  );
  return grouped.map((g) => `${g.scorer} (${formatGoalMinuteTags(g.goals)})`).join(", ");
}
