import { createEmptyLobby, lobbyTeamReady, normalizeLobby } from "./multiplayer-lobby";
import { simulateLiteMatch } from "./season-lite";
import { getAllUniverses, getUniverse } from "./squads";
import { cpuRandomLineup, pickRandomBench } from "./lineup";
import type {
  PenaltyMode,
  RoundRobinRow,
  TournamentEntrant,
  TournamentFixture,
  TournamentFormat,
  TournamentPhase,
  TournamentState,
} from "./tournament-types";
import { playerCountForFormat } from "./tournament-types";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickCpuUniverse(used: Set<string>): string {
  const all = getAllUniverses().map((u) => u.id);
  const free = all.filter((id) => !used.has(id));
  const pool = free.length ? free : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function createTournamentEntrant(
  slot: number,
  opts: {
    userId?: string | null;
    isCpu?: boolean;
    displayName: string;
    universeId?: string | null;
  }
): TournamentEntrant {
  const isCpu = !!opts.isCpu;
  let universeId = opts.universeId ?? null;
  if (isCpu && !universeId) {
    universeId = pickCpuUniverse(new Set());
  }
  const lobby = normalizeLobby(createEmptyLobby());
  if (universeId) {
    lobby.universeId = universeId;
    if (isCpu) {
      const formationId = "4-3-3" as const;
      const lineup = cpuRandomLineup(universeId, formationId);
      lobby.formationId = formationId;
      lobby.lineup = lineup;
      lobby.matchBench = pickRandomBench(universeId, lineup);
      lobby.ready = true;
    }
  }
  return {
    id: `slot-${slot}`,
    slot,
    userId: opts.userId ?? null,
    isCpu,
    displayName: opts.displayName,
    universeId,
    lobby,
    eliminated: false,
  };
}

export function createTournament(
  format: TournamentFormat,
  opts: {
    penaltyMode: PenaltyMode;
    playerCount?: number;
    hostUserId?: string | null;
    hostName?: string;
    localEntrantId?: string;
  }
): TournamentState {
  const playerCount = playerCountForFormat(format, opts.playerCount);
  const entrants: TournamentEntrant[] = [];
  for (let i = 0; i < playerCount; i++) {
    const isHost = i === 0;
    entrants.push(
      createTournamentEntrant(i, {
        userId: isHost ? opts.hostUserId ?? null : null,
        isCpu: false,
        displayName: isHost ? (opts.hostName ?? "Host") : `Open slot ${i + 1}`,
      })
    );
  }
  return {
    format,
    playerCount,
    phase: "lobby",
    penaltyMode: opts.penaltyMode,
    entrants,
    fixtures: [],
    drawOrder: entrants.map((e) => e.slot),
    drawRevealed: false,
    currentRound: 0,
    activeFixtureId: null,
    championId: null,
    table: [],
    localEntrantId: opts.localEntrantId ?? entrants[0]?.id ?? null,
  };
}

export function getEntrant(t: TournamentState, id: string): TournamentEntrant | undefined {
  return t.entrants.find((e) => e.id === id);
}

export function usedUniverses(t: TournamentState): Set<string> {
  return new Set(t.entrants.map((e) => e.universeId).filter((id): id is string => !!id));
}

export function addCpuToSlot(t: TournamentState, slot: number): TournamentState {
  if (t.phase !== "lobby") return t;
  const idx = t.entrants.findIndex((e) => e.slot === slot);
  if (idx < 0) return t;
  const e = t.entrants[idx];
  if (e.userId || e.isCpu) return t;
  const used = usedUniverses(t);
  const uniId = pickCpuUniverse(used);
  const uni = getUniverse(uniId);
  const next = [...t.entrants];
  next[idx] = createTournamentEntrant(slot, {
    isCpu: true,
    displayName: uni?.name ?? `CPU ${slot + 1}`,
    universeId: uniId,
  });
  return { ...t, entrants: next };
}

export function claimSlot(
  t: TournamentState,
  slot: number,
  userId: string,
  displayName: string
): TournamentState {
  if (t.phase !== "lobby") return t;
  const idx = t.entrants.findIndex((e) => e.slot === slot);
  if (idx < 0) return t;
  const e = t.entrants[idx];
  if (e.userId || e.isCpu) return t;
  const next = [...t.entrants];
  next[idx] = { ...e, userId, displayName, lobby: normalizeLobby(e.lobby) };
  return { ...t, entrants: next };
}

export function claimNextOpenSlot(
  t: TournamentState,
  userId: string,
  displayName: string
): TournamentState {
  const open = t.entrants.find((e) => !e.userId && !e.isCpu);
  if (!open) return t;
  return claimSlot(t, open.slot, userId, displayName);
}

export function updateEntrantLobby(
  t: TournamentState,
  entrantId: string,
  lobby: TournamentEntrant["lobby"]
): TournamentState {
  const next = t.entrants.map((e) =>
    e.id === entrantId ? { ...e, lobby: normalizeLobby(lobby), universeId: lobby.universeId } : e
  );
  return { ...t, entrants: next };
}

export function allSlotsFilled(t: TournamentState): boolean {
  return t.entrants.every((e) => e.userId || e.isCpu);
}

export function allEntrantsReady(t: TournamentState): boolean {
  return t.entrants.every((e) => e.isCpu || (lobbyTeamReady(e.lobby) && e.lobby.ready));
}

export function hasDuplicateUniverses(t: TournamentState): boolean {
  const ids = t.entrants.map((e) => e.lobby.universeId).filter((id): id is string => !!id);
  return new Set(ids).size !== ids.length;
}

function roundNameCup(round: number, totalRounds: number): string {
  if (round === totalRounds) return "Final";
  if (round === totalRounds - 1) return "Semi-final";
  return "Quarter-final";
}

function buildCupFixtures(orderedEntrants: TournamentEntrant[], size: 4 | 8): TournamentFixture[] {
  const finalId = uid("fix");

  if (size === 8) {
    const sf0 = uid("fix");
    const sf1 = uid("fix");
    const qfPairs = [
      [0, 7],
      [3, 4],
      [1, 6],
      [2, 5],
    ];
    const fixtures: TournamentFixture[] = [];
    const sfFeed = [sf0, sf0, sf1, sf1];
    const sfSide: Array<"home" | "away"> = ["home", "away", "home", "away"];

    for (let i = 0; i < 4; i++) {
      const [a, b] = qfPairs[i];
      fixtures.push({
        id: uid("fix"),
        round: 1,
        roundName: "Quarter-final",
        homeEntrantId: orderedEntrants[a].id,
        awayEntrantId: orderedEntrants[b].id,
        status: "pending",
        feedsIntoFixtureId: sfFeed[i],
        feedsIntoSide: sfSide[i],
      });
    }
    fixtures.push({
      id: sf0,
      round: 2,
      roundName: "Semi-final",
      homeEntrantId: "",
      awayEntrantId: "",
      status: "pending",
      feedsIntoFixtureId: finalId,
      feedsIntoSide: "home",
    });
    fixtures.push({
      id: sf1,
      round: 2,
      roundName: "Semi-final",
      homeEntrantId: "",
      awayEntrantId: "",
      status: "pending",
      feedsIntoFixtureId: finalId,
      feedsIntoSide: "away",
    });
    fixtures.push({
      id: finalId,
      round: 3,
      roundName: "Final",
      homeEntrantId: "",
      awayEntrantId: "",
      status: "pending",
    });
    return fixtures;
  }

  const sf0 = uid("fix");
  const sf1 = uid("fix");
  return [
    {
      id: sf0,
      round: 1,
      roundName: "Semi-final",
      homeEntrantId: orderedEntrants[0].id,
      awayEntrantId: orderedEntrants[3].id,
      status: "pending",
      feedsIntoFixtureId: finalId,
      feedsIntoSide: "home",
    },
    {
      id: sf1,
      round: 1,
      roundName: "Semi-final",
      homeEntrantId: orderedEntrants[1].id,
      awayEntrantId: orderedEntrants[2].id,
      status: "pending",
      feedsIntoFixtureId: finalId,
      feedsIntoSide: "away",
    },
    {
      id: finalId,
      round: 2,
      roundName: "Final",
      homeEntrantId: "",
      awayEntrantId: "",
      status: "pending",
    },
  ];
}

function buildRoundRobinFixtures(orderedEntrants: TournamentEntrant[]): TournamentFixture[] {
  const n = orderedEntrants.length;
  const ids = orderedEntrants.map((e) => e.id);
  const pairs: [string, string][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push([ids[i], ids[j]]);
    }
  }
  const shuffled = shuffle(pairs);
  return shuffled.map((pair, idx) => ({
    id: uid("fix"),
    round: idx + 1,
    roundName: `Match ${idx + 1}`,
    homeEntrantId: pair[0],
    awayEntrantId: pair[1],
    status: "pending" as const,
  }));
}

