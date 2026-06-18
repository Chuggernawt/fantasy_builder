import { supabase } from "./supabase-client";
import type {
  MemberRole,
  MultiplayerInvite,
  MultiplayerMessage,
  MultiplayerProfile,
  MultiplayerRoom,
  MultiplayerSnapshot,
  MpPlayerAction,
  PlayerLobbyState,
  RoomStatus,
  RoomVisibility,
} from "./multiplayer-types";
import {
  buildMatchSnapshotFromLobbies,
  normalizeLobby,
  validateLobbyPair,
} from "./multiplayer-lobby";
import { completeTournamentMatchIfNeeded, mergeTournamentOnJoin } from "./multiplayer-tournament";

function roomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

let profileVerified = false;

export function markMultiplayerProfileReady(): void {
  profileVerified = true;
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("You must be signed in.");
  return data.user.id;
}

async function ensureAuthenticatedProfile(): Promise<void> {
  if (profileVerified) return;
  const existing = await getMyProfile();
  if (existing) {
    profileVerified = true;
    return;
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("You must be signed in.");
  const username = String(data.user.user_metadata?.username ?? "").trim();
  if (!username) {
    throw new Error("Profile missing. Choose a username below or sign out and sign in again.");
  }
  await restoreProfile(username);
}

function lobbyFromSnapshot(snapshot: MultiplayerSnapshot | null | undefined): PlayerLobbyState | null {
  if (!snapshot?.selectedUniverseId) return null;
  return normalizeLobby({
    universeId: snapshot.selectedUniverseId,
    formationId: snapshot.formationId,
    lineup: snapshot.lineup,
    matchBench: snapshot.matchBench,
    ready: false,
    updatedAt: new Date().toISOString(),
  });
}

async function upsertRoomMember(
  roomId: string,
  userId: string,
  role: MemberRole,
  lobby?: PlayerLobbyState | null,
  tournamentSlot?: number
): Promise<void> {
  const row: Record<string, unknown> = {
    room_id: roomId,
    user_id: userId,
    role,
    lobby: lobby ?? null,
  };
  if (tournamentSlot !== undefined) {
    row.tournament_slot = tournamentSlot;
  }
  const { error } = await supabase.from("mp_room_members").upsert(row, {
    onConflict: "room_id,user_id",
  });
  if (error) throw error;
}

async function ensureRoomMember(
  roomId: string,
  userId: string,
  role: MemberRole,
  lobby?: PlayerLobbyState | null
): Promise<void> {
  await upsertRoomMember(roomId, userId, role, lobby);
}

export async function prepareMultiplayerUser(): Promise<string> {
  await ensureAuthenticatedProfile();
  return currentUserId();
}

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function isUsernameAvailable(
  username: string,
  exceptUserId?: string | null
): Promise<boolean> {
  const checkName = normalizeUsername(username);
  if (checkName.length < 3) return false;

  const { data, error } = await supabase.rpc("is_username_available", {
    check_name: checkName,
    except_user_id: exceptUserId ?? null,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("is_username_available") || msg.includes("function")) {
      throw new Error(
        "Username check is not configured. Run supabase/profile_auth_migration.sql in Supabase."
      );
    }
    throw error;
  }

  return data === true;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  profileVerified = false;
}

function profileErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.toLowerCase().includes("duplicate key value")) {
    return "That username is already taken.";
  }
  return err instanceof Error ? err.message : "Profile error.";
}

export async function ensureProfile(username: string): Promise<void> {
  const userId = await currentUserId();
  const cleanUsername = normalizeUsername(username);
  if (cleanUsername.length < 3) throw new Error("Username must be at least 3 characters.");

  const available = await isUsernameAvailable(cleanUsername, userId);
  if (!available) {
    throw new Error("That username is already taken.");
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      username: cleanUsername,
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(profileErrorMessage(error));
}

/** Signed-in session but profile row missing (e.g. admin deleted profiles). */
export async function restoreProfile(username: string): Promise<void> {
  const cleanUsername = normalizeUsername(username);
  if (cleanUsername.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }

  await ensureProfile(cleanUsername);
  await supabase.auth.updateUser({ data: { username: cleanUsername } });
  markMultiplayerProfileReady();
}

export async function signInAnonymouslyWithUsername(username: string): Promise<void> {
  const cleanUsername = normalizeUsername(username);
  if (!cleanUsername) throw new Error("Username is required.");
  if (cleanUsername.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }

  if (!(await isUsernameAvailable(cleanUsername))) {
    throw new Error("That username is already taken.");
  }

  await signOut();

  const { error } = await supabase.auth.signInAnonymously({
    options: {
      data: { username: cleanUsername },
    },
  });
  if (error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("anonymous") || lower.includes("provider is not enabled")) {
      throw new Error(
        "Anonymous sign-in is disabled in Supabase. Enable it under Authentication > Providers > Anonymous."
      );
    }
    throw error;
  }

  try {
    await ensureProfile(cleanUsername);
    markMultiplayerProfileReady();
  } catch (err) {
    await supabase.auth.signOut();
    profileVerified = false;
    throw new Error(profileErrorMessage(err));
  }
}

