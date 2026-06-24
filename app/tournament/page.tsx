"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BroadcastHeader } from "@/components/BroadcastHeader";
import { MultiplayerLobbyBuilder } from "@/components/MultiplayerLobbyBuilder";
import { TournamentBracketView } from "@/components/TournamentBracketView";
import { TournamentFinale } from "@/components/TournamentFinale";
import { buildTournamentFinaleSummary } from "@/lib/tournament-finale";
import { getUniverse } from "@/lib/squads";
import {
  createEmptyLobby,
  lobbyProgressLabel,
  lobbyReadyBlockReason,
  lobbyTeamReady,
  normalizeLobby,
} from "@/lib/multiplayer-lobby";
import type { PlayerLobbyState } from "@/lib/multiplayer-types";
import { normalizeTeamTactics } from "@/lib/tactics";
import type { PenaltyMode, TournamentFormat, TournamentState } from "@/lib/tournament-types";
import {
  createOfflineTournament,
  getActiveFixture,
  getEntrant,
  getEntrantActiveFixture,
  repairOfflineTournament,
  updateEntrantLobby,
  usedUniverses,
} from "@/lib/tournament";
import { returnTimelineLabel } from "@/lib/injuries";
import { getTournamentSquadStamina } from "@/lib/squad-stamina";
import { useGameStore } from "@/store/game-store";
import type { FormationId, LineupSlot } from "@/lib/types";
import { resolveTournamentCpuLineup, emptyTournamentInstance, newTournamentInstanceKey } from "@/lib/tournament-instance";

