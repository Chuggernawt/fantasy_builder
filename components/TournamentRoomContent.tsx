"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MultiplayerLobbyBuilder } from "@/components/MultiplayerLobbyBuilder";
import { TournamentBracketView } from "@/components/TournamentBracketView";
import {
  createEmptyLobby,
  lobbyProgressLabel,
  lobbyTeamReady,
  normalizeLobby,
} from "@/lib/multiplayer-lobby";
import type { MultiplayerRoom, PlayerLobbyState } from "@/lib/multiplayer-types";
import {
  activeFixtureReady,
  allEntrantsReady,
  allSlotsFilled,
  getActiveFixture,
  getEntrant,
  isUserInActiveFixture,
} from "@/lib/tournament";
import {
  hostAddCpu,
  hostRunDraw,
  saveTournamentLobby,
  startTournamentFixture,
} from "@/lib/multiplayer-tournament";
import { applySnapshotToStore } from "@/lib/multiplayer-snapshot";
import { setMultiplayerSession } from "@/lib/multiplayer-session";

const LOBBY_SAVE_MS = 350;

interface TournamentRoomContentProps {
  room: MultiplayerRoom;
  roomId: string;
  userId: string | null;
  isRoomHost: boolean;
  onRefresh: () => Promise<void>;
  onStatus: (msg: string | null) => void;
}