export async function getMyProfile(): Promise<MultiplayerProfile | null> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,username,created_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as MultiplayerProfile | null) ?? null;
}

export async function createRoom(
  visibility: RoomVisibility,
  snapshot?: MultiplayerSnapshot | null
): Promise<MultiplayerRoom> {
  const hostId = await prepareMultiplayerUser();
  const code = roomCode();
  const hostLobby = lobbyFromSnapshot(snapshot);
  const { data, error } = await supabase
    .from("mp_rooms")
    .insert({
      code,
      host_user_id: hostId,
      visibility,
      room_mode: "friendly",
      status: "waiting",
      state: snapshot ?? null,
      tournament: null,
    })
    .select("*")
    .single();
  if (error) throw error;

  await ensureRoomMember(data.id, hostId, "host", hostLobby);

  return data as MultiplayerRoom;
}

export async function joinRoomByCode(code: string): Promise<MultiplayerRoom> {
  const userId = await currentUserId();
  const { data: room, error } = await supabase
    .from("mp_rooms")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .single();
  if (error) throw error;

  const { data: members, error: mError } = await supabase
    .from("mp_room_members")
    .select("room_id,user_id,role,joined_at")
    .eq("room_id", room.id);
  if (mError) throw mError;
  const memberRows = (members ?? []) as Array<{ user_id: string; role: MemberRole }>;
  const already = memberRows.find((m) => m.user_id === userId);
  const tourney = room as MultiplayerRoom;
  if (!already) {
    let role: MemberRole = "spectator";
    if (tourney.room_mode !== "tournament") {
      const takenRoles = new Set(memberRows.map((m) => m.role));
      role = takenRoles.has("away") ? "spectator" : "away";
    } else {
      const filled =
        tourney.tournament?.entrants.filter((e) => e.userId || e.isCpu).length ?? 0;
      const max = tourney.tournament?.playerCount ?? 8;
      role = filled < max ? "player" : "spectator";
    }
    const { error: insertErr } = await supabase.from("mp_room_members").insert({
      room_id: room.id,
      user_id: userId,
      role,
    });
    if (insertErr) throw insertErr;

    if (tourney.room_mode === "tournament" && role === "player") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", userId)
        .maybeSingle();
      await mergeTournamentOnJoin(room.id, profile?.username ?? "Player");
    }
  }
  return {
    ...tourney,
    room_mode: tourney.room_mode ?? "friendly",
    tournament: tourney.tournament ?? null,
  };
}