function initRoundRobinTable(entrants: TournamentEntrant[]): RoundRobinRow[] {
  return entrants.map((e) => ({
    entrantId: e.id,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }));
}

export function runTournamentDraw(t: TournamentState): TournamentState {
  if (t.phase !== "lobby" || !allSlotsFilled(t)) return t;

  const drawOrder = shuffle(t.entrants.map((e) => e.slot));
  const ordered = drawOrder.map((slot) => t.entrants.find((e) => e.slot === slot)!);

  let fixtures: TournamentFixture[] = [];
  let table: RoundRobinRow[] = [];
  if (t.format === "cup4") {
    fixtures = buildCupFixtures(ordered, 4);
  } else if (t.format === "cup8") {
    fixtures = buildCupFixtures(ordered, 8);
  } else {
    fixtures = buildRoundRobinFixtures(ordered);
    table = initRoundRobinTable(t.entrants);
  }

  return {
    ...t,
    drawOrder,
    drawRevealed: true,
    phase: "draw",
    fixtures,
    table,
    currentRound: 1,
  };
}

export function beginTournamentAfterDraw(t: TournamentState): TournamentState {
  if (!t.drawRevealed || t.phase !== "draw") return t;
  let next = { ...t, phase: "round" as TournamentPhase };
  next = simAllCpuFixturesInRound(next);
  next = activateNextFixture(next);
  return next;
}

