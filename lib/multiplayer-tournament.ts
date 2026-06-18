import { buildMatchSnapshotFromLobbies, normalizeLobby } from "./multiplayer-lobby";
import { defaultMpMatchMeta } from "./multiplayer-match-flow";
import { ensureTournamentHostMember, getRoom, prepareMultiplayerUser } from "./multiplayer";
import { supabase } from "./supabase-client";
import type { MultiplayerRoom, MultiplayerSnapshot, PlayerLobbyState } from "./multiplayer-types";
import {
  activeFixtureReady,
  addCpuToSlot,
  allEntrantsReady,
  allSlotsFilled,
  applyFixtureResult,
  beginTournamentAfterDraw,
  claimNextOpenSlot,
  createTournament,
  getActiveFixture,
  getEntrant,
  hasDuplicateUniverses,
  runTournamentDraw,
  simAllCpuFixturesInRound,
  updateEntrantLobby,
} from "./tournament";
import type { PenaltyMode, TournamentFormat, TournamentState } from "./tournament-types";
import { resolveTournamentWinnerFromMatch } from "./tournament-match";
import type { MatchState } from "./types";

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("You must be signed in.");
  return data.user.id;
}

function roomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
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
  const next = linkUserToTournament(room.tournament, userId, displayName, isHost);
  if (!next) return null;

  const { error } = await supabase
    .from("mp_rooms")
    .update({ tournament: next })
    .eq("id", room.id);
  if (error) throw error;

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

  return next;
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
  const userId = await currentUserId();
  const room = await getRoom(roomId);
  if (room.host_user_id !== userId) {
    throw new Error("Only the host can update tournament settings.");
  }
  const { error } = await supabase.from("mp_rooms").update({ tournament }).eq("id", roomId);
  if (error) throw error;
}

export async function saveTournamentLobby(
  roomId: string,
  tournament: TournamentState,
  entrantId: string,
  lobby: PlayerLobbyState
): Promise<TournamentState> {
  const userId = await currentUserId();
  const entrant = getEntrant(tournament, entrantId);
  if (!entrant || entrant.userId !== userId) {
    throw new Error("Cannot update this entrant.");
  }
  const next = updateEntrantLobby(tournament, entrantId, lobby);
  const { error } = await supabase.from("mp_rooms").update({ tournament: next }).eq("id", roomId);
  if (error) throw error;
  return next;
}

export async function hostAddCpu(roomId: string, slot: number): Promise<TournamentState> {
  const room = await getRoom(roomId);
  const userId = await currentUserId();
  if (room.host_user_id !== userId) throw new Error("Only the host can add CPU players.");
  if (!room.tournament) throw new Error("No tournament in this room.");
  const next = addCpuToSlot(room.tournament, slot);
  await saveTournament(roomId, next);
  return next;
}

export async function hostRunDraw(roomId: string): Promise<TournamentState> {
  const room = await getRoom(roomId);
  const userId = await currentUserId();
  if (room.host_user_id !== userId) throw new Error("Only the host can run the draw.");
  if (!room.tournament) throw new Error("No tournament.");
  if (!allSlotsFilled(room.tournament) || !allEntrantsReady(room.tournament)) {
    throw new Error("All slots must be filled and every player ready.");
  }
  if (hasDuplicateUniverses(room.tournament)) {
    throw new Error("Each entrant must use a different universe.");
  }
  let next = runTournamentDraw(room.tournament);
  next = beginTournamentAfterDraw(next);
  const { error } = await supabase
    .from("mp_rooms")
    .update({ tournament: next, status: "waiting" })
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

export async function startTournamentFixture(roomId: string): Promise<MultiplayerSnapshot> {
  const room = await getRoom(roomId);
  const userId = await currentUserId();
  if (room.host_user_id !== userId) throw new Error("Only the host can start fixtures.");
  if (!room.tournament) throw new Error("No tournament.");
  if (!activeFixtureReady(room.tournament)) {
    throw new Error("Active fixture players are not ready.");
  }
  const active = getActiveFixture(room.tournament);
  if (!active) throw new Error("No active fixture.");

  const snapshot = buildTournamentFixtureSnapshot(room.tournament, active.id);
  if (!snapshot) throw new Error("Could not build match.");

  const homeE = getEntrant(room.tournament, active.homeEntrantId);
  const awayE = getEntrant(room.tournament, active.awayEntrantId);
  const cupKnockout = room.tournament.format !== "round_robin";
  if (snapshot.matchState && cupKnockout) {
    snapshot.matchState = {
      ...snapshot.matchState,
      tournamentMeta: {
        cupKnockout: true,
        penaltyMode: room.tournament.penaltyMode,
      },
    };
  }
  snapshot.mp = {
    ...defaultMpMatchMeta(),
    tournamentFixture: {
      fixtureId: active.id,
      format: room.tournament.format,
      penaltyMode: room.tournament.penaltyMode,
      homeUserId: homeE?.userId ?? null,
      awayUserId: awayE?.userId ?? null,
    },
  };

  const fixtures = room.tournament.fixtures.map((f) =>
    f.id === active.id ? { ...f, status: "live" as const } : f
  );
  const tournament = { ...room.tournament, fixtures };

  const { error } = await supabase
    .from("mp_rooms")
    .update({ status: "live", state: snapshot, tournament })
    .eq("id", roomId);
  if (error) throw error;
  return snapshot;
}

export async function completeTournamentMatchIfNeeded(
  roomId: string,
  snapshot: MultiplayerSnapshot
): Promise<boolean> {
  if (snapshot.matchState?.status !== "finished") return false;
  const room = await getRoom(roomId);
  if (room.room_mode !== "tournament" || !room.tournament) return false;

  const active = getActiveFixture(room.tournament);
  if (!active || active.status !== "live") return false;

  const result = resolveTournamentWinnerFromMatch(
    room.tournament,
    active.id,
    snapshot.matchState as MatchState
  );
  if (!result) return false;

  let tournament = applyFixtureResult(room.tournament, active.id, result);
  tournament = simAllCpuFixturesInRound(tournament);

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
  return true;
}

export async function mergeTournamentOnJoin(
  roomId: string,
  displayName: string
): Promise<void> {
  const userId = await currentUserId();
  const room = await getRoom(roomId);
  if (room.room_mode !== "tournament" || !room.tournament) return;
  const next = await claimTournamentSlotOnJoin(userId, displayName, room.tournament);
  if (!next) return;
  await supabase.from("mp_rooms").update({ tournament: next }).eq("id", roomId);
}
