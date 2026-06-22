"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BroadcastHeader } from "@/components/BroadcastHeader";
import { supabase } from "@/lib/supabase-client";
import {
  challengeMessage,
  consumePendingChallengeRoom,
  storePendingChallengeRoom,
} from "@/lib/challenge-link";
import {
  getMyProfile,
  joinRoomById,
  listRoomMembers,
  signInWithUsername,
  signUpWithUsername,
} from "@/lib/multiplayer";
import { setMultiplayerSession } from "@/lib/multiplayer-session";

function ChallengeJoinInner() {
  const search = useSearchParams();
  const router = useRouter();
  const roomId = search.get("room") ?? consumePendingChallengeRoom() ?? "";
  const challengerName = search.get("from")?.trim() || "Someone";

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [status, setStatus] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const signedIn = !!sessionUserId;
  const canAuth = useMemo(
    () => username.trim().length >= 3 && password.length > 0,
    [username, password]
  );

  useEffect(() => {
    if (roomId) storePendingChallengeRoom(roomId);
  }, [roomId]);

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

  useEffect(() => {
    if (!signedIn) {
      setProfileReady(null);
      return;
    }
    let active = true;
    getMyProfile()
      .then((profile) => {
        if (!active) return;
        setProfileReady(!!profile);
      })
      .catch(() => {
        if (!active) return;
        setProfileReady(false);
      });
    return () => {
      active = false;
    };
  }, [signedIn, sessionUserId]);

  const enterRoom = useCallback(async () => {
    if (!roomId || !sessionUserId) return;
    setJoining(true);
    setStatus("Joining room…");
    try {
      const room = await joinRoomById(roomId);
      const members = await listRoomMembers(roomId);
      const myMember = members.find((m) => m.user_id === sessionUserId);
      const role = myMember?.role ?? "spectator";
      const simHost =
        room.room_mode === "tournament"
          ? room.host_user_id === sessionUserId
          : role === "host";
      setMultiplayerSession(roomId, role, { simHost });
      consumePendingChallengeRoom();
      router.replace(`/multiplayer/room?id=${roomId}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not join this room.");
      setJoining(false);
    }
  }, [roomId, router, sessionUserId]);

  useEffect(() => {
    if (!signedIn || profileReady !== true || !roomId || joining) return;
    void enterRoom();
  }, [signedIn, profileReady, roomId, joining, enterRoom]);

  if (!roomId) {
    return (
      <>
        <BroadcastHeader title="Challenge" backHref="/multiplayer" backLabel="Lobby" />
        <main className="mx-auto max-w-xl px-4 py-8 text-sm text-slate-400">
          Invalid challenge link — no room was specified.
        </main>
      </>
    );
  }

  return (
    <>
      <BroadcastHeader title="Challenge" backHref="/multiplayer" backLabel="Lobby" />
      <main className="mx-auto max-w-xl px-4 py-6">
        <div className="glass-panel mb-4 p-4">
          <p className="broadcast-label mb-1">You&apos;ve been challenged</p>
          <p className="text-sm text-broadcast-highlight">{challengeMessage(challengerName)}</p>
          <p className="mt-2 text-xs text-slate-500">
            Sign in or create an account to join the lobby.
          </p>
        </div>

        {status ? (
          <p className="mb-4 border border-broadcast-border bg-black/60 px-3 py-2 text-sm text-broadcast-highlight">
            {status}
          </p>
        ) : null}

        {!signedIn ? (
          <div className="glass-panel p-4">
            <p className="broadcast-label mb-2">
              {authMode === "signin" ? "Sign in" : "Create account"}
            </p>
            <div className="space-y-2">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="username"
                className="w-full border border-broadcast-border bg-black/70 px-2 py-1.5 text-sm"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                className="w-full border border-broadcast-border bg-black/70 px-2 py-1.5 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canAuth}
                  className="btn-broadcast-solid text-xs"
                  onClick={async () => {
                    try {
                      if (authMode === "signup") {
                        await signUpWithUsername(username, password);
                      } else {
                        await signInWithUsername(username, password);
                      }
                      setProfileReady(true);
                      setPassword("");
                      setStatus(null);
                    } catch (err) {
                      setStatus(err instanceof Error ? err.message : "Authentication failed.");
                    }
                  }}
                >
                  {authMode === "signup" ? "Create account & join" : "Sign in & join"}
                </button>
                <button
                  type="button"
                  className="btn-broadcast text-xs"
                  onClick={() => {
                    setAuthMode((m) => (m === "signin" ? "signup" : "signin"));
                    setStatus(null);
                  }}
                >
                  {authMode === "signin" ? "Create New Account" : "Already have an account?"}
                </button>
              </div>
            </div>
          </div>
        ) : profileReady === null || joining ? (
          <div className="glass-panel p-4 text-sm text-slate-400">Joining room…</div>
        ) : profileReady === false ? (
          <div className="glass-panel p-4 text-sm text-slate-400">
            Your account profile is missing. Try signing out from the multiplayer lobby and back in.
          </div>
        ) : null}
      </main>
    </>
  );
}

export default function ChallengeJoinPage() {
  return (
    <Suspense
      fallback={
        <>
          <BroadcastHeader title="Challenge" backHref="/multiplayer" backLabel="Lobby" />
          <main className="mx-auto max-w-xl px-4 py-8 text-sm text-slate-400">Loading…</main>
        </>
      }
    >
      <ChallengeJoinInner />
    </Suspense>
  );
}