function entrantIsCpu(t: TournamentState, id: string): boolean {
  return getEntrant(t, id)?.isCpu ?? false;
}

function fixtureHasHuman(t: TournamentState, f: TournamentFixture): boolean {
  const home = getEntrant(t, f.homeEntrantId);
  const away = getEntrant(t, f.awayEntrantId);
  return !!(home && !home.isCpu) || !!(away && !away.isCpu);
}

function simPenalties(penaltyMode: PenaltyMode): { home: number; away: number } {
  if (penaltyMode === "interactive") {
    // Interactive pens handled in full match — fallback sim if needed
  }
  let home = 3 + Math.floor(Math.random() * 3);
  let away = 3 + Math.floor(Math.random() * 3);
  while (home === away) {
    away = 3 + Math.floor(Math.random() * 3);
  }
  return { home, away };
}

export function simCupFixture(
  t: TournamentState,
  fixtureId: string
): TournamentState {
  const fixture = t.fixtures.find((f) => f.id === fixtureId);
  if (!fixture || fixture.status === "finished") return t;
  if (!fixture.homeEntrantId || !fixture.awayEntrantId) return t;

  const homeE = getEntrant(t, fixture.homeEntrantId);
  const awayE = getEntrant(t, fixture.awayEntrantId);
  if (!homeE?.universeId || !awayE?.universeId) return t;

  const result = simulateLiteMatch(homeE.universeId, awayE.universeId);
  let homeScore = result.homeScore;
  let awayScore = result.awayScore;
  let pensHome: number | undefined;
  let pensAway: number | undefined;

  let winnerId: string;
  if (homeScore > awayScore) winnerId = homeE.id;
  else if (awayScore > homeScore) winnerId = awayE.id;
  else {
    const pens = simPenalties(t.penaltyMode);
    pensHome = pens.home;
    pensAway = pens.away;
    winnerId = pens.home > pens.away ? homeE.id : awayE.id;
  }

  return applyFixtureResult(t, fixtureId, {
    homeScore,
    awayScore,
    pensHome,
    pensAway,
    winnerEntrantId: winnerId,
  });
}

