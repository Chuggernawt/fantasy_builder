import type { SeasonFixture, SeasonLength } from "./season-types";

/** Circle-method round robin. Returns matchdays of pairings [home, away]. */
function roundRobinRound(teamIds: string[]): [string, string][][] {
  const teams = [...teamIds];
  if (teams.length % 2 === 1) teams.push("__bye__");
  const n = teams.length;
  const rounds: [string, string][][] = [];

  for (let round = 0; round < n - 1; round++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = teams[i];
      const b = teams[n - 1 - i];
      if (a !== "__bye__" && b !== "__bye__") {
        pairs.push(round % 2 === 0 ? [a, b] : [b, a]);
      }
    }
    rounds.push(pairs);
    const fixed = teams.shift()!;
    teams.splice(teams.length - 1, 0, fixed);
  }
  return rounds;
}

export function buildSeasonFixtures(
  universeIds: string[],
  userUniverseId: string,
  length: SeasonLength
): SeasonFixture[] {
  const single = roundRobinRound(universeIds);
  const rounds = length === 38 ? [...single, ...single.map((md) => md.map(([h, a]) => [a, h] as [string, string]))] : single;

  const fixtures: SeasonFixture[] = [];
  let id = 0;
  rounds.forEach((matchday, idx) => {
    const matchdayNum = idx + 1;
    for (const [home, away] of matchday) {
      fixtures.push({
        id: `fx-${id++}`,
        matchday: matchdayNum,
        homeUniverseId: home,
        awayUniverseId: away,
        played: false,
        isPlayerMatch: home === userUniverseId || away === userUniverseId,
      });
    }
  });
  return fixtures;
}

export function initSeasonTable(universeIds: string[]): import("./season-types").SeasonTeamRow[] {
  return universeIds.map((universeId) => ({
    universeId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }));
}
