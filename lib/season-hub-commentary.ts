import { getUniverse } from "./squads";
import {
  getPlayerFixture,
  getUserTablePosition,
  getUserTeamRow,
  sortTable,
} from "./season";
import { SEASON_RELEGATION_ZONE } from "./season-saves";
import type { SeasonFixture, SeasonState } from "./season-types";

export interface SeasonHubCommentaryLine {
  id: string;
  tone: "neutral" | "positive" | "negative" | "highlight";
  text: string;
}

function teamName(id: string): string {
  return getUniverse(id)?.name ?? id;
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function userPlayedFixtures(season: SeasonState): SeasonFixture[] {
  return season.fixtures
    .filter((f) => f.isPlayerMatch && f.played)
    .sort((a, b) => b.matchday - a.matchday);
}

function userRemainingFixtures(season: SeasonState): number {
  return season.fixtures.filter((f) => f.isPlayerMatch && !f.played).length;
}

function describeUserResult(season: SeasonState, f: SeasonFixture): string {
  const userId = season.userUniverseId;
  const isHome = f.homeUniverseId === userId;
  const oppId = isHome ? f.awayUniverseId : f.homeUniverseId;
  const userScore = isHome ? (f.homeScore ?? 0) : (f.awayScore ?? 0);
  const oppScore = isHome ? (f.awayScore ?? 0) : (f.homeScore ?? 0);
  const venue = isHome ? "at home" : "away";
  const outcome =
    userScore > oppScore ? "won" : userScore < oppScore ? "lost" : "drew";
  return `${outcome} ${userScore}–${oppScore} ${venue} to ${teamName(oppId)} on matchday ${f.matchday}`;
}

function formSummary(season: SeasonState): string | null {
  const played = userPlayedFixtures(season).slice(0, 5);
  if (!played.length) return null;
  const userId = season.userUniverseId;
  const letters = played.map((f) => {
    const isHome = f.homeUniverseId === userId;
    const us = isHome ? (f.homeScore ?? 0) : (f.awayScore ?? 0);
    const them = isHome ? (f.awayScore ?? 0) : (f.homeScore ?? 0);
    if (us > them) return "W";
    if (us < them) return "L";
    return "D";
  });
  return letters.join("-");
}

/** Broadcast-style lines for the season hub sidebar — table, fixtures, points, title & survival. */
export function buildSeasonHubCommentary(season: SeasonState): SeasonHubCommentaryLine[] {
  const lines: SeasonHubCommentaryLine[] = [];
  const userId = season.userUniverseId;
  const userName = teamName(userId);
  const userRow = getUserTeamRow(season);
  const position = getUserTablePosition(season);
  const sorted = sortTable(season.table);
  const leagueSize = sorted.length;
  const relegateFrom = Math.max(0, leagueSize - SEASON_RELEGATION_ZONE);
  const leader = sorted[0];
  const leaderName = leader ? teamName(leader.universeId) : "the leaders";
  const points = userRow?.points ?? 0;
  const played = userRow?.played ?? 0;
  const remaining = userRemainingFixtures(season);
  const maxPoints = points + remaining * 3;
  const completedMd =
    season.status === "finished"
      ? season.length
      : Math.max(0, season.currentMatchday - 1);

  const push = (id: string, text: string, tone: SeasonHubCommentaryLine["tone"] = "neutral") => {
    lines.push({ id, text, tone });
  };

  if (season.status === "finished") {
    const champion = season.championId ? teamName(season.championId) : leaderName;
    if (season.championId === userId) {
      push("champion", `${userName} are champions of season ${season.seasonNumber}!`, "highlight");
    } else if (position > relegateFrom) {
      push("relegated", `${userName} finish ${ordinal(position)} — relegation confirmed.`, "negative");
    } else {
      push(
        "finished",
        `Season ${season.seasonNumber} complete: ${ordinal(position)} on ${points} points. ${champion} lift the trophy.`,
        position <= 3 ? "positive" : "neutral"
      );
    }
    return lines;
  }

  push(
    "matchday",
    `Matchday ${season.currentMatchday} of ${season.length} — ${completedMd} round${completedMd === 1 ? "" : "s"} in the books.`,
    "neutral"
  );

  if (played === 0) {
    push(
      "opener",
      `${userName} open their ${season.length}-game campaign. The table is wide open.`,
      "highlight"
    );
  } else {
    push(
      "standing",
      `${userName} sit ${ordinal(position)} in the table on ${points} point${points === 1 ? "" : "s"} from ${played} played.`,
      position === 1 ? "highlight" : "neutral"
    );
  }

  if (leader && leader.universeId !== userId) {
    const gap = leader.points - points;
    if (gap === 0) {
      push("level", `Level on points with leaders ${leaderName} — fine margins at the top.`, "positive");
    } else if (gap <= 3) {
      push(
        "title-close",
        `Just ${gap} point${gap === 1 ? "" : "s"} behind ${leaderName} — the summit is in sight.`,
        "positive"
      );
    } else if (gap <= 9 && remaining >= 4) {
      push(
        "title-alive",
        `${gap} points off ${leaderName} with ${remaining} matches left — the title race is not over.`,
        "positive"
      );
    } else if (position <= 4) {
      push(
        "pursuit",
        `${gap} points adrift of ${leaderName}. Consistency will be key to closing the gap.`,
        "neutral"
      );
    }
  } else if (leader?.universeId === userId) {
    const second = sorted[1];
    const cushion = second ? points - second.points : points;
    push(
      "top",
      cushion > 0
        ? `Top of the league — ${cushion} point${cushion === 1 ? "" : "s"} clear. The title is yours to lose.`
        : `Leaders on ${points} points. Hold your nerve at the summit.`,
      "highlight"
    );
  }

  if (remaining > 0) {
    push(
      "ceiling",
      `Up to ${maxPoints} points still attainable with ${remaining} fixture${remaining === 1 ? "" : "s"} left.`,
      "neutral"
    );
  }

  const inRelegationZone = position > relegateFrom;
  const teamAboveRelegation = sorted[relegateFrom - 1];
  const teamInZone = sorted[relegateFrom];

  if (inRelegationZone) {
    push(
      "relegation-danger",
      `In the relegation zone (${ordinal(position)} of ${leagueSize}). Every point is survival football now.`,
      "negative"
    );
  } else if (position === relegateFrom && teamInZone) {
    const cushion = points - teamInZone.points;
    push(
      "relegation-line",
      `One place above the dotted line — ${cushion} point${cushion === 1 ? "" : "s"} ahead of ${teamName(teamInZone.universeId)}.`,
      cushion <= 3 ? "negative" : "neutral"
    );
  } else if (teamAboveRelegation && position <= relegateFrom + 2) {
    const gap = points - teamAboveRelegation.points;
    if (gap <= 3) {
      push(
        "relegation-near",
        `Only ${Math.max(0, gap)} point${gap === 1 ? "" : "s"} above the relegation zone — no room for slip-ups.`,
        "negative"
      );
    }
  } else if (position <= 5 && !inRelegationZone) {
    push("safe", `Comfortably clear of the bottom three for now.`, "positive");
  }

  const form = formSummary(season);
  if (form) {
    const tone = form.startsWith("W") ? "positive" : form.startsWith("L") ? "negative" : "neutral";
    push("form", `Recent form (latest first): ${form}.`, tone);
  }

  const last = userPlayedFixtures(season)[0];
  if (last) {
    const resultText = describeUserResult(season, last);
    const isHome = last.homeUniverseId === userId;
    const us = isHome ? (last.homeScore ?? 0) : (last.awayScore ?? 0);
    const them = isHome ? (last.awayScore ?? 0) : (last.homeScore ?? 0);
    const tone = us > them ? "positive" : us < them ? "negative" : "neutral";
    push("last-result", `Last outing: ${userName} ${resultText}.`, tone);
  }

  const next = getPlayerFixture(season);
  if (next) {
    const oppId =
      next.homeUniverseId === userId ? next.awayUniverseId : next.homeUniverseId;
    const venue = next.homeUniverseId === userId ? "Home" : "Away";
    const oppIdx = sorted.findIndex((r) => r.universeId === oppId);
    const oppRow = oppIdx >= 0 ? sorted[oppIdx] : null;
    const oppPts = oppRow?.points ?? 0;
    let preview = `${venue} against ${teamName(oppId)} next`;
    if (oppIdx >= 0) {
      preview += ` — ${ordinal(oppIdx + 1)} on ${oppPts} pts`;
    }
    preview += ".";
    push("next-fixture", preview, "highlight");
  }

  const above = sorted[position - 2];
  const below = sorted[position];
  if (above && played > 0) {
    const gapUp = above.points - points;
    if (gapUp <= 3 && gapUp > 0) {
      push(
        "chase",
        `${gapUp} point${gapUp === 1 ? "" : "s"} behind ${teamName(above.universeId)} directly above.`,
        "neutral"
      );
    }
  }
  if (below && played > 0) {
    const gapDown = points - below.points;
    if (gapDown <= 3 && gapDown >= 0) {
      push(
        "pressure",
        `${teamName(below.universeId)} are ${gapDown === 0 ? "level" : `${gapDown} point${gapDown === 1 ? "" : "s"} back`} — keep them at arm's length.`,
        "neutral"
      );
    }
  }

  if (userRow && played > 0) {
    const gd = userRow.goalsFor - userRow.goalsAgainst;
    if (gd >= 5) {
      push("gd-plus", `Goal difference of +${gd} could prove decisive in a tight table.`, "positive");
    } else if (gd <= -5) {
      push("gd-minus", `Goal difference of ${gd} — goals may need to flow to climb the table.`, "negative");
    }
  }

  if (position <= 3 && leader && leader.universeId !== userId && remaining <= 5) {
    const needed = leader.points - points + 1;
    push(
      "title-push",
      `The run-in begins: need to outpace ${leaderName} by ${needed} point${needed === 1 ? "" : "s"} from here.`,
      "highlight"
    );
  }

  return lines;
}