export function TournamentRoomContent({
  room,
  roomId,
  userId,
  isRoomHost,
  onRefresh,
  onStatus,
}: TournamentRoomContentProps) {
  const router = useRouter();
  const tournament = room.tournament;
  const [myLobby, setMyLobby] = useState<PlayerLobbyState>(createEmptyLobby());
  const lobbyLoaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myLobbyRef = useRef(myLobby);
  myLobbyRef.current = myLobby;

  const myEntrant = useMemo(
    () => tournament?.entrants.find((e) => e.userId === userId) ?? null,
    [tournament, userId]
  );

  const activeFixture = tournament ? getActiveFixture(tournament) : null;
  const inActiveFixture = tournament && userId ? isUserInActiveFixture(tournament, userId) : false;
  const canBuildTeam = !!myEntrant && !myEntrant.isCpu && !myEntrant.eliminated;
  const showLobbyBuilder =
    canBuildTeam &&
    (tournament?.phase === "lobby" ||
      (inActiveFixture && tournament?.phase === "between_rounds"));

  const takenUniverseId = useMemo(() => {
    if (!tournament || !myEntrant) return null;
    if (activeFixture && tournament.phase !== "lobby") {
      const oppId =
        activeFixture.homeEntrantId === myEntrant.id
          ? activeFixture.awayEntrantId
          : activeFixture.homeEntrantId;
      return getEntrant(tournament, oppId)?.lobby.universeId ?? null;
    }
    const other = tournament.entrants.find(
      (e) => e.id !== myEntrant.id && e.lobby.universeId
    );
    return other?.lobby.universeId ?? null;
  }, [tournament, myEntrant, activeFixture]);

  useEffect(() => {
    if (!myEntrant || lobbyLoaded.current) return;
    setMyLobby(normalizeLobby(myEntrant.lobby));
    lobbyLoaded.current = true;
  }, [myEntrant]);

  const persistLobby = useCallback(
    async (lobby: PlayerLobbyState) => {
      if (!tournament || !myEntrant) return;
      try {
        await saveTournamentLobby(roomId, tournament, myEntrant.id, lobby);
      } catch (err) {
        onStatus(err instanceof Error ? err.message : "Failed to save team.");
      }
    },
    [roomId, tournament, myEntrant, onStatus]
  );

  useEffect(() => {
    if (!lobbyLoaded.current || !canBuildTeam || !showLobbyBuilder) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persistLobby(myLobbyRef.current);
    }, LOBBY_SAVE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [myLobby, canBuildTeam, showLobbyBuilder, persistLobby]);

  useEffect(() => {
    if (!tournament || !userId || room.status !== "live" || !room.state) return;
    if (!isUserInActiveFixture(tournament, userId)) return;
    const active = getActiveFixture(tournament);
    if (!active) return;
    const entrant = tournament.entrants.find((e) => e.userId === userId);
    if (!entrant) return;
    const matchSide = entrant.id === active.homeEntrantId ? "home" : "away";
    const simHost =
      userId === room.host_user_id || entrant.id === active.homeEntrantId;
    setMultiplayerSession(roomId, userId === room.host_user_id ? "host" : "player", {
      matchSide,
      simHost,
    });
    applySnapshotToStore(room.state);
    router.replace("/match");
  }, [room.status, room.state, tournament, userId, roomId, room.host_user_id, router]);

  if (!tournament) {
    return <p className="text-sm text-slate-500">Tournament data missing.</p>;
  }

  async function handleReady() {
    if (!myEntrant) return;
    if (!lobbyTeamReady(myLobby)) {
      onStatus("Pick a universe, full XI, and 5 subs before readying up.");
      return;
    }
    const next = { ...myLobby, ready: true, updatedAt: new Date().toISOString() };
    setMyLobby(next);
    try {
      await saveTournamentLobby(roomId, tournament!, myEntrant.id, next);
      await onRefresh();
      onStatus("You are ready.");
    } catch (err) {
      onStatus(err instanceof Error ? err.message : "Failed to ready up.");
    }
  }

  async function handleRunDraw() {
    try {
      await hostRunDraw(roomId);
      await onRefresh();
      onStatus("Draw complete — bracket updated for everyone.");
    } catch (err) {
      onStatus(err instanceof Error ? err.message : "Draw failed.");
    }
  }

  async function handleStartFixture() {
    try {
      const snapshot = await startTournamentFixture(roomId);
      await onRefresh();
      if (userId && activeFixture) {
        const entrant = tournament!.entrants.find((e) => e.userId === userId);
        if (entrant && isUserInActiveFixture(tournament!, userId)) {
          const matchSide = entrant.id === activeFixture.homeEntrantId ? "home" : "away";
          const simHost =
            userId === room.host_user_id || entrant.id === activeFixture.homeEntrantId;
          setMultiplayerSession(roomId, userId === room.host_user_id ? "host" : "player", {
            matchSide,
            simHost,
          });
          applySnapshotToStore(snapshot);
          router.push("/match");
        }
      }
      onStatus("Fixture started.");
    } catch (err) {
      onStatus(err instanceof Error ? err.message : "Could not start fixture.");
    }
  }

  const canRunDraw =
    isRoomHost &&
    tournament.phase === "lobby" &&
    allSlotsFilled(tournament) &&
    allEntrantsReady(tournament);

  const canStartFixture =
    isRoomHost &&
    tournament.phase === "between_rounds" &&
    activeFixtureReady(tournament);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="glass-panel shrink-0 p-3">
        <TournamentBracketView tournament={tournament} />
      </div>

      <div className="glass-panel shrink-0 p-3">
        <p className="broadcast-label mb-2">Entrants</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {tournament.entrants.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between border border-broadcast-border/50 px-2 py-1 text-xs"
            >
              <span className={e.eliminated ? "text-slate-500 line-through" : ""}>
                {e.displayName}
                {e.isCpu ? " (CPU)" : ""}
                {e.userId === userId ? " (you)" : ""}
              </span>
              <span className="text-slate-500">
                {e.isCpu || e.lobby.ready ? "Ready" : e.userId ? "Building" : "Open"}
              </span>
              {isRoomHost && tournament.phase === "lobby" && !e.userId && !e.isCpu ? (
                <button
                  type="button"
                  className="btn-broadcast ml-2 px-2 py-0.5 text-[10px]"
                  onClick={async () => {
                    try {
                      await hostAddCpu(roomId, e.slot);
                      await onRefresh();
                    } catch (err) {
                      onStatus(err instanceof Error ? err.message : "CPU add failed.");
                    }
                  }}
                >
                  + CPU
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {showLobbyBuilder ? (
        <section className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden p-2 md:p-3">
          <p className="broadcast-label mb-2 shrink-0">Your team</p>
          <MultiplayerLobbyBuilder
            lobby={myLobby}
            takenUniverseId={takenUniverseId}
            onChange={setMyLobby}
            onPersist={(next) => {
              void persistLobby(next);
            }}
          />
          <p className="mt-2 shrink-0 text-xs text-slate-500">{lobbyProgressLabel(myLobby)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-broadcast-solid text-xs"
              disabled={myLobby.ready || !lobbyTeamReady(myLobby)}
              onClick={() => {
                void handleReady();
              }}
            >
              {myLobby.ready ? "Ready ✓" : "Ready"}
            </button>
          </div>
        </section>
      ) : null}

      {myEntrant?.eliminated ? (
        <p className="text-sm text-slate-400">You are eliminated — follow the bracket above.</p>
      ) : null}

      {!myEntrant && userId ? (
        <p className="text-sm text-slate-400">You are spectating this tournament.</p>
      ) : null}

      {isRoomHost ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          {canRunDraw ? (
            <button type="button" className="btn-broadcast-solid text-xs" onClick={() => void handleRunDraw()}>
              Run random draw
            </button>
          ) : null}
          {canStartFixture ? (
            <button
              type="button"
              className="btn-broadcast-solid text-xs"
              onClick={() => void handleStartFixture()}
            >
              Start {activeFixture?.roundName ?? "fixture"}
            </button>
          ) : null}
          {tournament.phase === "finished" ? (
            <p className="text-sm text-broadcast-highlight">Tournament complete.</p>
          ) : null}
        </div>
      ) : null}

      {tournament.phase === "between_rounds" && inActiveFixture && !myLobby.ready ? (
        <p className="text-xs text-amber-400">Ready up for the next fixture — lineups can be changed.</p>
      ) : null}
    </div>
  );
}