export default function OfflineTournamentPage() {
  const router = useRouter();
  const tournament = useGameStore((s) => s.tournament);
  const recentSquadUnlocks = useGameStore((s) => s.recentSquadUnlocks);
  const setTournament = useGameStore((s) => s.setTournament);
  const setTournamentActiveFixture = useGameStore((s) => s.setTournamentActiveFixture);
  const startMatch = useGameStore((s) => s.startMatch);

  const [format, setFormat] = useState<TournamentFormat>("cup4");
  const [playerCount, setPlayerCount] = useState(4);
  const [penaltyMode, setPenaltyMode] = useState<PenaltyMode>("interactive");
  const [myLobby, setMyLobby] = useState<PlayerLobbyState>(createEmptyLobby());
  const tournamentInstance = useGameStore((s) => s.tournamentInstance);

  const tournamentInjuryLabels = useMemo(() => {
    if (!tournamentInstance) return undefined;
    const labels: Record<string, string> = {};
    for (const row of Object.values(tournamentInstance.injuries)) {
      if (row.gamesOut > 0) labels[row.playerName] = returnTimelineLabel(row.gamesOut);
    }
    return labels;
  }, [tournamentInstance]);

  const tournamentFormMap = tournamentInstance?.playerForm;

  const [status, setStatus] = useState<string | null>(null);
  const lobbyLoaded = useRef(false);

  const localEntrant = useMemo(
    () => tournament?.entrants.find((e) => e.id === tournament.localEntrantId) ?? tournament?.entrants[0],
    [tournament]
  );

  const tournamentStaminaMap = useMemo(() => {
    if (!tournamentInstance || !localEntrant?.lobby.universeId) return undefined;
    const names =
      getUniverse(localEntrant.lobby.universeId)?.players.map((p) => p.name) ?? [];
    return getTournamentSquadStamina(tournamentInstance, names);
  }, [tournamentInstance, localEntrant?.lobby.universeId]);

  const tournamentFinaleSummary = useMemo(
    () => (tournament?.phase === "finished" ? buildTournamentFinaleSummary(tournament) : null),
    [tournament]
  );

  const activeFixture = tournament && localEntrant
    ? getEntrantActiveFixture(tournament, localEntrant.id) ?? getActiveFixture(tournament)
    : null;
  const inActiveFixture =
    tournament && localEntrant
      ? activeFixture &&
        (activeFixture.homeEntrantId === localEntrant.id ||
          activeFixture.awayEntrantId === localEntrant.id)
      : false;

  const takenUniverseIds = useMemo(() => {
    if (!tournament || !localEntrant) return [];
    const ids = Array.from(usedUniverses(tournament));
    const mine = localEntrant.lobby.universeId ?? localEntrant.universeId;
    return ids.filter((id) => id !== mine);
  }, [tournament, localEntrant]);

  const showBuilder =
    !!tournament &&
    !!localEntrant &&
    !localEntrant.eliminated &&
    tournament.phase !== "finished";

  useEffect(() => {
    if (!tournament?.localEntrantId || tournament.phase === "finished") return;
    if (tournament.drawRevealed && tournament.phase === "between_rounds") return;
    const repaired = repairOfflineTournament(tournament);
    if (
      repaired.phase !== tournament.phase ||
      repaired.drawRevealed !== tournament.drawRevealed ||
      repaired.fixtures.length !== tournament.fixtures.length
    ) {
      setTournament(repaired);
      setStatus("Pick your universe and lineup below, then hit Play.");
    }
  }, [tournament, setTournament]);

  useEffect(() => {
    if (!localEntrant) return;
    setMyLobby(normalizeLobby(localEntrant.lobby));
    lobbyLoaded.current = true;
  }, [localEntrant, localEntrant?.lobby.ready, localEntrant?.lobby.updatedAt, tournament?.phase]);

  function saveLocalLobby(lobby: PlayerLobbyState) {
    if (!tournament || !localEntrant) return;
    setTournament(updateEntrantLobby(tournament, localEntrant.id, lobby));
  }

  function handleCreate() {
    const t = createOfflineTournament(format, {
      penaltyMode,
      playerCount: format === "round_robin" ? playerCount : undefined,
      hostName: "You",
    });
    setTournament(t);
    lobbyLoaded.current = false;
    setStatus("Pick your universe and lineup, then hit Play.");
  }

  function loadFixtureIntoStore(t: TournamentState, fixtureId: string) {
    const fixture = t.fixtures.find((f) => f.id === fixtureId);
    if (!fixture) return;
    const local =
      t.entrants.find((e) => e.id === t.localEntrantId) ?? t.entrants[0];
    if (!local) return;
    const home = getEntrant(t, fixture.homeEntrantId);
    const away = getEntrant(t, fixture.awayEntrantId);
    if (!home?.lobby.universeId || !away?.lobby.universeId) return;

    const playerIsHome = fixture.homeEntrantId === local.id;
    const opponent = playerIsHome ? away : home;
    const player = local;

    let opponentFormationId = opponent.lobby.formationId as FormationId;
    let opponentLineup = opponent.lobby.lineup as LineupSlot[];
    let opponentBench = opponent.lobby.matchBench;
    let tournamentInstance =
      useGameStore.getState().tournamentInstance ??
      emptyTournamentInstance(newTournamentInstanceKey());

    if (opponent.isCpu && opponent.lobby.universeId) {
      const cpu = resolveTournamentCpuLineup(tournamentInstance, opponent.lobby.universeId);
      tournamentInstance = cpu.state;
      opponentFormationId = cpu.formationId;
      opponentLineup = cpu.lineup;
      opponentBench = cpu.bench;
    }

    useGameStore.setState({
      selectedUniverseId: player.lobby.universeId,
      formationId: player.lobby.formationId as FormationId,
      lineup: player.lobby.lineup as LineupSlot[],
      matchBench: player.lobby.matchBench,
      plannedTactics: normalizeTeamTactics(player.lobby.plannedTactics),
      opponentUniverseId: opponent.lobby.universeId,
      opponentFormationId,
      opponentLineup,
      opponentBench,
      tournamentInstance,
      seasonActiveFixtureId: null,
      seasonPlayerIsHome: playerIsHome,
      matchState: null,
      pendingReveal: null,
      revealHighlights: null,
    });
    setTournamentActiveFixture(fixtureId);
    startMatch();
    router.push("/match");
  }

  function handlePlayFixture() {
    if (!tournament || !activeFixture) return;
    const blockReason = lobbyReadyBlockReason(myLobby);
    if (blockReason) {
      setStatus(blockReason);
      return;
    }
    loadFixtureIntoStore(tournament, activeFixture.id);
  }

  const canPlayFixture =
    !!tournament &&
    tournament.phase === "between_rounds" &&
    inActiveFixture &&
    lobbyTeamReady(myLobby);

  if (!tournament) {
    return (
      <>
        <BroadcastHeader title="Tournament" backHref="/" backLabel="Home" />
        <main className="mx-auto max-w-xl px-4 py-6 space-y-4">
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
              CPU opponents are drawn automatically. Pick your team and play — abandon to start over
              with a new draw.
            </p>
            <Link href="/multiplayer" className="btn-broadcast inline-block text-xs">
              Online tournament instead
            </Link>
          </div>
        </main>
      </>
    );
  }

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
          <TournamentBracketView tournament={tournament} offline />
        </div>

        {showBuilder ? (
          <section className="glass-panel p-3">
            <p className="broadcast-label mb-2">Your team</p>
            <MultiplayerLobbyBuilder
              lobby={myLobby}
              takenUniverseIds={takenUniverseIds}
              playerForm={tournamentFormMap}
              playerStamina={tournamentStaminaMap}
              injuryLabels={tournamentInjuryLabels}
              showFormLegend
              onChange={(next) => {
                setMyLobby(next);
                saveLocalLobby(next);
              }}
              onPersist={saveLocalLobby}
            />
            <p className="mt-2 text-xs text-slate-500">{lobbyProgressLabel(myLobby)}</p>
            {tournament.phase === "between_rounds" && inActiveFixture ? (
              canPlayFixture ? (
                <button
                  type="button"
                  className="btn-broadcast-solid mt-3 text-xs"
                  onClick={handlePlayFixture}
                >
                  Play {activeFixture?.roundName}
                </button>
              ) : (
                <p className="mt-3 text-xs text-amber-400">
                  Complete your lineup to play {activeFixture?.roundName ?? "your fixture"}.
                </p>
              )
            ) : null}
          </section>
        ) : null}

        <div className="flex flex-wrap gap-2">
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

        {tournamentFinaleSummary ? (
          <TournamentFinale
            summary={tournamentFinaleSummary}
            championUniverseId={
              tournament.championId
                ? getEntrant(tournament, tournament.championId)?.universeId
                : null
            }
            newlyUnlockedSquadIds={
              tournamentFinaleSummary.userWon ? recentSquadUnlocks : []
            }
          />
        ) : null}

        <div className="glass-panel p-4">
          <p className="broadcast-label mb-2">Entrants</p>
          <ul className="space-y-1 text-xs">
            {tournament.entrants.map((e) => {
              const uni = e.universeId ? getUniverse(e.universeId) : null;
              return (
                <li
                  key={e.id}
                  className="flex items-center justify-between border border-broadcast-border/50 px-2 py-1"
                >
                  <span>
                    {e.displayName}
                    {e.id === localEntrant?.id ? " (you)" : ""}
                    {e.isCpu ? " · CPU" : ""}
                    {uni ? ` · ${uni.name}` : ""}
                  </span>
                  <span className="text-slate-500">
                    {e.isCpu
                      ? "CPU"
                      : e.id === localEntrant?.id
                        ? lobbyTeamReady(e.lobby)
                          ? "Set"
                          : "…"
                        : "…"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </>
  );
}
