import { buildMatchSnapshotFromLobbies, normalizeLobby } from "./multiplayer-lobby";
import { defaultMpMatchMeta } from "./multiplayer-match-flow";
import { applySnapshotToStore } from "./multiplayer-snapshot";
import { clearMultiplayerSession, setMultiplayerSession, bumpMultiplayerSyncGeneration } from "@/lib/multiplayer-session";
import { ensureTournamentHostMember, getRoom, prepareMultiplayerUser } from "./multiplayer";
import { supabase } from "./supabase-client";
import type { MultiplayerRoom, MultiplayerSnapshot, PlayerLobbyState } from "./multiplayer-types";
import { useGameStore } from "@/store/game-store";
import {
  activateRoundFixtures,
  addCpuToSlot,
  removeEntrantFromSlot,
  allEntrantsReady,
  allSlotsFilled,
  applyFixtureResult,
  beginTournamentAfterDraw,
  claimNextOpenSlot,
  createTournament,
  fixturePlayersReady,
  getActiveFixture,
  getEntrant,
  hasDuplicateUniverses,
  isHumanVsHumanFixture,
  runTournamentDraw,
  simAllCpuFixturesInRound,
  updateEntrantLobby,
} from "./tournament";
import { normalizeTeamTactics } from "./tactics";
import type { PenaltyMode, TournamentFormat, TournamentState } from "./tournament-types";
import { resolveTournamentWinnerFromMatch } from "./tournament-match";
import { accumulateTournamentMatchStats } from "./tournament-stats";
import {
  onlineTournamentWinKey,
  recordTournamentWinInCareerStats,
} from "./career-stats";
import { applyCareerStatsUpdate } from "./career-stats-sync";
import {
  achievementFromOnlineTournament,
  applySquadUnlockAchievement,
} from "./squad-unlocks";
import { notifyAccountProgressChanged } from "./account-progress-sync";
import type { FormationId, LineupSlot, MatchState } from "./types";
import type { MpMatchMeta } from "./multiplayer-types";

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("You must be signed in.");
  return data.user.id;
}

function maybeRecordOnlineTournamentChampionship(
  tournament: TournamentState,
  roomId: string,
  userId: string
): void {
  if (tournament.phase !== "finished" || !tournament.championId) return;
  const champion = getEntrant(tournament, tournament.championId);
  if (!champion || champion.isCpu || champion.userId !== userId) return;

  const key = onlineTournamentWinKey(roomId);
  const prevStats = useGameStore.getState().careerStats;
  const wasNewWin = !prevStats.tournamentWinKeys.includes(key);

  applyCareerStatsUpdate((stats) => recordTournamentWinInCareerStats(stats, key, true));

  if (!wasNewWin) return;

  const achievement = achievementFromOnlineTournament(tournament.format);
  if (!achievement) return;

  const { stats: nextStats, newlyUnlocked } = applySquadUnlockAchievement(
    useGameStore.getState().careerStats,
    achievement
  );
  if (!newlyUnlocked.length) return;

  useGameStore.setState({
    careerStats: nextStats,
    recentSquadUnlocks: newlyUnlocked,
  });
  notifyAccountProgressChanged();
}

function roomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Away player tried to create a shared fixture room before the home player started it. */
export class TournamentFixtureWaitError extends Error {
  constructor(message = "Waiting for your opponent to start the shared match…") {
    super(message);
    this.name = "TournamentFixtureWaitError";
  }
}

const TOURNAMENT_WRITE_ATTEMPTS = 5;

async function writeTournament(
  roomId: string,
  apply: (tournament: TournamentState) => TournamentState | null,
  opts?: { requireHost?: boolean }
): Promise<TournamentState> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < TOURNAMENT_WRITE_ATTEMPTS; attempt++) {
    const userId = await currentUserId();
    const room = await getRoom(roomId);
    if (!room.tournament) throw new Error("No tournament in this room.");
    if (opts?.requireHost && room.host_user_id !== userId) {
      throw new Error("Only the host can update tournament settings.");
    }

    const next = apply(room.tournament);
    if (!next) return room.tournament;
    if (next === room.tournament) {
      throw new Error("Tournament was not changed.");
    }

    const { error } = await supabase.from("mp_rooms").update({ tournament: next }).eq("id", roomId);
    if (!error) return next;

    lastError = new Error(error.message);
    await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
  }

  throw lastError ?? new Error("Tournament update failed — try again.");
}

