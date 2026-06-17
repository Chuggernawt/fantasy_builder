import { getUniverse } from "./squads";
import { cpuRandomLineup, pickRandomBench } from "./lineup";
import type { LiteMatchResult, SeasonCardEvent, SeasonGoalEvent } from "./season-types";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function teamStrength(universeId: string): number {
  const u = getUniverse(universeId);
  if (!u) return 50;
  const avg = u.players.reduce((s, p) => s + p.ovr, 0) / u.players.length;
  return avg;
}

function expectedGoals(homeId: string, awayId: string): { home: number; away: number } {
  const h = teamStrength(homeId);
  const a = teamStrength(awayId);
  const homeExp = 0.8 + (h / (h + a)) * 2.4 + (Math.random() - 0.5) * 0.8;
  const awayExp = 0.6 + (a / (h + a)) * 2.0 + (Math.random() - 0.5) * 0.8;
  return { home: Math.max(0.2, homeExp), away: Math.max(0.2, awayExp) };
}

function poissonGoals(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

export function simulateLiteMatch(homeId: string, awayId: string): LiteMatchResult {
  const homeUni = getUniverse(homeId);
  const awayUni = getUniverse(awayId);
  const exp = expectedGoals(homeId, awayId);
  let homeScore = poissonGoals(exp.home);
  let awayScore = poissonGoals(exp.away);

  if (homeScore === 0 && awayScore === 0 && Math.random() < 0.35) {
    if (Math.random() < 0.55) homeScore = 1;
    else awayScore = 1;
  }

  const homeLineup = cpuRandomLineup(homeId, "4-3-3");
  const awayLineup = cpuRandomLineup(awayId, "4-3-3");
  const homeXI = homeLineup.map((s) => s.playerName).filter(Boolean) as string[];
  const awayXI = awayLineup.map((s) => s.playerName).filter(Boolean) as string[];

  const goals: SeasonGoalEvent[] = [];
  const cards: SeasonCardEvent[] = [];

  for (let i = 0; i < homeScore; i++) {
    const scorer = pick(homeXI);
    const assist = Math.random() < 0.65 ? pick(homeXI.filter((n) => n !== scorer)) : null;
    goals.push({
      universeId: homeId,
      playerName: scorer,
      minute: 1 + Math.floor(Math.random() * 90),
      assistUniverseId: assist ? homeId : undefined,
      assistPlayerName: assist ?? undefined,
    });
  }
  for (let i = 0; i < awayScore; i++) {
    const scorer = pick(awayXI);
    const assist = Math.random() < 0.65 ? pick(awayXI.filter((n) => n !== scorer)) : null;
    goals.push({
      universeId: awayId,
      playerName: scorer,
      minute: 1 + Math.floor(Math.random() * 90),
      assistUniverseId: assist ? awayId : undefined,
      assistPlayerName: assist ?? undefined,
    });
  }

  const foulRolls = 2 + Math.floor(Math.random() * 5);
  for (let i = 0; i < foulRolls; i++) {
    const isHome = Math.random() < 0.5;
    const uni = isHome ? homeUni : awayUni;
    const xi = isHome ? homeXI : awayXI;
    if (!uni || !xi.length) continue;
    const player = pick(xi);
    const isRed = Math.random() < 0.08;
    cards.push({
      universeId: isHome ? homeId : awayId,
      playerName: player,
      minute: 1 + Math.floor(Math.random() * 90),
      type: isRed ? "red" : "yellow",
    });
  }

  return { homeUniverseId: homeId, awayUniverseId: awayId, homeScore, awayScore, goals, cards };
}

export function prepareCpuOpponentForSeason(universeId: string): {
  formationId: "4-3-3";
  lineup: ReturnType<typeof cpuRandomLineup>;
  bench: string[];
} {
  const formationId = "4-3-3" as const;
  const lineup = cpuRandomLineup(universeId, formationId);
  const bench = pickRandomBench(universeId, lineup);
  return { formationId, lineup, bench };
}
