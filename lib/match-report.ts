import type { CommentaryEvent, MatchState, MatchSummary } from "./types";

export interface MatchReport {
  headline: string;
  paragraphs: string[];
  highlights: string[];
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fill(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    template
  );
}

import { formatGoalListForReport } from "./match-goals";

function extractPlayerMentions(events: CommentaryEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.playerName) {
      counts.set(e.playerName, (counts.get(e.playerName) ?? 0) + 1);
    }
  }
  return counts;
}

function topMentioned(mentions: Map<string, number>, exclude: Set<string>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [name, count] of mentions) {
    if (exclude.has(name)) continue;
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

function countByType(events: CommentaryEvent[], type: CommentaryEvent["type"]): number {
  return events.filter((e) => e.type === type).length;
}

function halftimeScore(events: CommentaryEvent[]): { home: number; away: number } | null {
  const ht = events.find((e) => e.type === "halftime");
  if (!ht) return null;
  const m = ht.text.match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return null;
  return { home: parseInt(m[1], 10), away: parseInt(m[2], 10) };
}

export function buildMatchReport(state: MatchState, summary: MatchSummary): MatchReport {
  const { homeName, awayName, score } = summary;
  const totalGoals = score.home + score.away;
  const homeWin = score.home > score.away;
  const awayWin = score.away > score.home;
  const draw = score.home === score.away;

  const winner = homeWin ? homeName : awayWin ? awayName : null;
  const loser = homeWin ? awayName : awayWin ? homeName : null;
  const margin = Math.abs(score.home - score.away);

  const htScore = halftimeScore(state.commentary);
  const goals = state.commentary.filter((e) => e.type === "goal");
  const saves = state.commentary.filter((e) => e.type === "save");
  const fouls = countByType(state.commentary, "foul");
  const yellows = countByType(state.commentary, "yellowcard");
  const corners = countByType(state.commentary, "corner");

  const scorerNames = new Set([
    ...summary.homeGoals.map((g) => g.scorer),
    ...summary.awayGoals.map((g) => g.scorer),
  ]);

  const mentions = extractPlayerMentions(state.commentary);
  const standout = topMentioned(mentions, scorerNames);

  const possGap = Math.abs(summary.homePossessionPct - summary.awayPossessionPct);
  const possLeader =
    summary.homePossessionPct > summary.awayPossessionPct ? homeName : awayName;
  const possPct = Math.max(summary.homePossessionPct, summary.awayPossessionPct);

  let headline: string;
  if (draw) {
    headline = pick([
      `{home} and {away} share the spoils in a {h}-{a} draw`,
      `Honours even as {home} and {away} finish {h}-{a}`,
      `A point apiece — {home} {h}-{a} {away}`,
      `{h}-{a}: {home} and {away} can't be separated`,
    ]);
  } else if (margin >= 3) {
    headline = pick([
      `{winner} run riot in a {h}-{a} demolition of {loser}`,
      `Statement win for {winner} — {h}-{a} against {loser}`,
      `{loser} torn apart as {winner} cruise to a {h}-{a} victory`,
    ]);
  } else if (margin === 1) {
    headline = pick([
      `{winner} edge past {loser} in a tight {h}-{a} affair`,
      `Narrow victory for {winner} — {h}-{a} against {loser}`,
      `{loser} fall just short as {winner} win {h}-{a}`,
    ]);
  } else {
    headline = pick([
      `{winner} see off {loser} {h}-{a}`,
      `{winner} take the points with a {h}-{a} win over {loser}`,
      `Comfortable enough for {winner} in a {h}-{a} success against {loser}`,
    ]);
  }

  headline = fill(headline, {
    home: homeName,
    away: awayName,
    winner: winner ?? homeName,
    loser: loser ?? awayName,
    h: score.home,
    a: score.away,
  });

  const paragraphs: string[] = [];

  // Opening
  if (totalGoals === 0) {
    paragraphs.push(
      fill(
        pick([
          `A cagey encounter at the stadium saw {home} and {away} play out a goalless draw. Both defences held firm across 90 minutes.`,
          `Neither {home} nor {away} could find a breakthrough in a tight, tactical battle that ended {h}-{a}.`,
          `Goalkeepers ruled the day as {home} and {away} finished level with clean sheets intact.`,
        ]),
        { home: homeName, away: awayName, h: score.home, a: score.away }
      )
    );
  } else if (totalGoals <= 2) {
    paragraphs.push(
      fill(
        pick([
          `{home} hosted {away} in a low-scoring contest that ultimately finished {h}-{a}. Fine margins decided it.`,
          `Chances were at a premium as {home} and {away} produced a {h}-{a} scoreline.`,
          `A cautious start set the tone — {home} and {away} shared {goals} goal{s} in a {h}-{a} result.`,
        ]),
        {
          home: homeName,
          away: awayName,
          h: score.home,
          a: score.away,
          goals: totalGoals,
          s: totalGoals === 1 ? "" : "s",
        }
      )
    );
  } else {
    paragraphs.push(
      fill(
        pick([
          `{home} and {away} served up an entertaining {h}-{a} clash with plenty of action at both ends.`,
          `Goals flowed as {home} took on {away} in a {h}-{a} encounter that kept fans guessing.`,
          `An open game saw {home} and {away} combine for {goals} goals in a {h}-{a} finish.`,
        ]),
        { home: homeName, away: awayName, h: score.home, a: score.away, goals: totalGoals }
      )
    );
  }

  // First half
  if (htScore) {
    const htNarrative =
      htScore.home === htScore.away
        ? pick([
            `The first half ended level at {hh}-{ha} with neither side able to grab control.`,
            `Honours were even at the break — {hh}-{ha} after 45 minutes of sparring.`,
          ])
        : pick([
            `{leader} went in ahead at half time, leading {hh}-{ha}.`,
            `The break came with {leader} on top at {hh}-{ha}.`,
            `{trailer} had work to do at half time, trailing {hh}-{ha}.`,
          ]);
    const leader =
      htScore.home > htScore.away ? homeName : htScore.away > htScore.home ? awayName : null;
    const trailer = leader === homeName ? awayName : homeName;
    paragraphs.push(
      fill(htNarrative, {
        hh: htScore.home,
        ha: htScore.away,
        leader: leader ?? homeName,
        trailer,
      })
    );
  }

  // Goals narrative
  if (summary.homeGoals.length || summary.awayGoals.length) {
    if (summary.homeGoals.length && summary.awayGoals.length) {
      paragraphs.push(
        fill(
          pick([
            `{home} goals: {homeGoals}. {away} replied through {awayGoals}.`,
            `Scorers for {home}: {homeGoals}. {away} netted via {awayGoals}.`,
          ]),
          {
            home: homeName,
            away: awayName,
            homeGoals: formatGoalListForReport(summary.homeGoals),
            awayGoals: formatGoalListForReport(summary.awayGoals),
          }
        )
      );
    } else if (summary.homeGoals.length) {
      paragraphs.push(
        fill(
          pick([
            `{home} found the net through {homeGoals}. {away} couldn't muster a reply.`,
            `All the goals came from {home}: {homeGoals}.`,
          ]),
          { home: homeName, away: awayName, homeGoals: formatGoalListForReport(summary.homeGoals) }
        )
      );
    } else {
      paragraphs.push(
        fill(
          pick([
            `{away} were clinical with {awayGoals}. {home} drew a blank.`,
            `{away} goals: {awayGoals}. {home} left frustrated up front.`,
          ]),
          { home: homeName, away: awayName, awayGoals: formatGoalListForReport(summary.awayGoals) }
        )
      );
    }
  }

  // Possession / shots
  if (possGap >= 12) {
    paragraphs.push(
      fill(
        pick([
          `{leader} dominated possession ({pct}%) and finished with {shots} shots to their opponent's {oppShots}.`,
          `The ball spent most of the afternoon with {leader} ({pct}% possession), who outshot the opposition {shots} to {oppShots}.`,
        ]),
        {
          leader: possLeader,
          pct: possPct,
          shots: possLeader === homeName ? summary.homeShots : summary.awayShots,
          oppShots: possLeader === homeName ? summary.awayShots : summary.homeShots,
        }
      )
    );
  } else {
    paragraphs.push(
      fill(
        pick([
          `Possession was evenly matched ({homePct}% vs {awayPct}%). {home} had {homeShots} shots, {away} managed {awayShots}.`,
          `Neither side could claim control of the ball — {homePct}% to {awayPct}% — though chances fell {homeShots} to {awayShots} in shots.`,
        ]),
        {
          home: homeName,
          away: awayName,
          homePct: summary.homePossessionPct,
          awayPct: summary.awayPossessionPct,
          homeShots: summary.homeShots,
          awayShots: summary.awayShots,
        }
      )
    );
  }

  // Goalkeeping
  if (saves.length >= 3) {
    paragraphs.push(
      fill(
        pick([
          `Both keepers were busy — {homeSaves} saves for {home}, {awaySaves} for {away}.`,
          `Fine goalkeeping at both ends: {home} made {homeSaves} stops, {away} produced {awaySaves}.`,
        ]),
        {
          home: homeName,
          away: awayName,
          homeSaves: summary.homeSaves,
          awaySaves: summary.awaySaves,
        }
      )
    );
  }

  // Discipline
  if (fouls >= 4 || yellows >= 2) {
    paragraphs.push(
      fill(
        pick([
          `The referee had his work cut out — {fouls} fouls and {yellows} yellow card{yPlural} across the match.`,
          `A physical contest produced {fouls} fouls{yellowLine}.`,
        ]),
        {
          fouls,
          yellows,
          yPlural: yellows === 1 ? "" : "s",
          yellowLine: yellows > 0 ? ` and ${yellows} booking${yellows === 1 ? "" : "s"}` : "",
        }
      )
    );
  }

  // Standout player
  if (standout) {
    paragraphs.push(
      fill(
        pick([
          `{player} was heavily involved throughout, popping up repeatedly in key phases.`,
          `Watch the highlights for {player} — among the busiest players on the pitch.`,
          `{player} caught the eye with a busy display even beyond the score sheet.`,
        ]),
        { player: standout }
      )
    );
  }

  // Closing
  if (draw) {
    paragraphs.push(
      fill(
        pick([
          `Both managers may feel a draw was a fair reflection of a hard-fought {h}-{a}.`,
          `A point each — {home} and {away} will look to sharper finishing next time.`,
        ]),
        { home: homeName, away: awayName, h: score.home, a: score.away }
      )
    );
  } else {
    paragraphs.push(
      fill(
        pick([
          `{winner} climb away with three points; {loser} must regroup after a {h}-{a} defeat.`,
          `Full time: {winner} {h}-{a} {loser}. The better side won it on the day.`,
          `{loser} will rue missed chances, but credit to {winner} for a {h}-{a} victory.`,
        ]),
        {
          winner: winner!,
          loser: loser!,
          h: score.home,
          a: score.away,
        }
      )
    );
  }

  const highlights: string[] = [];
  for (const g of goals.slice(0, 5)) {
    const team = g.team === "home" ? homeName : awayName;
    const scorer = g.playerName ?? "Unknown";
    highlights.push(`${g.minute}' — GOAL! ${scorer} (${team})`);
  }
  for (const s of saves.slice(0, 3)) {
    highlights.push(`${s.minute}' — ${s.text}`);
  }
  if (corners >= 4) {
    highlights.push(`${corners} corners awarded across the match`);
  }
  const keyEvents = state.commentary.filter((e) =>
    ["foul", "yellowcard", "offside", "halftime"].includes(e.type)
  );
  for (const e of keyEvents.slice(0, 4)) {
    highlights.push(`${e.minute}' — ${e.text}`);
  }

  return { headline, paragraphs, highlights };
}