/** Ensure the room host is linked to tournament slot 0 (or claims an open slot). */
export function linkUserToTournament(
  tournament: TournamentState,
  userId: string,
  displayName: string,
  isHost: boolean
): TournamentState | null {
  if (tournament.entrants.some((e) => e.userId === userId)) return null;

  if (isHost) {
    const slot0Idx = tournament.entrants.findIndex((e) => e.slot === 0);
    if (slot0Idx < 0) return null;
    const slot0 = tournament.entrants[slot0Idx];
    if (slot0.userId && slot0.userId !== userId) {
      const claimed = claimNextOpenSlot(tournament, userId, displayName);
      return claimed === tournament ? null : claimed;
    }
    const entrants = [...tournament.entrants];
    entrants[slot0Idx] = {
      ...slot0,
      userId,
      displayName: displayName || slot0.displayName,
    };
    return { ...tournament, entrants };
  }

  const claimed = claimNextOpenSlot(tournament, userId, displayName);
  return claimed === tournament ? null : claimed;
}

export async function syncTournamentEntrantOnEnter(
  room: MultiplayerRoom,
  userId: string,
  displayName: string
): Promise<TournamentState | null> {
  if (room.room_mode !== "tournament" || !room.tournament) return null;
  const isHost = room.host_user_id === userId;
  const memberRole = isHost ? "host" : "player";

  const fresh = await getRoom(room.id);
  if (!fresh.tournament) return null;
  if (fresh.tournament.entrants.some((e) => e.userId === userId)) return null;

  const linked = await writeTournament(room.id, (tournament) =>
    linkUserToTournament(tournament, userId, displayName, isHost)
  );

  if (!isHost) {
    await supabase.from("mp_room_members").upsert(
      {
        room_id: room.id,
        user_id: userId,
        role: memberRole,
      },
      { onConflict: "room_id,user_id" }
    );
  }

  return linked;
}

export async function createTournamentRoom(opts: {
  visibility: "public" | "private";
  format: TournamentFormat;
  playerCount?: number;
  penaltyMode: PenaltyMode;
  hostName: string;
}): Promise<MultiplayerRoom> {
  const hostId = await prepareMultiplayerUser();
  const code = roomCode();
  const tournament = createTournament(opts.format, {
    penaltyMode: opts.penaltyMode,
    playerCount: opts.playerCount,
    hostUserId: hostId,
    hostName: opts.hostName,
  });

  const { data, error } = await supabase
    .from("mp_rooms")
    .insert({
      code,
      host_user_id: hostId,
      visibility: opts.visibility,
      room_mode: "tournament",
      status: "waiting",
      state: null,
      tournament,
    })
    .select("*")
    .single();
  if (error) throw error;

  await ensureTournamentHostMember(data.id, hostId);

  return data as MultiplayerRoom;
}

export async function claimTournamentSlotOnJoin(
  userId: string,
  displayName: string,
  tournament: TournamentState | null
): Promise<TournamentState | null> {
  if (!tournament) return null;
  const already = tournament.entrants.find((e) => e.userId === userId);
  if (already) return tournament;
  return claimNextOpenSlot(tournament, userId, displayName);
}

export async function saveTournament(roomId: string, tournament: TournamentState): Promise<void> {
  await writeTournament(roomId, (current) => tournament, { requireHost: true });
}

export async function saveTournamentLobby(
  roomId: string,
  _tournament: TournamentState,
  entrantId: string,
  lobby: PlayerLobbyState
): Promise<TournamentState> {
  const userId = await currentUserId();
  const normalized = normalizeLobby(lobby);

  const { data, error } = await supabase.rpc("patch_tournament_entrant_lobby", {
    p_room_id: roomId,
    p_entrant_id: entrantId,
    p_lobby: normalized,
  });

  if (!error && data) {
    return data as TournamentState;
  }

  const rpcMissing =
    error?.message?.includes("patch_tournament_entrant_lobby") ||
    error?.code === "PGRST202";

  if (!rpcMissing && error) {
    throw new Error(error.message);
  }

  return writeTournament(roomId, (tournament) => {
    const entrant = getEntrant(tournament, entrantId);
    if (!entrant || entrant.userId !== userId) {
      throw new Error("Cannot update this entrant.");
    }
    return updateEntrantLobby(tournament, entrantId, normalized);
  });
}

