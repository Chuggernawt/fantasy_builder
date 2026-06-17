"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BroadcastHeader } from "@/components/BroadcastHeader";
import {
  MultiplayerLobbyBuilder,
  OpponentLobbyPreview,
} from "@/components/MultiplayerLobbyBuilder";
import { supabase } from "@/lib/supabase-client";
import {
  getRoom,
  inviteFriendToRoom,
  leaveRoom,
  listFriends,
  listRoomMembers,
  listRoomMessages,
  sendRoomMessage,
  startRoomMatch,
  updateMyLobby,
} from "@/lib/multiplayer";
import type { MultiplayerRoom, PlayerLobbyState } from "@/lib/multiplayer-types";
import {
  createEmptyLobby,
  lobbyProgressLabel,
  lobbyTeamReady,
  normalizeLobby,
  validateLobbyPair,
} from "@/lib/multiplayer-lobby";
import { applySnapshotToStore } from "@/lib/multiplayer-snapshot";
import { clearMultiplayerSession, setMultiplayerSession } from "@/lib/multiplayer-session";
import { TournamentRoomContent } from "@/components/TournamentRoomContent";

const LOBBY_SAVE_MS = 350;
const ROOM_POLL_MS = 2500;

function MultiplayerRoomInner() {
  const search = useSearchParams();
  const router = useRouter();
  const roomId = search.get("id") ?? "";
  const [room, setRoom] = useState<MultiplayerRoom | null>(null);
  const [members, setMembers] = useState<
    Array<{
      user_id: string;
      role: string;
      profile: { username: string } | null;
      lobby: PlayerLobbyState | null;
    }>
  >([]);
  const [myLobby, setMyLobby] = useState<PlayerLobbyState>(createEmptyLobby());
  const [messages, setMessages] = useState<Array<{ id: string; username: string; text: string }>>([]);
  const [msgText, setMsgText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<Array<{ username: string; user_id: string }>>([]);
  const [inviteBusy, setInviteBusy] = useState<string | null>(null);
  const lobbyLoaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myLobbyRef = useRef(myLobby);
  myLobbyRef.current = myLobby;

  const me = useMemo(
    () => members.find((m) => m.user_id === userId) ?? null,
    [members, userId]
  );
  const opponent = useMemo(() => {
    if (!me) return null;
    if (me.role === "host") {
      return members.find((m) => m.role === "away") ?? null;
    }
    if (me.role === "away") {
      return members.find((m) => m.role === "host") ?? null;
    }
    return null;
  }, [members, me]);
  const isHost = room && userId ? room.host_user_id === userId : false;
  const canPlay = me?.role === "host" || me?.role === "away";
  const canInviteFriends = isHost && room?.status === "waiting" && !opponent;

  useEffect(() => {
    if (!canInviteFriends) return;
    let active = true;
    listFriends()
      .then((list) => {
        if (active) setFriends(list.sort((a, b) => a.username.localeCompare(b.username)));
      })
      .catch(() => {
        if (active) setFriends([]);
      });
    return () => {
      active = false;
    };
  }, [canInviteFriends]);

  const persistLobby = useCallback(async (lobby: PlayerLobbyState) => {
    if (!roomId) return;
    try {
      await updateMyLobby(roomId, lobby);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save team.");
    }
  }, [roomId]);

  const refreshRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      const [{ data: auth }, roomData, memberRows, msgRows] = await Promise.all([
        supabase.auth.getUser(),
        getRoom(roomId),
        listRoomMembers(roomId),
        listRoomMessages(roomId),
      ]);
      const uid = auth.user?.id ?? null;
      setUserId(uid);
      setRoom(roomData);
      setMembers(
        memberRows.map((m) => ({
          user_id: m.user_id,
          role: m.role,
          profile: m.profile ? { username: m.profile.username } : null,
          lobby: m.lobby,
        }))
      );
      setMessages(msgRows.map((m) => ({ id: m.id, username: m.username, text: m.text })));

      const myMember = memberRows.find((m) => m.user_id === uid);
      if (myMember?.role && roomId) {
        setMultiplayerSession(roomId, myMember.role);
      }
      if (myMember && !lobbyLoaded.current) {
        const loaded = normalizeLobby(myMember.lobby);
        setMyLobby(loaded);
        lobbyLoaded.current = true;
        if (myMember.role === "host" || myMember.role === "away") {
          void updateMyLobby(roomId, loaded).catch(() => {
            // Initial write — ignore if row already has lobby data.
          });
        }
      }

      if (roomData.status === "live" && roomData.state && roomData.room_mode !== "tournament") {
        applySnapshotToStore(roomData.state);
        router.replace("/match");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load room.");
    }
  }, [roomId, router]);

  useEffect(() => {
    refreshRoom();
  }, [refreshRoom]);

  useEffect(() => {
    if (!roomId) return;
    const ch = supabase
      .channel(`mp-room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mp_rooms", filter: `id=eq.${roomId}` },
        () => {
          refreshRoom();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mp_room_members", filter: `room_id=eq.${roomId}` },
        () => {
          refreshRoom();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mp_messages", filter: `room_id=eq.${roomId}` },
        () => {
          refreshRoom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomId, refreshRoom]);

  useEffect(() => {
    if (!roomId) return;
    const timer = setInterval(() => {
      void refreshRoom();
    }, ROOM_POLL_MS);
    return () => clearInterval(timer);
  }, [roomId, refreshRoom]);

  useEffect(() => {
    if (!roomId || !lobbyLoaded.current || !canPlay) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persistLobby(myLobbyRef.current);
    }, LOBBY_SAVE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [roomId, canPlay, myLobby, persistLobby]);

  const opponentLobby = normalizeLobby(opponent?.lobby);
  const myReady = myLobby.ready;
  const opponentReady = opponentLobby.ready;
  const bothReady = myReady && opponentReady && !!opponent;
  const startValidation =
    opponent && bothReady
      ? validateLobbyPair(
          isHost ? myLobby : opponentLobby,
          isHost ? opponentLobby : myLobby
        )
      : null;
  const canStart = isHost && startValidation?.ok === true;

  async function handleReady() {
    if (!lobbyTeamReady(myLobby)) {
      setStatus("Pick a universe, full XI, and 5 subs before readying up.");
      return;
    }
    if (opponentLobby.universeId && myLobby.universeId === opponentLobby.universeId) {
      setStatus("You cannot pick the same universe as your opponent.");
      return;
    }
    const next = { ...myLobby, ready: true, updatedAt: new Date().toISOString() };
    setMyLobby(next);
    try {
      await updateMyLobby(roomId, next);
      setStatus("You are ready.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to ready up.");
    }
  }

  async function handleStartGame() {
    try {
      const snapshot = await startRoomMatch(roomId);
      applySnapshotToStore(snapshot);
      router.push("/match");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to start game.");
    }
  }

  async function handleSendMessage() {
    const text = msgText.trim();
    if (!text) return;
    try {
      await sendRoomMessage(roomId, text);
      setMsgText("");
      await refreshRoom();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Send failed.");
    }
  }

  if (!roomId) {
    return (
      <>
        <BroadcastHeader title="Multiplayer Room" backHref="/multiplayer" backLabel="Lobby" />
        <main className="mx-auto max-w-4xl px-4 py-8 text-sm text-slate-400">Missing room id.</main>
      </>
    );
  }

  if (!room) {
    return (
      <>
        <BroadcastHeader title="Multiplayer Room" backHref="/multiplayer" backLabel="Lobby" />
        <main className="mx-auto max-w-4xl px-4 py-8 text-sm text-slate-400">Loading room...</main>
      </>
    );
  }

  const isTournament = room.room_mode === "tournament";

  return (
    <>
      <BroadcastHeader
        title={isTournament ? `Tournament ${room.code}` : `Room ${room.code}`}
        backHref="/multiplayer"
        backLabel="Lobby"
      />
      <main className="mx-auto grid h-[calc(100dvh-3.25rem)] max-w-7xl grid-rows-[auto_minmax(0,1fr)] gap-3 px-2 py-2 md:px-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] lg:grid-rows-1 lg:gap-4">
        {status ? (
          <p className="border border-broadcast-border bg-black/60 px-3 py-2 text-sm text-broadcast-highlight lg:col-span-2">
            {status}
          </p>
        ) : null}

        {isTournament ? (
          <TournamentRoomContent
            room={room}
            roomId={roomId}
            userId={userId}
            isRoomHost={isHost}
            onRefresh={refreshRoom}
            onStatus={setStatus}
          />
        ) : (
        <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
          <div className="glass-panel shrink-0 px-3 py-2">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-mono">{room.code}</span>
              <span className="text-slate-500">
                {members
                  .filter((m) => m.role === "host" || m.role === "away")
                  .map((m) => m.profile?.username ?? "Unknown")
                  .join(" vs ") || "Waiting for players"}
              </span>
              {!opponent ? (
                <span className="text-amber-400">Waiting for opponent to join...</span>
              ) : null}
            </div>
            {opponent ? (
              <div className="mt-2 border-t border-broadcast-border/40 pt-2">
                <OpponentLobbyPreview
                  username={opponent.profile?.username ?? "Opponent"}
                  lobby={opponentLobby}
                  compact
                />
              </div>
            ) : null}
          </div>

          {!canPlay ? (
            <p className="text-sm text-slate-400">Spectators can watch once the match starts.</p>
          ) : (
            <section className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden p-2 md:p-3">
              <p className="broadcast-label mb-2 shrink-0">Your team</p>
              <MultiplayerLobbyBuilder
                lobby={myLobby}
                takenUniverseId={opponentLobby.universeId}
                onChange={setMyLobby}
                onPersist={(next) => {
                  void persistLobby(next);
                }}
              />
              <p className="mt-2 shrink-0 text-xs text-slate-500">{lobbyProgressLabel(myLobby)}</p>
            </section>
          )}

          {canPlay ? (
            <div className="flex shrink-0 flex-wrap items-center gap-3 px-1">
              <button
                type="button"
                className="btn-broadcast-solid text-xs"
                disabled={myReady || !lobbyTeamReady(myLobby)}
                onClick={handleReady}
              >
                {myReady ? "Ready ✓" : "Ready"}
              </button>
              {isHost ? (
                <button
                  type="button"
                  className="btn-broadcast text-xs"
                  disabled={!canStart}
                  onClick={handleStartGame}
                >
                  Start game
                </button>
              ) : null}
              <span className="text-xs text-slate-500">
                {myReady ? "You are ready." : "Build your team, then click Ready."}
                {opponent
                  ? opponentReady
                    ? " Opponent is ready."
                    : " Opponent is still building."
                  : ""}
                {isHost && bothReady && startValidation && !startValidation.ok
                  ? ` ${startValidation.error}`
                  : ""}
              </span>
            </div>
          ) : null}
        </div>
        )}

        <section className="glass-panel flex min-h-[12rem] flex-col p-3 lg:min-h-0">
          <p className="broadcast-label mb-2">Room chat</p>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto border border-broadcast-border/40 p-2 text-sm">
            {messages.length ? (
              messages.map((m) => (
                <p key={m.id}>
                  <span className="text-broadcast-highlight">{m.username}:</span> {m.text}
                </p>
              ))
            ) : (
              <p className="text-slate-500">No messages yet.</p>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder="Type message..."
              className="min-w-0 flex-1 border border-broadcast-border bg-black/70 px-2 py-1.5 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSendMessage();
                }
              }}
            />
            <button
              type="button"
              className="btn-broadcast-solid text-xs"
              onClick={() => {
                void handleSendMessage();
              }}
            >
              Send
            </button>
          </div>

          {canInviteFriends ? (
            <div className="mt-4 border-t border-broadcast-border/40 pt-3">
              <p className="broadcast-label mb-2">Invite a friend</p>
              <p className="mb-2 text-[10px] leading-snug text-slate-500">
                Send a room invite while you wait. They&apos;ll see it on the multiplayer lobby.
              </p>
              <ul className="max-h-36 space-y-1 overflow-y-auto text-xs">
                {friends.length ? (
                  friends.map((f) => (
                    <li
                      key={f.user_id}
                      className="flex items-center justify-between gap-2 border border-broadcast-border/60 px-2 py-1.5"
                    >
                      <span className="truncate">{f.username}</span>
                      <button
                        type="button"
                        className="btn-broadcast shrink-0 px-2 py-1 text-[10px]"
                        disabled={inviteBusy === f.user_id}
                        onClick={async () => {
                          setInviteBusy(f.user_id);
                          try {
                            await inviteFriendToRoom(roomId, f.username);
                            setStatus(`Invite sent to ${f.username}.`);
                          } catch (err) {
                            setStatus(err instanceof Error ? err.message : "Invite failed.");
                          } finally {
                            setInviteBusy(null);
                          }
                        }}
                      >
                        {inviteBusy === f.user_id ? "…" : "Invite"}
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">Add friends from the multiplayer lobby first.</li>
                )}
              </ul>
            </div>
          ) : null}

          <button
            type="button"
            className="btn-broadcast mt-3 self-start text-xs"
            onClick={async () => {
              try {
                clearMultiplayerSession();
                await leaveRoom(roomId);
                router.push("/multiplayer");
              } catch (err) {
                setStatus(err instanceof Error ? err.message : "Leave room failed.");
              }
            }}
          >
            Leave room
          </button>
        </section>
      </main>
    </>
  );
}

export default function MultiplayerRoomPage() {
  return (
    <Suspense
      fallback={
        <>
          <BroadcastHeader title="Multiplayer Room" backHref="/multiplayer" backLabel="Lobby" />
          <main className="mx-auto max-w-4xl px-4 py-8 text-sm text-slate-400">Loading room...</main>
        </>
      }
    >
      <MultiplayerRoomInner />
    </Suspense>
  );
}
