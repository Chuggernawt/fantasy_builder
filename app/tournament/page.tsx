"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BroadcastHeader } from "@/components/BroadcastHeader";
import { MultiplayerLobbyBuilder } from "@/components/MultiplayerLobbyBuilder";
import { TournamentBracketView } from "@/components/TournamentBracketView";
import {
  createEmptyLobby,
  lobbyProgressLabel,
  lobbyTeamReady,
  normalizeLobby,
} from "@/lib/multiplayer-lobby";
import type { PlayerLobbyState } from "@/lib/multiplayer-types";
import type { PenaltyMode, TournamentFormat, TournamentState } from "@/lib/tournament-types";
import {
  activeFixtureReady,
  addCpuToSlot,
  allEntrantsReady,
  allSlotsFilled,
  beginTournamentAfterDraw,
  createTournament,
  getActiveFixture,
  getEntrant,
  hasDuplicateUniverses,
  runTournamentDraw,
  updateEntrantLobby,
} from "@/lib/tournament";
import { useGameStore } from "@/store/game-store";
import type { FormationId, LineupSlot } from "@/lib/types";

export default function OfflineTournamentPage() {
  const router = useRouter();
  const tournament = useGameStore((s) => s.tournament);
  const setTournament = useGameStore((s) => s.setTournament);
  const setTournamentActiveFixture = useGameStore((s) => s.setTournamentActiveFixture);
  const startMatch = useGameStore((s) => s.startMatch);

  const [format, setFormat] = useState<TournamentFormat>("cup4");
  const [playerCount, setPlayerCount] = useState(4);
  const [penaltyMode, setPenaltyMode] = useState<PenaltyMode>("interactive");
  const [myLobby, setMyLobby] = useState<PlayerLobbyState>(createEmptyLobby());
  const [status, setStatus] = useState<string | null>(null);
  const lobbyLoaded = useRef(false);

  const localEntrant = useMemo(
    () => tournament?.entrants.find((e) => e.id === tournament.localEntrantId) ?? tournament?.entrants[0],
    [tournament]
  );

  const activeFixture = tournament ? getActiveFixture(tournament) : null;
  const inActiveFixture =
    tournament && localEntrant
      ? activeFixture &&
        (activeFixture.homeEntrantId === localEntrant.id ||
          activeFixture.awayEntrantId === localEntrant.id)
      : false;

  useEffect(() => {
    if (!localEntrant || lobbyLoaded.current) return;
    setMyLobby(normalizeLobby(localEntrant.lobby));
    lobbyLoaded.current = true;
  }, [localEntrant]);

  function saveLocalLobby(lobby: PlayerLobbyState) {
    if (!tournament || !localEntrant) return;
    setTournament(updateEntrantLobby(tournament, localEntrant.id, lobby));
  }

  function handleCreate() {
    const t = createTournament(format, {
      penaltyMode,
      playerCount: format === "round_robin" ? playerCount : undefined,
      localEntrantId: "slot-0",
      hostName: "You",
    });
    setTournament(t);
    lobbyLoaded.current = false;
    setStatus("Tournament created — add CPUs, build your team, ready up, then run the draw.");
  }

  function handleRunDraw() {
    if (!tournament) return;
    if (!allSlotsFilled(tournament) || !allEntrantsReady(tournament)) {
      setStatus("Fill every slot and ready all entrants first.");
      return;
    }
    if (hasDuplicateUniverses(tournament)) {
      setStatus("Each entrant needs a different universe.");
      return;
    }
    let next = runTournamentDraw(tournament);
    next = beginTournamentAfterDraw(next);
    setTournament(next);
    setStatus("Draw complete.");
  }

  function loadFixtureIntoStore(t: TournamentState, fixtureId: string) {
    const fixture = t.fixtures.find((f) => f.id === fixtureId);
    if (!fixture) return;
    const home = getEntrant(t, fixture.homeEntrantId);
    const away = getEntrant(t, fixture.awayEntrantId);
    if (!home?.lobby.universeId || !away?.lobby.universeId) return;

    useGameStore.setState({
      selectedUniverseId: home.lobby.universeId,
      formationId: home.lobby.formationId as FormationId,
      lineup: home.lobby.lineup as LineupSlot[],
      matchBench: home.lobby.matchBench,
      opponentUniverseId: away.lobby.universeId,
      opponentFormationId: away.lobby.formationId as FormationId,
      opponentLineup: away.lobby.lineup as LineupSlot[],
      opponentBench: away.lobby.matchBench,
      seasonActiveFixtureId: null,
      seasonPlayerIsHome: true,
    });
    setTournamentActiveFixture(fixtureId);
    startMatch();
    router.push("/match");
  }

  function handlePlayFixture() {
    if (!tournament || !activeFixture) return;
    loadFixtureIntoStore(tournament, activeFixture.id);
  }

  if (!tournament) {
    return (
      <>
        <BroadcastHeader title="Tournament" backHref="/" backLabel="Home" />
        <main className="mx-auto max-w-xl px-4 py-6">
          <div className="glass-panel space-y-3 p-4">
            <p className="broadcast-label">Offline tournament</p>
            <label className="block text-xs">
              <span className="text-slate-500">Format</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                className="mt-1 w-full border border-broadcast-border bg-black/70 px-2 py-1.5"
              >
                <option value="cup4">Cup (4)</option>
                <option value="cup8">Cup (8)</option>
                <option value="round_robin">Round Robin (3–8)</option>
              </select>
            </label>
            {format === "round_robin" ? (
              <label className="block text-xs">
                <span className="text-slate-500">Players</span>
                <input
                  type="number"
                  min={3}
                  max={8}
                  value={playerCount}
                  onChange={(e) => setPlayerCount(Number(e.target.value))}
                  className="mt-1 w-full border border-broadcast-border bg-black/70 px-2 py-1.5"
                />
              </label>
            ) : null}
            <label className="block text-xs">
              <span className="text-slate-500">Cup penalty decider</span>
              <select
                value={penaltyMode}
                onChange={(e) => setPenaltyMode(e.target.value as PenaltyMode)}
                className="mt-1 w-full border border-broadcast-border bg-black/70 px-2 py-1.5"
              >
                <option value="interactive">Play out</option>
                <option value="sim">Simulated</option>
              </select>
            </label>
            <button type="button" className="btn-broadcast-solid text-xs" onClick={handleCreate}>
              Start tournament
            </button>
            <p className="text-xs text-slate-500">
              Same rewards as friendlies. CPU slots fill empty places. Bracket and table stay visible
              throughout.
            </p>
            <Link href="/multiplayer" className="btn-broadcast inline-block text-xs">
              Online tournament instead
            </Link>
          </div>
        </main>
      </>
    );
  }

  const showBuilder =
    localEntrant &&
    !localEntrant.eliminated &&
    (tournament.phase === "lobby" || (inActiveFixture && tournament.phase === "between_rounds"));

  const takenUniverseId = useMemo(() => {
    if (!tournament || !localEntrant || !activeFixture) return null;
    if (tournament.phase === "lobby") {
      const other = tournament.entrants.find(
        (e) => e.id !== localEntrant.id && e.lobby.universeId
      );
      return other?.lobby.universeId ?? null;
    }
    const oppId =
      activeFixture.homeEntrantId === localEntrant.id
        ? activeFixture.awayEntrantId
        : activeFixture.homeEntrantId;
    return getEntrant(tournament, oppId)?.lobby.universeId ?? null;
  }, [tournament, localEntrant, activeFixture]);

  return (
    <>
      <BroadcastHeader title="Tournament" backHref="/" backLabel="Home" />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        {status ? (
          <p className="border border-broadcast-border bg-black/60 px-3 py-2 text-sm text-broadcast-highlight">
            {status}
          </p>
        ) : null}

        <div className="glass-panel p-4">
          <TournamentBracketView tournament={tournament} />
        </div>

        <div className="glass-panel p-4">
          <p className="broadcast-label mb-2">Entrants</p>
          <ul className="space-y-1 text-xs">
            {tournament.entrants.map((e) => (
              <li key={e.id} className="flex items-center justify-between border border-broadcast-border/50 px-2 py-1">
                <span>
                  {e.displayName}
                  {e.id === localEntrant?.id ? " (you)" : ""}
                  {e.isCpu ? " CPU" : ""}
                </span>
                {tournament.phase === "lobby" && !e.userId && !e.isCpu && e.id !== localEntrant?.id ? (
                  <button
                    type="button"
                    className="btn-broadcast px-2 py-0.5 text-[10px]"
                    onClick={() => setTournament(addCpuToSlot(tournament, e.slot))}
                  >
                    + CPU
                  </button>
                ) : (
                  <span className="text-slate-500">{e.lobby.ready || e.isCpu ? "Ready" : "…"}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {showBuilder ? (
          <section className="glass-panel p-3">
            <p className="broadcast-label mb-2">Your team</p>
            <MultiplayerLobbyBuilder
              lobby={myLobby}
              takenUniverseId={takenUniverseId}
              onChange={(next) => {
                setMyLobby(next);
                saveLocalLobby(next);
              }}
              onPersist={saveLocalLobby}
            />
            <p className="mt-2 text-xs text-slate-500">{lobbyProgressLabel(myLobby)}</p>
            <button
              type="button"
              className="btn-broadcast-solid mt-2 text-xs"
              disabled={myLobby.ready || !lobbyTeamReady(myLobby)}
              onClick={() => {
                const next = { ...myLobby, ready: true, updatedAt: new Date().toISOString() };
                setMyLobby(next);
                saveLocalLobby(next);
                setStatus("You are ready.");
              }}
            >
              {myLobby.ready ? "Ready ✓" : "Ready"}
            </button>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {tournament.phase === "lobby" ? (
            <button
              type="button"
              className="btn-broadcast-solid text-xs"
              disabled={!allSlotsFilled(tournament) || !allEntrantsReady(tournament)}
              onClick={handleRunDraw}
            >
              Run random draw
            </button>
          ) : null}
          {tournament.phase === "between_rounds" &&
          inActiveFixture &&
          activeFixtureReady(tournament) ? (
            <button type="button" className="btn-broadcast-solid text-xs" onClick={handlePlayFixture}>
              Play {activeFixture?.roundName}
            </button>
          ) : null}
          {tournament.phase === "finished" ? (
            <button
              type="button"
              className="btn-broadcast text-xs"
              onClick={() => {
                setTournament(null);
                lobbyLoaded.current = false;
                setStatus(null);
              }}
            >
              New tournament
            </button>
          ) : null}
          <button
            type="button"
            className="btn-broadcast text-xs"
            onClick={() => {
              setTournament(null);
              setTournamentActiveFixture(null);
              router.push("/");
            }}
          >
            Abandon
          </button>
        </div>
      </main>
    </>
  );
}
