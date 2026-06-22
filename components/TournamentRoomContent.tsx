"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MultiplayerLobbyBuilder } from "@/components/MultiplayerLobbyBuilder";
import { TournamentBracketView } from "@/components/TournamentBracketView";
import { TournamentFinale } from "@/components/TournamentFinale";
import { TournamentStatsPanel } from "@/components/TournamentStatsPanel";
import { buildTournamentFinaleSummary } from "@/lib/tournament-finale";
import {
  createEmptyLobby,
  lobbyProgressLabel,
  lobbyReadyBlockReason,
  lobbyTeamReady,
  normalizeLobby,
} from "@/lib/multiplayer-lobby";
import type { MultiplayerRoom, PlayerLobbyState } from "@/lib/multiplayer-types";
import {
  allEntrantsReady,
  allSlotsFilled,
  fixturePlayersReady,
  getActiveFixture,
  getActiveFixtures,
  getEntrant,
  getUserActiveFixture,
  isHumanVsHumanFixture,
  isUserInActiveFixture,
  usedUniverses,
} from "@/lib/tournament";
import {
  beginCpuTournamentFixture,
  createAndStartTournamentFixtureRoom,
  enterTournamentFixtureMatch,
  hostAddCpu,
  hostRemoveEntrant,
  hostRunDraw,
  loadLocalTournamentFixtureIntoStore,
  saveTournamentLobby,
  TournamentFixtureWaitError,
} from "@/lib/multiplayer-tournament";
import { getRoom } from "@/lib/multiplayer";
import { clearMultiplayerSession } from "@/lib/multiplayer-session";
import { setTournamentReturnRoom } from "@/lib/tournament-match-session";
import { ChallengeLinkButton } from "@/components/ChallengeLinkButton";
import { CpuUniversePicker } from "@/components/CpuUniversePicker";
import { roomSupportsChallengeLink } from "@/lib/challenge-link";
import { useGameStore } from "@/store/game-store";

const LOBBY_SAVE_MS = 350;

interface TournamentRoomContentProps {
  room: MultiplayerRoom;
  roomId: string;
  userId: string | null;
  isRoomHost: boolean;
  challengerUsername: string;
  onRefresh: () => Promise<void>;
  onStatus: (msg: string | null) => void;
}

