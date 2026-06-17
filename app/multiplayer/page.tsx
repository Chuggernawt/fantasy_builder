"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BroadcastHeader } from "@/components/BroadcastHeader";
import { supabase } from "@/lib/supabase-client";
import {
  createRoom,
  getMyProfile,
  joinPublicQueue,
  joinRoomByCode,
  listFriends,
  listIncomingFriendRequests,
  listMyInvites,
  listOpenPublicRooms,
  respondToFriendRequest,
  respondToInvite,
  sendFriendRequest,
  signInAnonymouslyWithUsername,
} from "@/lib/multiplayer";
import { createTournamentRoom } from "@/lib/multiplayer-tournament";
import type { PenaltyMode, TournamentFormat } from "@/lib/tournament-types";
import { tournamentFormatLabel } from "@/lib/tournament-types";
import type { MultiplayerRoom } from "@/lib/multiplayer-types";
import { createSnapshotFromStore } from "@/lib/multiplayer-snapshot";
import { setMultiplayerSession } from "@/lib/multiplayer-session";

export default function MultiplayerPage() {
  const router = useRouter();
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [friendUsername, setFriendUsername] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [publicRooms, setPublicRooms] = useState<MultiplayerRoom[]>([]);
  const [friends, setFriends] = useState<Array<{ username: string; user_id: string }>>([]);
  const [invites, setInvites] = useState<
    Array<{ id: string; room_id: string; room_code: string | null; from_username: string | null }>
  >([]);
  const [friendRequests, setFriendRequests] = useState<
    Array<{ id: string; from_user_id: string; from_username: string }>
  >([]);
  const [tourFormat, setTourFormat] = useState<TournamentFormat>("cup4");
  const [tourPlayers, setTourPlayers] = useState(4);
  const [tourPens, setTourPens] = useState<PenaltyMode>("interactive");
  const [showTourCreate, setShowTourCreate] = useState(false);

  const signedIn = !!sessionUserId;
  const LOBBY_POLL_MS = 2500;

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSessionUserId(data.session?.user?.id ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evt, session) => {
      setSessionUserId(session?.user?.id ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function refreshLobbyData() {
    try {
      const [rooms, listInvites, listF, incomingFriends] = await Promise.all([
        listOpenPublicRooms(),
        listMyInvites(),
        listFriends(),
        listIncomingFriendRequests(),
      ]);
      setPublicRooms(rooms);
      setInvites(
        listInvites.map((i) => ({
          id: i.id,
          room_id: i.room_id,
          room_code: i.room_code,
          from_username: i.from_username,
        }))
      );
      setFriends(listF.sort((a, b) => a.username.localeCompare(b.username)));
      setFriendRequests(incomingFriends);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to refresh lobby.");
    }
  }

  useEffect(() => {
    if (!signedIn) return;
    refreshLobbyData();
    const timer = setInterval(() => {
      void refreshLobbyData();
    }, LOBBY_POLL_MS);
    return () => clearInterval(timer);
  }, [signedIn]);

  const canAuth = useMemo(() => username.trim().length >= 3, [username]);

  return (
    <>
      <BroadcastHeader title="Multiplayer" backHref="/" backLabel="Home" />
      <main className="mx-auto max-w-6xl px-4 py-6">
        {status ? (
          <p className="mb-4 border border-broadcast-border bg-black/60 px-3 py-2 text-sm text-broadcast-highlight">
            {status}
          </p>
        ) : null}

        {!signedIn ? (
          <section className="mx-auto max-w-xl">
            <div className="glass-panel p-4">
              <p className="broadcast-label mb-2">Enter multiplayer</p>
              <div className="space-y-2">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full border border-broadcast-border bg-black/70 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  disabled={!canAuth}
                  className="btn-broadcast-solid text-xs"
                  onClick={async () => {
                    try {
                      await signInAnonymouslyWithUsername(username);
                      setStatus("Signed in.");
                    } catch (err) {
                      setStatus(err instanceof Error ? err.message : "Sign in failed.");
                    }
                  }}
                >
                  Continue
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                No email or password needed. Your username is used for friends, invites, and in-room identity.
              </p>
            </div>
          </section>
        ) : (
          <section className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-broadcast-solid text-xs"
                onClick={async () => {
                  try {
                    const room = await createRoom("private", createSnapshotFromStore());
                    setMultiplayerSession(room.id, "host");
                    router.push(`/multiplayer/room?id=${room.id}`);
                  } catch (err) {
                    setStatus(err instanceof Error ? err.message : "Failed to create room.");
                  }
                }}
              >
                Create private room
              </button>
              <button
                type="button"
                className="btn-broadcast text-xs"
                onClick={() => setShowTourCreate((v) => !v)}
              >
                {showTourCreate ? "Hide tournament setup" : "Create tournament"}
              </button>
              <button
                type="button"
                className="btn-broadcast text-xs"
                onClick={async () => {
                  try {
                    const room = await joinPublicQueue();
                    setMultiplayerSession(room.id, room.host_user_id === sessionUserId ? "host" : "away");
                    router.push(`/multiplayer/room?id=${room.id}`);
                  } catch (err) {
                    setStatus(err instanceof Error ? err.message : "Queue join failed.");
                  }
                }}
              >
                Quick match (public queue)
              </button>
              <button
                type="button"
                className="btn-broadcast text-xs"
                onClick={async () => {
                  try {
                    await refreshLobbyData();
                    setStatus("Lobby refreshed.");
                  } catch {
                    // no-op
                  }
                }}
              >
                Refresh lobby
              </button>
              <Link href="/universes" className="btn-broadcast text-xs">
                Single-player
              </Link>
            </div>

            {showTourCreate ? (
              <div className="glass-panel p-4">
                <p className="broadcast-label mb-3">Online tournament</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-xs">
                    <span className="mb-1 block text-slate-500">Format</span>
                    <select
                      value={tourFormat}
                      onChange={(e) => setTourFormat(e.target.value as TournamentFormat)}
                      className="w-full border border-broadcast-border bg-black/70 px-2 py-1.5"
                    >
                      <option value="cup4">Cup (4)</option>
                      <option value="cup8">Cup (8)</option>
                      <option value="round_robin">Round Robin (3–8)</option>
                    </select>
                  </label>
                  {tourFormat === "round_robin" ? (
                    <label className="text-xs">
                      <span className="mb-1 block text-slate-500">Players</span>
                      <input
                        type="number"
                        min={3}
                        max={8}
                        value={tourPlayers}
                        onChange={(e) => setTourPlayers(Number(e.target.value))}
                        className="w-full border border-broadcast-border bg-black/70 px-2 py-1.5"
                      />
                    </label>
                  ) : null}
                  <label className="text-xs">
                    <span className="mb-1 block text-slate-500">Penalties (cup draws)</span>
                    <select
                      value={tourPens}
                      onChange={(e) => setTourPens(e.target.value as PenaltyMode)}
                      className="w-full border border-broadcast-border bg-black/70 px-2 py-1.5"
                    >
                      <option value="interactive">Play out (interactive)</option>
                      <option value="sim">Simulated</option>
                    </select>
                  </label>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {tournamentFormatLabel(tourFormat)} · host can fill slots with CPU · random draw visible to
                  everyone · same stat rewards as friendlies.
                </p>
                <button
                  type="button"
                  className="btn-broadcast-solid mt-3 text-xs"
                  onClick={async () => {
                    try {
                      const profile = await getMyProfile();
                      const room = await createTournamentRoom({
                        visibility: "private",
                        format: tourFormat,
                        playerCount: tourFormat === "round_robin" ? tourPlayers : undefined,
                        penaltyMode: tourPens,
                        hostName: profile?.username ?? "Host",
                      });
                      setMultiplayerSession(room.id, "host", { simHost: true });
                      router.push(`/multiplayer/room?id=${room.id}`);
                    } catch (err) {
                      setStatus(err instanceof Error ? err.message : "Tournament create failed.");
                    }
                  }}
                >
                  Create tournament room
                </button>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="glass-panel p-4">
                <p className="broadcast-label mb-2">Join by room code</p>
                <div className="flex gap-2">
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="ABC123"
                    className="min-w-0 flex-1 border border-broadcast-border bg-black/70 px-2 py-1.5 text-sm uppercase"
                  />
                  <button
                    type="button"
                    className="btn-broadcast-solid text-xs"
                    onClick={async () => {
                      try {
                        const room = await joinRoomByCode(joinCode);
                        const role =
                          room.host_user_id === sessionUserId
                            ? "host"
                            : room.room_mode === "tournament"
                              ? "player"
                              : "away";
                        setMultiplayerSession(room.id, role, {
                          simHost: room.host_user_id === sessionUserId,
                        });
                        router.push(`/multiplayer/room?id=${room.id}`);
                      } catch (err) {
                        setStatus(err instanceof Error ? err.message : "Unable to join room.");
                      }
                    }}
                  >
                    Join
                  </button>
                </div>
              </div>

              <div className="glass-panel p-4">
                <p className="broadcast-label mb-2">Friends</p>
                <div className="flex gap-2">
                  <input
                    value={friendUsername}
                    onChange={(e) => setFriendUsername(e.target.value)}
                    placeholder="Friend username"
                    className="min-w-0 flex-1 border border-broadcast-border bg-black/70 px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    className="btn-broadcast text-xs"
                    onClick={async () => {
                      try {
                        await sendFriendRequest(friendUsername);
                        setFriendUsername("");
                        setStatus("Friend request sent.");
                        await refreshLobbyData();
                      } catch (err) {
                        setStatus(err instanceof Error ? err.message : "Friend request failed.");
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
                {friendRequests.length ? (
                  <div className="mt-3 border-t border-broadcast-border/60 pt-3">
                    <p className="broadcast-label mb-2 text-[10px]">Incoming requests</p>
                    <ul className="space-y-2 text-xs">
                      {friendRequests.map((req) => (
                        <li
                          key={req.id}
                          className="flex flex-wrap items-center justify-between gap-2 border border-broadcast-border/60 px-2 py-1.5"
                        >
                          <span>{req.from_username}</span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="btn-broadcast-solid px-2 py-1 text-[10px]"
                              onClick={async () => {
                                try {
                                  await respondToFriendRequest(req.id, true);
                                  await refreshLobbyData();
                                  setStatus(`You are now friends with ${req.from_username}.`);
                                } catch (err) {
                                  setStatus(
                                    err instanceof Error ? err.message : "Accept failed."
                                  );
                                }
                              }}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="btn-broadcast px-2 py-1 text-[10px]"
                              onClick={async () => {
                                try {
                                  await respondToFriendRequest(req.id, false);
                                  await refreshLobbyData();
                                } catch (err) {
                                  setStatus(
                                    err instanceof Error ? err.message : "Decline failed."
                                  );
                                }
                              }}
                            >
                              Decline
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs">
                  {friends.length ? (
                    friends.map((f) => (
                      <li key={f.user_id} className="border border-broadcast-border/60 px-2 py-1">
                        {f.username}
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-500">No accepted friends yet.</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="glass-panel p-4">
                <p className="broadcast-label mb-2">Public rooms</p>
                <ul className="space-y-2 text-sm">
                  {publicRooms.length ? (
                    publicRooms.map((r) => (
                      <li key={r.id} className="flex items-center justify-between border border-broadcast-border/50 px-2 py-1.5">
                        <span className="font-mono">{r.code} · {r.status}</span>
                        <button
                          type="button"
                          className="btn-broadcast text-xs"
                          onClick={() => {
                            setMultiplayerSession(
                              r.id,
                              r.host_user_id === sessionUserId ? "host" : "spectator"
                            );
                            router.push(`/multiplayer/room?id=${r.id}`);
                          }}
                        >
                          Open
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-500">No public rooms currently.</li>
                  )}
                </ul>
              </div>

              <div className="glass-panel p-4">
                <p className="broadcast-label mb-2">Incoming invites</p>
                <ul className="space-y-2 text-sm">
                  {invites.length ? (
                    invites.map((inv) => (
                      <li key={inv.id} className="border border-broadcast-border/50 p-2">
                        <p className="text-xs text-slate-400">
                          {inv.from_username ?? "Unknown"} invited you to{" "}
                          <span className="font-mono">{inv.room_code ?? "room"}</span>
                        </p>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            className="btn-broadcast-solid text-xs"
                            onClick={async () => {
                              try {
                                const roomId = await respondToInvite(inv.id, true);
                                await refreshLobbyData();
                                if (roomId) {
                                  setMultiplayerSession(roomId, "away");
                                  router.push(`/multiplayer/room?id=${roomId}`);
                                }
                              } catch (err) {
                                setStatus(err instanceof Error ? err.message : "Invite accept failed.");
                              }
                            }}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="btn-broadcast text-xs"
                            onClick={async () => {
                              try {
                                await respondToInvite(inv.id, false);
                                await refreshLobbyData();
                              } catch (err) {
                                setStatus(err instanceof Error ? err.message : "Invite decline failed.");
                              }
                            }}
                          >
                            Decline
                          </button>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-500">No pending invites.</li>
                  )}
                </ul>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