export async function hostAddCpu(
  roomId: string,
  slot: number,
  universeId?: string
): Promise<TournamentState> {
  const userId = await currentUserId();
  const room = await getRoom(roomId);
  if (room.host_user_id !== userId) throw new Error("Only the host can add CPU players.");
  if (!room.tournament) throw new Error("No tournament in this room.");

  return writeTournament(
    roomId,
    (tournament) => {
      const next = addCpuToSlot(tournament, slot, universeId);
      return next === tournament ? null : next;
    },
    { requireHost: true }
  ).catch((err) => {
    if (err instanceof Error && err.message === "Tournament was not changed.") {
      throw new Error("Could not add CPU — slot taken or universe unavailable.");
    }
    throw err;
  });
}

export async function hostRemoveEntrant(roomId: string, slot: number): Promise<TournamentState> {
  return writeTournament(
    roomId,
    (tournament) => {
      const next = removeEntrantFromSlot(tournament, slot);
      return next === tournament ? null : next;
    },
    { requireHost: true }
  ).catch((err) => {
    if (err instanceof Error && err.message === "Tournament was not changed.") {
      throw new Error("Cannot remove this slot.");
    }
    throw err;
  });
}

export async function hostRunDraw(roomId: string): Promise<TournamentState> {
  const userId = await currentUserId();
  const room = await getRoom(roomId);
  if (room.host_user_id !== userId) throw new Error("Only the host can run the draw.");
  if (!room.tournament) throw new Error("No tournament.");
  if (!allSlotsFilled(room.tournament) || !allEntrantsReady(room.tournament)) {
    throw new Error("All slots must be filled and every player ready.");
  }
  if (hasDuplicateUniverses(room.tournament)) {
    throw new Error("Each entrant must use a different universe.");
  }

  const next = await writeTournament(
    roomId,
    (tournament) => {
      let drawn = runTournamentDraw(tournament);
      if (drawn === tournament || !drawn.drawRevealed) {
        throw new Error("Draw failed — confirm every slot has a player or CPU.");
      }
      drawn = beginTournamentAfterDraw(drawn);
      if (!drawn.fixtures.length || drawn.phase === "lobby") {
        throw new Error("Draw could not create fixtures.");
      }
      return drawn;
    },
    { requireHost: true }
  );

  const { error } = await supabase
    .from("mp_rooms")
    .update({ status: "waiting" })
    .eq("id", roomId);
  if (error) throw error;

  return next;
}

export function buildTournamentFixtureSnapshot(
  tournament: TournamentState,
  fixtureId: string
): MultiplayerSnapshot | null {
  const fixture = tournament.fixtures.find((f) => f.id === fixtureId);
  if (!fixture) return null;
  const home = getEntrant(tournament, fixture.homeEntrantId);
  const away = getEntrant(tournament, fixture.awayEntrantId);
  if (!home || !away) return null;
  return buildMatchSnapshotFromLobbies(normalizeLobby(home.lobby), normalizeLobby(away.lobby));
}

/** Load a human vs CPU fixture locally — human always controls their own built team. */
export function loadLocalTournamentFixtureIntoStore(
  tournament: TournamentState,
  fixtureId: string,
  userId: string,
  mpMeta: MpMatchMeta
): void {
  const fixture = tournament.fixtures.find((f) => f.id === fixtureId);
  if (!fixture) throw new Error("Fixture not found.");
  const entrant = tournament.entrants.find((e) => e.userId === userId && !e.isCpu);
  if (!entrant) throw new Error("You are not in this fixture.");
  const home = getEntrant(tournament, fixture.homeEntrantId);
  const away = getEntrant(tournament, fixture.awayEntrantId);
  if (!home || !away) throw new Error("Fixture entrants missing.");

  const playerIsHome = entrant.id === fixture.homeEntrantId;
  const player = playerIsHome ? home : away;
  const opponent = playerIsHome ? away : home;
  if (!player.lobby.universeId || !opponent.lobby.universeId) {
    throw new Error("Both sides need a universe.");
  }

  useGameStore.setState({
    selectedUniverseId: player.lobby.universeId,
    formationId: player.lobby.formationId as FormationId,
    lineup: player.lobby.lineup as LineupSlot[],
    matchBench: player.lobby.matchBench,
    plannedTactics: normalizeTeamTactics(player.lobby.plannedTactics),
    opponentUniverseId: opponent.lobby.universeId,
    opponentFormationId: opponent.lobby.formationId as FormationId,
    opponentLineup: opponent.lobby.lineup as LineupSlot[],
    opponentBench: opponent.lobby.matchBench,
    seasonPlayerIsHome: playerIsHome,
    seasonActiveFixtureId: null,
    matchState: null,
    pendingReveal: null,
    revealHighlights: null,
    mpMatchMeta: mpMeta,
    lastMatchContext: "tournament",
  });
  clearMultiplayerSession();
  useGameStore.getState().setTournamentActiveFixture(fixtureId);
  useGameStore.getState().startMatch();
}