export function applyFixtureResult(
  t: TournamentState,
  fixtureId: string,
  result: {
    homeScore: number;
    awayScore: number;
    pensHome?: number;
    pensAway?: number;
    winnerEntrantId: string;
  }
): TournamentState {
  const fixtures = t.fixtures.map((f) =>
    f.id === fixtureId
      ? {
          ...f,
          homeScore: result.homeScore,
          awayScore: result.awayScore,
          pensHome: result.pensHome,
          pensAway: result.pensAway,
          winnerEntrantId: result.winnerEntrantId,
          status: "finished" as const,
        }
      : f
  );

  let entrants = [...t.entrants];
  let table = [...t.table];

  const fixture = fixtures.find((f) => f.id === fixtureId)!;
  const loserId =
    result.winnerEntrantId === fixture.homeEntrantId
      ? fixture.awayEntrantId
      : fixture.homeEntrantId;

  if (t.format !== "round_robin") {
    entrants = entrants.map((e) =>
      e.id === loserId ? { ...e, eliminated: true } : e
    );
    if (fixture.feedsIntoFixtureId && fixture.feedsIntoSide) {
      const idx = fixtures.findIndex((f) => f.id === fixture.feedsIntoFixtureId);
      if (idx >= 0) {
        const nextF = { ...fixtures[idx] };
        if (fixture.feedsIntoSide === "home") nextF.homeEntrantId = result.winnerEntrantId;
        else nextF.awayEntrantId = result.winnerEntrantId;
        fixtures[idx] = nextF;
      }
    }
  } else {
    table = updateRoundRobinTable(table, fixture, result);
  }

  let next: TournamentState = {
    ...t,
    fixtures,
    entrants,
    table,
    activeFixtureId: null,
  };

  if (t.format === "round_robin") {
    const allDone = fixtures.every((f) => f.status === "finished");
    if (allDone) {
      const sorted = [...table].sort((a, b) => b.points - a.points || b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst));
      next = { ...next, phase: "finished", championId: sorted[0]?.entrantId ?? null };
    } else {
      next = activateNextFixture(next);
    }
  } else {
    const final = fixtures.find((f) => f.roundName === "Final");
    if (final?.status === "finished" && final.winnerEntrantId) {
      next = { ...next, phase: "finished", championId: final.winnerEntrantId };
    } else {
      next = simAllCpuFixturesInRound(next);
      next = activateNextFixture(next);
    }
  }

  return resetReadyForActiveFixture(next);
}

function updateRoundRobinTable(
  table: RoundRobinRow[],
  fixture: TournamentFixture,
  result: { homeScore: number; awayScore: number; winnerEntrantId: string }
): RoundRobinRow[] {
  return table.map((row) => {
    const isHome = row.entrantId === fixture.homeEntrantId;
    const isAway = row.entrantId === fixture.awayEntrantId;
    if (!isHome && !isAway) return row;
    const gf = isHome ? result.homeScore : result.awayScore;
    const ga = isHome ? result.awayScore : result.homeScore;
    let won = 0,
      drawn = 0,
      lost = 0,
      pts = 0;
    if (gf > ga) {
      won = 1;
      pts = 3;
    } else if (gf < ga) {
      lost = 1;
    } else {
      drawn = 1;
      pts = 1;
    }
    return {
      ...row,
      played: row.played + 1,
      won: row.won + won,
      drawn: row.drawn + drawn,
      lost: row.lost + lost,
      goalsFor: row.goalsFor + gf,
      goalsAgainst: row.goalsAgainst + ga,
      points: row.points + pts,
    };
  });
}