export async function joinPublicQueue(): Promise<MultiplayerRoom> {
  const userId = await currentUserId();
  const { data: waiting, error: findErr } = await supabase
    .from("mp_rooms")
    .select("*")
    .eq("visibility", "public")
    .eq("status", "waiting")
    .neq("host_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (findErr) throw findErr;

  if (waiting && waiting.length) {
    const room = waiting[0] as MultiplayerRoom;
    await joinRoomByCode(room.code);
    return room;
  }
  return createRoom("public");
}

export async function listOpenPublicRooms(): Promise<MultiplayerRoom[]> {
  const { data, error } = await supabase
    .from("mp_rooms")
    .select("*")
    .eq("visibility", "public")
    .in("status", ["waiting", "draft", "live"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as MultiplayerRoom[]).filter(
    (r) => r.visibility === "public" && (r.room_mode ?? "friendly") !== "tournament"
  );
}

export async function ensureHostInRoom(roomId: string): Promise<boolean> {
  const userId = await currentUserId();
  const { data: room, error: roomErr } = await supabase
    .from("mp_rooms")
    .select("host_user_id, state")
    .eq("id", roomId)
    .single();
  if (roomErr) throw roomErr;
  if (room.host_user_id !== userId) return false;

  const { data: existing } = await supabase
    .from("mp_room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return false;

  await upsertRoomMember(
    roomId,
    userId,
    "host",
    lobbyFromSnapshot(room.state as MultiplayerSnapshot | null)
  );
  return true;
}

export async function ensureTournamentHostMember(roomId: string, hostId: string): Promise<void> {
  await upsertRoomMember(roomId, hostId, "host", null, 0);
}

export async function getRoom(roomId: string): Promise<MultiplayerRoom> {
  const { data, error } = await supabase.from("mp_rooms").select("*").eq("id", roomId).single();
  if (error) throw error;
  const row = data as MultiplayerRoom;
  return {
    ...row,
    room_mode: row.room_mode ?? "friendly",
    tournament: row.tournament ?? null,
  };
}

export async function listRoomMembers(
  roomId: string
): Promise<
  Array<{
    user_id: string;
    role: MemberRole;
    profile: MultiplayerProfile | null;
    lobby: PlayerLobbyState | null;
    mp_action: MpPlayerAction | null;
  }>
> {
  const { data, error } = await supabase
    .from("mp_room_members")
    .select("user_id, role, lobby, mp_action, profiles:user_id ( user_id, username, created_at )")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return ((
    data ?? []
  ) as Array<{
    user_id: string;
    role: MemberRole;
    lobby: PlayerLobbyState | null;
    mp_action: MpPlayerAction | null;
    profiles: MultiplayerProfile | MultiplayerProfile[] | null;
  }>).map((row) => ({
      user_id: row.user_id,
      role: row.role,
      lobby: row.lobby,
      mp_action: row.mp_action as MpPlayerAction | null,
      profile: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles,
    }));
}

export async function updateMyMpAction(
  roomId: string,
  action: MpPlayerAction
): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("mp_room_members")
    .update({ mp_action: action })
    .eq("room_id", roomId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function clearMemberMpAction(
  roomId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("mp_room_members")
    .update({ mp_action: null })
    .eq("room_id", roomId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updateMyLobby(
  roomId: string,
  lobby: PlayerLobbyState
): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("mp_room_members")
    .update({
      lobby: {
        ...lobby,
        updatedAt: new Date().toISOString(),
      },
    })
    .eq("room_id", roomId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function startRoomMatch(roomId: string): Promise<MultiplayerSnapshot> {
  const userId = await currentUserId();
  const room = await getRoom(roomId);
  if (room.host_user_id !== userId) {
    throw new Error("Only the host can start the game.");
  }

  const members = await listRoomMembers(roomId);
  const hostMember = members.find((m) => m.role === "host");
  const awayMember = members.find((m) => m.role === "away");
  if (!hostMember || !awayMember) {
    throw new Error("Waiting for an opponent to join.");
  }

  const hostLobby = normalizeLobby(hostMember.lobby);
  const awayLobby = normalizeLobby(awayMember.lobby);
  const validation = validateLobbyPair(hostLobby, awayLobby);
  if (!validation.ok) throw new Error(validation.error);

  const snapshot = buildMatchSnapshotFromLobbies(hostLobby, awayLobby);
  const { error } = await supabase
    .from("mp_rooms")
    .update({ status: "live", state: snapshot })
    .eq("id", roomId);
  if (error) throw error;
  return snapshot;
}

export async function setRoomStatus(roomId: string, status: RoomStatus): Promise<void> {
  const { error } = await supabase.from("mp_rooms").update({ status }).eq("id", roomId);
  if (error) throw error;
}

export async function updateRoomSnapshot(roomId: string, snapshot: MultiplayerSnapshot): Promise<void> {
  if (snapshot.matchState?.status === "finished") {
    const handled = await completeTournamentMatchIfNeeded(roomId, snapshot);
    if (handled) return;
  }
  const patch: { state: MultiplayerSnapshot; status?: RoomStatus } = { state: snapshot };
  if (snapshot.matchState?.status === "finished") {
    patch.status = "finished";
  } else if (snapshot.matchState?.status === "running") {
    patch.status = "live";
  }
  const { error } = await supabase.from("mp_rooms").update(patch).eq("id", roomId);
  if (error) throw error;
}

export async function sendRoomMessage(roomId: string, text: string): Promise<void> {
  const userId = await currentUserId();
  const body = text.trim();
  if (!body) return;
  const { error } = await supabase.from("mp_messages").insert({
    room_id: roomId,
    user_id: userId,
    text: body,
  });
  if (error) throw error;
}

export async function listRoomMessages(roomId: string): Promise<Array<MultiplayerMessage & { username: string }>> {
  const { data, error } = await supabase
    .from("mp_messages")
    .select("id,room_id,user_id,text,created_at,profiles:user_id(username)")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as Array<
    MultiplayerMessage & { profiles?: { username?: string } | Array<{ username?: string }> | null }
  >).map((row) => ({
    id: row.id,
    room_id: row.room_id,
    user_id: row.user_id,
    text: row.text,
    created_at: row.created_at,
    username: Array.isArray(row.profiles)
      ? row.profiles[0]?.username ?? "Unknown"
      : row.profiles?.username ?? "Unknown",
  }));
}

export async function inviteFriendToRoom(roomId: string, targetUsername: string): Promise<void> {
  const fromUserId = await currentUserId();
  const { data: target, error: targetErr } = await supabase
    .from("profiles")
    .select("user_id")
    .ilike("username", targetUsername.trim())
    .maybeSingle();
  if (targetErr) throw targetErr;
  if (!target) throw new Error("Username not found.");
  const { error } = await supabase.from("mp_invites").insert({
    room_id: roomId,
    from_user_id: fromUserId,
    to_user_id: target.user_id,
    status: "pending",
  });
  if (error) throw error;
}

export async function listMyInvites(): Promise<Array<MultiplayerInvite & { room_code: string | null; from_username: string | null }>> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("mp_invites")
    .select("id,room_id,from_user_id,to_user_id,status,created_at,rooms:room_id(code),profiles:from_user_id(username)")
    .eq("to_user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as Array<
    MultiplayerInvite & {
      rooms?: { code?: string } | Array<{ code?: string }> | null;
      profiles?: { username?: string } | Array<{ username?: string }> | null;
    }
  >).map((row) => ({
    id: row.id,
    room_id: row.room_id,
    from_user_id: row.from_user_id,
    to_user_id: row.to_user_id,
    status: row.status,
    created_at: row.created_at,
    room_code: Array.isArray(row.rooms) ? row.rooms[0]?.code ?? null : row.rooms?.code ?? null,
    from_username: Array.isArray(row.profiles)
      ? row.profiles[0]?.username ?? null
      : row.profiles?.username ?? null,
  }));
}

export async function respondToInvite(inviteId: string, accept: boolean): Promise<string | null> {
  const { data: invite, error } = await supabase
    .from("mp_invites")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", inviteId)
    .select("room_id")
    .single();
  if (error) throw error;
  return accept ? (invite?.room_id as string) : null;
}

export async function sendFriendRequest(username: string): Promise<void> {
  const userId = await currentUserId();
  const { data: target, error: targetErr } = await supabase
    .from("profiles")
    .select("user_id")
    .ilike("username", username.trim())
    .maybeSingle();
  if (targetErr) throw targetErr;
  if (!target) throw new Error("Username not found.");
  if (target.user_id === userId) throw new Error("You cannot add yourself.");
  const { error } = await supabase.from("friendships").insert({
    user_id: userId,
    friend_user_id: target.user_id,
    status: "pending",
  });
  if (error) throw error;
}

export async function listIncomingFriendRequests(): Promise<
  Array<{ id: string; from_user_id: string; from_username: string }>
> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("friendships")
    .select("id, user_id, profiles:user_id(username)")
    .eq("friend_user_id", userId)
    .eq("status", "pending");
  if (error) throw error;

  return ((data ?? []) as Array<{
    id: string;
    user_id: string;
    profiles: { username?: string } | Array<{ username?: string }> | null;
  }>).map((row) => ({
    id: row.id,
    from_user_id: row.user_id,
    from_username: Array.isArray(row.profiles)
      ? row.profiles[0]?.username ?? "Unknown"
      : row.profiles?.username ?? "Unknown",
  }));
}

export async function respondToFriendRequest(
  friendshipId: string,
  accept: boolean
): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", friendshipId);
  if (error) throw error;
}

export async function listFriends(): Promise<Array<{ username: string; user_id: string }>> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("friendships")
    .select("user_id,friend_user_id,status")
    .eq("status", "accepted")
    .or(`user_id.eq.${userId},friend_user_id.eq.${userId}`);
  if (error) throw error;
  const friendIds = (data ?? []).map((row: { user_id: string; friend_user_id: string }) =>
    row.user_id === userId ? row.friend_user_id : row.user_id
  );
  if (!friendIds.length) return [];
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("user_id,username")
    .in("user_id", friendIds);
  if (pErr) throw pErr;
  return (profiles ?? []) as Array<{ username: string; user_id: string }>;
}

export async function resetRoomForRematch(roomId: string): Promise<void> {
  const userId = await currentUserId();
  const room = await getRoom(roomId);
  if (room.host_user_id !== userId) {
    throw new Error("Only the host can reset the room.");
  }

  const members = await listRoomMembers(roomId);
  for (const m of members) {
    const lobby = m.lobby ? { ...normalizeLobby(m.lobby), ready: false } : null;
    const { error } = await supabase
      .from("mp_room_members")
      .update({ mp_action: null, ...(lobby ? { lobby } : {}) })
      .eq("room_id", roomId)
      .eq("user_id", m.user_id);
    if (error) throw error;
  }

  const { error } = await supabase
    .from("mp_rooms")
    .update({ status: "waiting", state: null })
    .eq("id", roomId);
  if (error) throw error;
}

export async function leaveRoom(roomId: string): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("mp_room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);
  if (error) throw error;
}