function buildFixtureMpMeta(
  tournament: TournamentState,
  fixtureId: string,
  opts: { localCpuMatch: boolean; parentTournamentRoomId?: string; fixtureRoomId?: string }
): MpMatchMeta {
  const fixture = tournament.fixtures.find((f) => f.id === fixtureId);
  if (!fixture) throw new Error("Fixture not found.");
  const homeE = getEntrant(tournament, fixture.homeEntrantId);
  const awayE = getEntrant(tournament, fixture.awayEntrantId);
  return {
    ...defaultMpMatchMeta(),
    parentTournamentRoomId: opts.parentTournamentRoomId ?? null,
    fixtureRoomId: opts.fixtureRoomId ?? null,
    tournamentFixture: {
      fixtureId,
      format: tournament.format,
      penaltyMode: tournament.penaltyMode,
      homeUserId: homeE?.userId ?? null,
      awayUserId: awayE?.userId ?? null,
      localCpuMatch: opts.localCpuMatch,
    },
  };
}

async function upsertFixtureRoomMember(
  roomId: string,
  userId: string,
  role: "host" | "away",
  lobby: PlayerLobbyState
): Promise<void> {
  const { error } = await supabase.from("mp_room_members").upsert(
    {
      room_id: roomId,
      user_id: userId,
      role,
      lobby: normalizeLobby(lobby),
    },
    { onConflict: "room_id,user_id" }
  );
  if (error) {
    throw new Error(`Could not add player to fixture room: ${error.message}`);
  }
}

function withCupKnockoutMeta(
  snapshot: MultiplayerSnapshot,
  tournament: TournamentState
): MultiplayerSnapshot {
  if (tournament.format === "round_robin" || !snapshot.matchState) return snapshot;
  return {
    ...snapshot,
    matchState: {
      ...snapshot.matchState,
      tournamentMeta: {
        cupKnockout: true,
        penaltyMode: tournament.penaltyMode,
      },
    },
  };
}

/** Human vs CPU — local match; only marks the parent tournament fixture live. */
export async function beginCpuTournamentFixture(
  parentRoomId: string,
  fixtureId: string
): Promise<MultiplayerSnapshot> {
  const room = await getRoom(parentRoomId);
  const userId = await currentUserId();
  if (!room.tournament) throw new Error("No tournament.");

  const fixture = room.tournament.fixtures.find((f) => f.id === fixtureId);
  if (!fixture) throw new Error("No active fixture.");
  if (!fixturePlayersReady(room.tournament, fixture.id)) {
    throw new Error("Players in this fixture are not ready.");
  }
  if (isHumanVsHumanFixture(room.tournament, fixture.id)) {
    throw new Error("Use fixture room for human vs human matches.");
  }

  const homeE = getEntrant(room.tournament, fixture.homeEntrantId);
  const awayE = getEntrant(room.tournament, fixture.awayEntrantId);
  const humanEntrant = [homeE, awayE].find((e) => e?.userId === userId && !e.isCpu);
  if (!humanEntrant) {
    throw new Error("Only a player in this fixture can start it.");
  }

  const snapshot = buildTournamentFixtureSnapshot(room.tournament, fixture.id);
  if (!snapshot) throw new Error("Could not build match.");

  const mpMeta = buildFixtureMpMeta(room.tournament, fixture.id, {
    localCpuMatch: true,
    parentTournamentRoomId: parentRoomId,
  });
  const nextSnapshot = withCupKnockoutMeta({ ...snapshot, mp: mpMeta }, room.tournament);

  await writeTournament(parentRoomId, (tournament) => {
    const idx = tournament.fixtures.findIndex((f) => f.id === fixtureId);
    if (idx < 0) return null;
    const cur = tournament.fixtures[idx];
    if (cur.status === "finished") return null;
    if (cur.status === "live") return null;
    const fixtures = [...tournament.fixtures];
    fixtures[idx] = { ...cur, status: "live" };
    return { ...tournament, fixtures };
  });

  const parentAfter = await getRoom(parentRoomId);
  const markedLive = parentAfter.tournament?.fixtures.find((f) => f.id === fixtureId);
  if (markedLive?.status !== "live") {
    throw new Error("Could not mark your fixture as live — return to the lobby and try again.");
  }

  return nextSnapshot;
}