export function simAllCpuFixturesInRound(t: TournamentState): TournamentState {
  let next = t;
  for (const f of next.fixtures) {
    if (f.status !== "pending") continue;
    if (!f.homeEntrantId || !f.awayEntrantId) continue;
    const homeCpu = entrantIsCpu(next, f.homeEntrantId);
    const awayCpu = entrantIsCpu(next, f.awayEntrantId);
    if (homeCpu && awayCpu) {
      next = simCupFixture(next, f.id);
    }
  }
  return next;
}

function pendingFixtures(t: TournamentState): TournamentFixture[] {
  return t.fixtures.filter(
    (f) =>
      f.status === "pending" &&
      f.homeEntrantId &&
      f.awayEntrantId &&
      !getEntrant(t, f.homeEntrantId)?.eliminated &&
      !getEntrant(t, f.awayEntrantId)?.eliminated
  );
}

export function activateNextFixture(t: TournamentState): TournamentState {
  if (t.phase === "finished") return t;
  const pending = pendingFixtures(t);
  const humanPending = pending.find((f) => fixtureHasHuman(t, f));
  const nextFixture = humanPending ?? pending[0];
  if (!nextFixture) {
    return { ...t, activeFixtureId: null, phase: t.phase === "round" ? "between_rounds" : t.phase };
  }
  return {
    ...t,
    activeFixtureId: nextFixture.id,
    phase: "round",
    currentRound: nextFixture.round,
  };
}

export function getActiveFixture(t: TournamentState): TournamentFixture | null {
  if (!t.activeFixtureId) return null;
  return t.fixtures.find((f) => f.id === t.activeFixtureId) ?? null;
}

export function resetReadyForActiveFixture(t: TournamentState): TournamentState {
  const active = getActiveFixture(t);
  if (!active) return t;
  const ids = [active.homeEntrantId, active.awayEntrantId];
  const entrants = t.entrants.map((e) => {
    if (!ids.includes(e.id) || e.isCpu) return e;
    return {
      ...e,
      lobby: { ...normalizeLobby(e.lobby), ready: false, updatedAt: new Date().toISOString() },
    };
  });
  return { ...t, entrants, phase: "between_rounds" };
}

export function activeFixtureReady(t: TournamentState): boolean {
  const active = getActiveFixture(t);
  if (!active) return false;
  const home = getEntrant(t, active.homeEntrantId);
  const away = getEntrant(t, active.awayEntrantId);
  if (!home || !away) return false;
  if (home.isCpu && away.isCpu) return true;
  const homeOk = home.isCpu || (lobbyTeamReady(home.lobby) && home.lobby.ready);
  const awayOk = away.isCpu || (lobbyTeamReady(away.lobby) && away.lobby.ready);
  return homeOk && awayOk;
}

export function entrantIdsForUser(t: TournamentState, userId: string): string[] {
  return t.entrants.filter((e) => e.userId === userId).map((e) => e.id);
}

export function isUserInActiveFixture(t: TournamentState, userId: string): boolean {
  const active = getActiveFixture(t);
  if (!active) return false;
  const ids = entrantIdsForUser(t, userId);
  return ids.includes(active.homeEntrantId) || ids.includes(active.awayEntrantId);
}

export function sortedRoundRobinTable(t: TournamentState): RoundRobinRow[] {
  return [...t.table].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor
  );
}

export function fixtureLabel(t: TournamentState, f: TournamentFixture): string {
  const home = getEntrant(t, f.homeEntrantId)?.displayName ?? "TBD";
  const away = getEntrant(t, f.awayEntrantId)?.displayName ?? "TBD";
  if (f.status === "finished" && f.homeScore != null && f.awayScore != null) {
    const pens =
      f.pensHome != null && f.pensAway != null ? ` (${f.pensHome}-${f.pensAway} pens)` : "";
    return `${home} ${f.homeScore}-${f.awayScore} ${away}${pens}`;
  }
  return `${home} vs ${away}`;
}