export function TournamentRoomContent({
  room,
  roomId,
  userId,
  isRoomHost,
  challengerUsername,
  onRefresh,
  onStatus,
}: TournamentRoomContentProps) {
  const router = useRouter();
  const recentSquadUnlocks = useGameStore((s) => s.recentSquadUnlocks);
  const tournament = room.tournament;
  const [myLobby, setMyLobby] = useState<PlayerLobbyState>(createEmptyLobby());
  const [readyWarning, setReadyWarning] = useState<string | null>(null);
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const lobbyLoaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myLobbyRef = useRef(myLobby);
  myLobbyRef.current = myLobby;
  const lobbyLoadKey = useRef<string | null>(null);

  const myEntrant = useMemo(
    () => tournament?.entrants.find((e) => e.userId === userId) ?? null,
    [tournament, userId]
  );

  const activeFixture = tournament ? getUserActiveFixture(tournament, userId ?? "") ?? getActiveFixture(tournament) : null;
  const myUserFixture = tournament && userId ? getUserActiveFixture(tournament, userId) : null;
  const inActiveFixture = tournament && userId ? isUserInActiveFixture(tournament, userId) : false;
  const canBuildTeam = !!myEntrant && !myEntrant.isCpu && !myEntrant.eliminated;
  const showLobbyBuilder =
    canBuildTeam &&
    (tournament?.phase === "lobby" ||
      (inActiveFixture && tournament?.phase === "between_rounds"));

  const takenUniverseIds = useMemo(() => {
    if (!tournament || !myEntrant) return [];
    const ids = Array.from(usedUniverses(tournament));
    const mine = myEntrant.lobby.universeId ?? myEntrant.universeId;
    return ids.filter((id) => id !== mine);
  }, [tournament, myEntrant]);

  useEffect(() => {
    if (!myEntrant) return;
    const loadKey = `${myEntrant.id}:${tournament?.phase ?? "lobby"}`;
    if (lobbyLoadKey.current === loadKey) return;
    lobbyLoadKey.current = loadKey;
    setMyLobby(normalizeLobby(myEntrant.lobby));
    lobbyLoaded.current = true;
  }, [myEntrant, myEntrant?.id, tournament?.phase]);

  const persistLobby = useCallback(
    async (lobby: PlayerLobbyState) => {
      if (!myEntrant) return;
      try {
        await saveTournamentLobby(roomId, tournament!, myEntrant.id, lobby);
      } catch (err) {
        onStatus(err instanceof Error ? err.message : "Failed to save team.");
      }
    },
    [roomId, myEntrant, onStatus]
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
    if (!tournament || !userId || !myUserFixture) return;
    if (myUserFixture.status !== "live" || !myUserFixture.matchRoomId) return;
    if (!isHumanVsHumanFixture(tournament, myUserFixture.id)) return;

    const childRoomId = myUserFixture.matchRoomId;
    let cancelled = false;
    void (async () => {
      try {
        const childRoom = await getRoom(childRoomId);
        if (cancelled) return;
        if (childRoom.status === "live" && childRoom.state) {
          enterTournamentFixtureMatch(
            childRoomId,
            tournament,
            myUserFixture.id,
            userId,
            childRoom.state
          );
          router.replace("/match");
        }
      } catch {
        // Retry on next poll.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tournament, userId, myUserFixture, router]);

  const tournamentFinale = useMemo(
    () =>
      tournament?.phase === "finished"
        ? buildTournamentFinaleSummary(tournament, { userId })
        : null,
    [tournament, userId]
  );

  if (!tournament) {
    return (
      <p className="text-sm text-slate-500">
        Tournament data missing — run <code className="text-xs">supabase/tournament_migration.sql</code> on
        your Supabase project, then create a new room.
      </p>
    );
  }

  function flashReadyWarning(message: string) {
    setInlineMessage(null);
    setReadyWarning(message);
    window.setTimeout(() => setReadyWarning(null), 3200);
  }

  function showInlineMessage(message: string) {
    setReadyWarning(null);
    setInlineMessage(message);
  }

  async function handleReady() {
    if (!myEntrant) return;
    const blockReason = lobbyReadyBlockReason(myLobby);
    if (blockReason) {
      flashReadyWarning(blockReason);
      return;
    }
    const next = { ...myLobby, ready: true, updatedAt: new Date().toISOString() };
    setMyLobby(next);
    try {
      await saveTournamentLobby(roomId, tournament!, myEntrant.id, next);
      await onRefresh();
      showInlineMessage("You are ready.");
    } catch (err) {
      showInlineMessage(err instanceof Error ? err.message : "Failed to ready up.");
    }
  }

  async function handleRunDraw() {
    try {
      await hostRunDraw(roomId);
      await onRefresh();
      showInlineMessage("Draw complete — start your fixture when you're set.");
    } catch (err) {
      showInlineMessage(err instanceof Error ? err.message : "Draw failed.");
    }
  }

  async function handleStartFixture(fixtureId?: string) {
    const targetId = fixtureId ?? myUserFixture?.id;
    if (!targetId || !userId) return;
    try {
      const freshRoom = await getRoom(roomId);
      const freshTournament = freshRoom.tournament;
      if (!freshTournament) throw new Error("Tournament missing.");

      const userFixture = getUserActiveFixture(freshTournament, userId);
      if (!userFixture || userFixture.id !== targetId) return;

      const humanVsHuman = isHumanVsHumanFixture(freshTournament, targetId);

      if (humanVsHuman) {
        const { childRoomId, snapshot } = await createAndStartTournamentFixtureRoom(
          roomId,
          targetId
        );
        await onRefresh();
        if (!snapshot.mp) throw new Error("Match metadata missing.");
        enterTournamentFixtureMatch(childRoomId, freshTournament, targetId, userId, snapshot);
        router.push("/match");
        showInlineMessage("Shared match started.");
        return;
      }

      const snapshot = await beginCpuTournamentFixture(roomId, targetId);
      const updatedRoom = await getRoom(roomId);
      if (!updatedRoom.tournament) throw new Error("Tournament missing.");
      await onRefresh();

      const fixture = updatedRoom.tournament.fixtures.find((f) => f.id === targetId);
      const entrant = updatedRoom.tournament.entrants.find((e) => e.userId === userId);
      if (!fixture || !entrant) return;
      const inFixture =
        entrant.id === fixture.homeEntrantId || entrant.id === fixture.awayEntrantId;
      if (!inFixture) return;

      clearMultiplayerSession();
      setTournamentReturnRoom(roomId);
      if (!snapshot.mp) throw new Error("Match metadata missing.");
      loadLocalTournamentFixtureIntoStore(
        updatedRoom.tournament,
        targetId,
        userId,
        snapshot.mp
      );

      router.push("/match");
      showInlineMessage("Your match is starting.");
    } catch (err) {
      if (err instanceof TournamentFixtureWaitError) {
        showInlineMessage(err.message);
        await onRefresh();
        return;
      }
      showInlineMessage(err instanceof Error ? err.message : "Could not start fixture.");
    }
  }

  const canRunDraw =
    isRoomHost &&
    tournament.phase === "lobby" &&
    !tournament.drawRevealed &&
    allSlotsFilled(tournament) &&
    allEntrantsReady(tournament);

  const pendingActiveFixture =
    myUserFixture &&
    (myUserFixture.status === "pending" || myUserFixture.status === "ready");

  const myFixtureReady = pendingActiveFixture
    ? fixturePlayersReady(tournament, myUserFixture.id)
    : false;

  const humanFinalFixture =
    myUserFixture && isHumanVsHumanFixture(tournament, myUserFixture.id);
  const myFinalEntrant =
    humanFinalFixture && userId
      ? tournament.entrants.find((e) => e.userId === userId)
      : null;
  const isHomeInHumanFixture =
    !!myFinalEntrant && myFinalEntrant.id === myUserFixture?.homeEntrantId;
  const fixtureStartLabel = humanFinalFixture
    ? myUserFixture?.matchRoomId
      ? `Join ${myUserFixture.roundName}`
      : isHomeInHumanFixture
        ? `Start ${myUserFixture?.roundName ?? "match"}`
        : `Waiting for ${myUserFixture?.roundName ?? "match"}`
    : `Start ${myUserFixture?.roundName ?? "match"}`;


  const showStartMatchButton =
    !!pendingActiveFixture &&
    myFixtureReady &&
    tournament.phase !== "lobby" &&
    tournament.phase !== "finished" &&
    !!myUserFixture;

  const parallelFixtures = getActiveFixtures(tournament).filter((f) => f.status === "pending");

  const showChallengeLink = roomSupportsChallengeLink(room) && tournament.phase === "lobby";
  const isKnockout = tournament.format === "cup4" || tournament.format === "cup8";
  const showDrawBracket = tournament.drawRevealed && tournament.fixtures.length > 0;

  const showActionBar =
    showLobbyBuilder ||
    canRunDraw ||
    showStartMatchButton ||
    (isRoomHost && tournament.phase !== "lobby" && tournament.phase !== "finished");

  const actionBar = showActionBar ? (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-broadcast-border/40 pt-2">
      {showLobbyBuilder ? (
        <button
          type="button"
          className="btn-broadcast-solid text-xs"
          disabled={myLobby.ready}
          onClick={() => {
            void handleReady();
          }}
        >
          {myLobby.ready ? "Ready ✓" : "Ready"}
        </button>
      ) : null}
      {canRunDraw ? (
        <button type="button" className="btn-broadcast-solid text-xs" onClick={() => void handleRunDraw()}>
          Run random draw
        </button>
      ) : null}
      {showStartMatchButton && myUserFixture ? (
        <button
          type="button"
          className="btn-broadcast-solid text-xs"
          title={fixtureStartLabel}
          disabled={
            !!humanFinalFixture && !isHomeInHumanFixture && !myUserFixture.matchRoomId
          }
          onClick={() => void handleStartFixture(myUserFixture.id)}
        >
          {fixtureStartLabel}
        </button>
      ) : null}
      {readyWarning ? (
        <p className="animate-pulse text-xs text-red-300">{readyWarning}</p>
      ) : inlineMessage ? (
        <p className="min-w-0 flex-1 text-xs text-broadcast-highlight">{inlineMessage}</p>
      ) : showStartMatchButton === false && myUserFixture && !myFixtureReady ? (
        <p className="text-xs text-amber-400">
          Ready up for {myUserFixture.roundName} — then you can start your match.
        </p>
      ) : parallelFixtures.length > 1 ? (
        <p className="text-xs text-slate-400">
          {parallelFixtures.length} fixtures in this round can play at the same time.
        </p>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col gap-3 pb-3">
          <div className="shrink-0 glass-panel p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="broadcast-label">Entrants</p>
              {showChallengeLink ? (
                <ChallengeLinkButton
                  roomId={roomId}
                  challengerUsername={challengerUsername}
                  className="btn-broadcast-solid text-xs"
                />
              ) : null}
            </div>
            <ul className="grid gap-1 sm:grid-cols-2">
              {tournament.entrants.map((e) => {
                const drawSeed =
                  tournament.drawRevealed && tournament.drawOrder.includes(e.slot)
                    ? tournament.drawOrder.indexOf(e.slot) + 1
                    : null;
                return (
                <li
                  key={e.id}
                  className="flex items-center justify-between border border-broadcast-border/50 px-2 py-1 text-xs"
                >
                  <span className={e.eliminated ? "text-slate-500 line-through" : ""}>
                    {drawSeed ? (
                      <span className="mr-1.5 font-mono text-[10px] text-broadcast-highlight">#{drawSeed}</span>
                    ) : null}
                    {e.displayName}
                    {e.isCpu ? " (CPU)" : ""}
                    {e.userId === userId ? " (you)" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    {isRoomHost && tournament.phase === "lobby" && !e.userId && !e.isCpu ? (
                      <CpuUniversePicker
                        takenUniverseIds={Array.from(usedUniverses(tournament))}
                        onAdd={async (universeId) => {
                          try {
                            await hostAddCpu(roomId, e.slot, universeId);
                            await onRefresh();
                          } catch (err) {
                            onStatus(err instanceof Error ? err.message : "CPU add failed.");
                          }
                        }}
                      />
                    ) : null}
                    {isRoomHost && tournament.phase === "lobby" && (e.isCpu || e.userId) && e.slot !== 0 ? (
                      <button
                        type="button"
                        className="btn-broadcast ml-2 px-2 py-0.5 text-[10px] text-red-300"
                        onClick={async () => {
                          try {
                            await hostRemoveEntrant(roomId, e.slot);
                            await onRefresh();
                          } catch (err) {
                            onStatus(err instanceof Error ? err.message : "Remove failed.");
                          }
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                    <span className="text-slate-500">
                      {e.isCpu || e.lobby.ready ? "Ready" : e.userId ? "Building" : "Open"}
                    </span>
                  </span>
                </li>
              );
              })}
            </ul>

            {showDrawBracket ? (
              <div className="mt-3 border-t border-broadcast-border/40 pt-3">
                <p className="broadcast-label mb-2">Draw &amp; bracket</p>
                <TournamentBracketView
                  tournament={tournament}
                  compact
                  graphicOnly={isKnockout}
                />
              </div>
            ) : tournament.phase === "lobby" ? (
              <p className="mt-2 text-[10px] text-slate-500">
                Bracket appears here after the host runs the draw.
              </p>
            ) : null}

            {actionBar}
          </div>

          {tournamentFinale ? (
            <TournamentFinale
              summary={tournamentFinale}
              championUniverseId={
                tournament.championId
                  ? getEntrant(tournament, tournament.championId)?.universeId
                  : null
              }
              newlyUnlockedSquadIds={tournamentFinale.userWon ? recentSquadUnlocks : []}
            />
          ) : tournament.drawRevealed && tournament.stats?.matchesPlayed ? (
            <TournamentStatsPanel
              stats={tournament.stats}
              title={
                tournament.phase === "between_rounds"
                  ? "Stats so far — next round"
                  : "Tournament stats"
              }
            />
          ) : null}

          {showLobbyBuilder ? (
            <section className="glass-panel flex min-h-[min(18rem,40vh)] flex-col overflow-hidden p-2 md:p-3">
              <p className="broadcast-label mb-2 shrink-0">Your team</p>
              <MultiplayerLobbyBuilder
                lobby={myLobby}
                takenUniverseIds={takenUniverseIds}
                onChange={setMyLobby}
                onPersist={(next) => {
                  void persistLobby(next);
                }}
              />
              <p className="mt-2 shrink-0 text-xs text-slate-500">{lobbyProgressLabel(myLobby)}</p>
            </section>
          ) : null}

          {myEntrant?.eliminated ? (
            <p className="text-sm text-slate-400">You are eliminated — follow the bracket above.</p>
          ) : null}

          {!myEntrant && userId && isRoomHost ? (
            <p className="text-sm text-amber-400">Setting up your tournament slot…</p>
          ) : null}

          {!myEntrant && userId && !isRoomHost ? (
            <p className="text-sm text-slate-400">You are spectating this tournament.</p>
          ) : null}

          {tournament.phase === "between_rounds" && inActiveFixture && !myLobby.ready ? (
            <p className="text-xs text-amber-400">Ready up for the next fixture — lineups can be changed.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