async function buildLiveTournamentFixtureSnapshot(
  parentRoomId: string,
  tournament: TournamentState,
  fixtureId: string,
  fixtureRoomId: string
): Promise<MultiplayerSnapshot> {
  const snapshot = buildTournamentFixtureSnapshot(tournament, fixtureId);
  if (!snapshot) throw new Error("Could not build match.");
  const mpMeta = buildFixtureMpMeta(tournament, fixtureId, {
    localCpuMatch: false,
    parentTournamentRoomId: parentRoomId,
    fixtureRoomId,
  });
  return withCupKnockoutMeta({ ...snapshot, mp: mpMeta }, tournament);
}

async function insertFixtureChildRoom(creatorUserId: string): Promise<string> {
  const code = roomCode();
  const { data, error } = await supabase
    .from("mp_rooms")
    .insert({
      code,
      host_user_id: creatorUserId,
      visibility: "private",
      room_mode: "friendly",
      status: "waiting",
      state: null,
      tournament: null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not create fixture room: ${error.message}`);
  return data.id as string;
}

async function resolveTournamentFixtureRoom(
  parentRoomId: string,
  tournament: TournamentState,
  fixtureId: string,
  childRoomId: string
): Promise<{ childRoomId: string; snapshot: MultiplayerSnapshot }> {
  const userId = await currentUserId();
  const fixture = tournament.fixtures.find((f) => f.id === fixtureId);
  if (!fixture) throw new Error("No active fixture.");

  const childRoom = await getRoom(childRoomId);
  if (childRoom.status === "live" && childRoom.state) {
    return { childRoomId, snapshot: childRoom.state };
  }

  const homeE = getEntrant(tournament, fixture.homeEntrantId);
  if (userId !== homeE?.userId) {
    throw new TournamentFixtureWaitError("The shared match is still being set up…");
  }

  const liveSnapshot = await buildLiveTournamentFixtureSnapshot(
    parentRoomId,
    tournament,
    fixtureId,
    childRoomId
  );
  const { error: childErr } = await supabase
    .from("mp_rooms")
    .update({ status: "live", state: liveSnapshot })
    .eq("id", childRoomId);
  if (childErr) throw childErr;

  return { childRoomId, snapshot: liveSnapshot };
}

/** Human vs human — one shared child friendly room; home entrant creates, away joins. */
export async function createAndStartTournamentFixtureRoom(
  parentRoomId: string,
  fixtureId: string
): Promise<{ childRoomId: string; snapshot: MultiplayerSnapshot }> {
  const userId = await currentUserId();

  for (let attempt = 0; attempt < 5; attempt++) {
    const parentRoom = await getRoom(parentRoomId);
    if (!parentRoom.tournament) throw new Error("No tournament.");

    const tournament = parentRoom.tournament;
    const fixture = tournament.fixtures.find((f) => f.id === fixtureId);
    if (!fixture) throw new Error("No active fixture.");
    if (!isHumanVsHumanFixture(tournament, fixture.id)) {
      throw new Error("Not a human vs human fixture.");
    }
    if (!fixturePlayersReady(tournament, fixture.id)) {
      throw new Error("Players in this fixture are not ready.");
    }

    const homeE = getEntrant(tournament, fixture.homeEntrantId);
    const awayE = getEntrant(tournament, fixture.awayEntrantId);
    if (!homeE?.userId || !awayE?.userId) {
      throw new Error("Both players must be present.");
    }

    const inFixture = userId === homeE.userId || userId === awayE.userId;
    if (!inFixture && parentRoom.host_user_id !== userId) {
      throw new Error("Only a player in this fixture can start it.");
    }

    if (fixture.matchRoomId) {
      return resolveTournamentFixtureRoom(
        parentRoomId,
        tournament,
        fixtureId,
        fixture.matchRoomId
      );
    }

    if (userId !== homeE.userId) {
      throw new TournamentFixtureWaitError();
    }

    const childRoomId = await insertFixtureChildRoom(userId);
    await upsertFixtureRoomMember(childRoomId, homeE.userId, "host", homeE.lobby);
    await upsertFixtureRoomMember(childRoomId, awayE.userId, "away", awayE.lobby);

    const reserved = await writeTournament(parentRoomId, (t) => {
      const f = t.fixtures.find((x) => x.id === fixtureId);
      if (!f) return null;
      if (f.matchRoomId) return null;
      return {
        ...t,
        fixtures: t.fixtures.map((x) =>
          x.id === fixtureId
            ? { ...x, status: "live" as const, matchRoomId: childRoomId }
            : x
        ),
      };
    });

    const linkedId = reserved.fixtures.find((f) => f.id === fixtureId)?.matchRoomId;
    if (linkedId && linkedId !== childRoomId) {
      continue;
    }
    if (!linkedId) {
      continue;
    }

    const liveSnapshot = await buildLiveTournamentFixtureSnapshot(
      parentRoomId,
      reserved,
      fixtureId,
      childRoomId
    );
    const { error: childErr } = await supabase
      .from("mp_rooms")
      .update({ status: "live", state: liveSnapshot })
      .eq("id", childRoomId);
    if (childErr) throw childErr;

    return { childRoomId, snapshot: liveSnapshot };
  }

  const latest = await getRoom(parentRoomId);
  const latestFixture = latest.tournament?.fixtures.find((f) => f.id === fixtureId);
  if (latestFixture?.matchRoomId) {
    return resolveTournamentFixtureRoom(
      parentRoomId,
      latest.tournament!,
      fixtureId,
      latestFixture.matchRoomId
    );
  }

  throw new Error("Could not start the shared match — try again.");
}

export function enterTournamentFixtureMatch(
  childRoomId: string,
  tournament: TournamentState,
  fixtureId: string,
  userId: string,
  snapshot: MultiplayerSnapshot
): void {
  const fixture = tournament.fixtures.find((f) => f.id === fixtureId);
  const entrant = tournament.entrants.find((e) => e.userId === userId);
  if (!fixture || !entrant) return;
  const isHome = entrant.id === fixture.homeEntrantId;
  setMultiplayerSession(childRoomId, isHome ? "host" : "away", {
    matchSide: isHome ? "home" : "away",
    simHost: isHome,
  });
  bumpMultiplayerSyncGeneration();
  useGameStore.getState().setTournamentActiveFixture(fixtureId);
  applySnapshotToStore({
    ...snapshot,
    mp: {
      ...(snapshot.mp ?? defaultMpMatchMeta()),
      fixtureRoomId: childRoomId,
    },
  });
}

export async function startTournamentFixture(
  roomId: string,
  fixtureId?: string
): Promise<MultiplayerSnapshot> {
  const room = await getRoom(roomId);
  if (!room.tournament) throw new Error("No tournament.");

  const active =
    (fixtureId ? room.tournament.fixtures.find((f) => f.id === fixtureId) : null) ??
    getActiveFixture(room.tournament);
  if (!active) throw new Error("No active fixture.");

  if (isHumanVsHumanFixture(room.tournament, active.id)) {
    const { snapshot } = await createAndStartTournamentFixtureRoom(roomId, active.id);
    return snapshot;
  }

  return beginCpuTournamentFixture(roomId, active.id);
}

export async function reportTournamentFixtureResult(
  roomId: string,
  fixtureId: string,
  matchState: MatchState
): Promise<TournamentState> {
  const userId = await currentUserId();
  const room = await getRoom(roomId);
  if (room.room_mode !== "tournament" || !room.tournament) {
    throw new Error("No tournament in this room.");
  }

  const fixture = room.tournament.fixtures.find((f) => f.id === fixtureId);
  if (!fixture) throw new Error("Fixture not found.");
  if (fixture.status === "finished") {
    return room.tournament;
  }
  if (fixture.status !== "live") {
    throw new Error("Fixture is not live — return to the tournament lobby and try again.");
  }

  const homeE = getEntrant(room.tournament, fixture.homeEntrantId);
  const awayE = getEntrant(room.tournament, fixture.awayEntrantId);
  const humanEntrant = [homeE, awayE].find((e) => e?.userId === userId && !e.isCpu);
  if (!humanEntrant) {
    throw new Error("You are not in this fixture.");
  }

  const result = resolveTournamentWinnerFromMatch(room.tournament, fixtureId, matchState);
  if (!result) throw new Error("Could not resolve match result.");

  const tournament = await writeTournament(roomId, (t) => {
    const f = t.fixtures.find((x) => x.id === fixtureId);
    if (!f || f.status === "finished") return null;
    if (f.status !== "live") return null;

    let next = accumulateTournamentMatchStats(t, fixtureId, matchState);
    next = applyFixtureResult(next, fixtureId, result);
    next = activateRoundFixtures(next);
    return next;
  });

  const recorded = tournament.fixtures.find((f) => f.id === fixtureId);
  if (recorded?.status !== "finished") {
    throw new Error("Could not record fixture result — try again.");
  }

  const status = tournament.phase === "finished" ? "finished" : "waiting";
  const { error } = await supabase
    .from("mp_rooms")
    .update({
      tournament,
      state: null,
      status,
    })
    .eq("id", roomId);
  if (error) throw error;
  maybeRecordOnlineTournamentChampionship(tournament, roomId, userId);
  return tournament;
}

export async function completeTournamentMatchIfNeeded(
  roomId: string,
  snapshot: MultiplayerSnapshot
): Promise<boolean> {
  if (snapshot.matchState?.status !== "finished") return false;

  const parentRoomId = snapshot.mp?.parentTournamentRoomId;
  const tournamentRoomId = parentRoomId ?? roomId;
  const room = await getRoom(tournamentRoomId);
  if (room.room_mode !== "tournament" || !room.tournament) return false;

  const fixtureId = snapshot.mp?.tournamentFixture?.fixtureId;
  const active =
    (fixtureId ? room.tournament.fixtures.find((f) => f.id === fixtureId) : null) ??
    getActiveFixture(room.tournament);
  if (!active || active.status !== "live") return false;

  const result = resolveTournamentWinnerFromMatch(
    room.tournament,
    active.id,
    snapshot.matchState as MatchState
  );
  if (!result) return false;

  const tournament = await writeTournament(tournamentRoomId, (t) => {
    const f = t.fixtures.find((x) => x.id === active.id);
    if (!f || f.status === "finished") return null;
    if (f.status !== "live") return null;

    let next = accumulateTournamentMatchStats(t, active.id, snapshot.matchState as MatchState);
    next = applyFixtureResult(next, active.id, result);
    next = activateRoundFixtures(next);
    return next;
  });

  const recorded = tournament.fixtures.find((f) => f.id === active.id);
  if (recorded?.status !== "finished") return false;

  const status = tournament.phase === "finished" ? "finished" : "waiting";
  const { error } = await supabase
    .from("mp_rooms")
    .update({
      tournament,
      state: null,
      status,
    })
    .eq("id", tournamentRoomId);
  if (error) throw error;

  if (parentRoomId && parentRoomId !== roomId) {
    await supabase
      .from("mp_rooms")
      .update({ status: "finished", state: snapshot })
      .eq("id", roomId);
  }

  try {
    const userId = await currentUserId();
    maybeRecordOnlineTournamentChampionship(tournament, tournamentRoomId, userId);
  } catch {
    // Not signed in — local career stats only.
  }

  return true;
}

export async function ensureTournamentPlayerLinked(
  roomId: string,
  displayName: string
): Promise<TournamentState | null> {
  const userId = await currentUserId();
  const room = await getRoom(roomId);
  if (room.room_mode !== "tournament" || !room.tournament) return null;
  if (room.tournament.entrants.some((e) => e.userId === userId)) {
    return room.tournament;
  }
  return writeTournament(roomId, (tournament) => {
    const next = claimNextOpenSlot(tournament, userId, displayName);
    return next === tournament ? null : next;
  });
}

export async function mergeTournamentOnJoin(
  roomId: string,
  displayName: string
): Promise<void> {
  await ensureTournamentPlayerLinked(roomId, displayName);
}
