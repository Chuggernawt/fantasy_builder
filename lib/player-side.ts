import { getMultiplayerSession } from "./multiplayer-session";
import { useGameStore } from "@/store/game-store";
import type { FormationId, LineupSlot, MatchState, TeamSetup } from "./types";

/** Online synced match where away players use opponentLineup as their squad in the store. */
export function isSyncedMultiplayerMatch(): boolean {
  const session = getMultiplayerSession();
  if (!session) return false;
  const s = useGameStore.getState();
  if (s.mpMatchMeta?.tournamentFixture?.localCpuMatch) return false;
  if (s.lastMatchContext === "tournament" && !s.mpMatchMeta?.tournamentFixture) return false;
  return true;
}

/** Online/local tournament fixture simmed on this device without shared MP sync. */
export function isLocalTournamentCpuMatch(): boolean {
  const s = useGameStore.getState();
  if (s.lastMatchContext !== "tournament") return false;
  if (getMultiplayerSession()) return !!s.mpMatchMeta?.tournamentFixture?.localCpuMatch;
  return true;
}

/** True when the local human controls the home side in match simulation. */
export function resolvePlayerIsHome(): boolean {
  return resolveMyMatchSide() === "home";
}

/** Local player's side in the current match (SP away fixtures + MP roles). */
export function resolveMyMatchSide(): "home" | "away" {
  const s = useGameStore.getState();

  if (!isSyncedMultiplayerMatch()) {
    if (s.matchState?.localPlayerSide) return s.matchState.localPlayerSide;
    return s.seasonPlayerIsHome ? "home" : "away";
  }

  const session = getMultiplayerSession();
  if (session?.matchSide) return session.matchSide;
  if (session?.role === "away") return "away";
  if (session?.role === "host") return "home";

  if (s.matchState?.localPlayerSide) return s.matchState.localPlayerSide;
  return s.seasonPlayerIsHome ? "home" : "away";
}
function setupForUniverseId(universeId: string | null | undefined): TeamSetup | null {
  const s = useGameStore.getState();
  if (!universeId) return null;

  if (universeId === s.selectedUniverseId) {
    return {
      universeId: s.selectedUniverseId,
      formationId: s.formationId as FormationId,
      lineup: s.lineup,
      bench: s.matchBench,
    };
  }

  if (universeId === s.opponentUniverseId) {
    return {
      universeId: s.opponentUniverseId,
      formationId: s.opponentFormationId as FormationId,
      lineup: s.opponentLineup,
      bench: s.opponentBench,
    };
  }

  return null;
}

/** Simulation home side — uses matchState orientation, not local player perspective. */
export function getHomeMatchSetup(): TeamSetup | null {
  const s = useGameStore.getState();
  const homeUni = s.matchState?.homeUniverseId ?? s.selectedUniverseId;
  return setupForUniverseId(homeUni);
}

/** Simulation away side — uses matchState orientation, not local player perspective. */
export function getAwayMatchSetup(): TeamSetup | null {
  const s = useGameStore.getState();
  const awayUni = s.matchState?.awayUniverseId ?? s.opponentUniverseId;
  return setupForUniverseId(awayUni);
}

function lineupForUniverse(universeId: string | null | undefined): LineupSlot[] {
  const setup = setupForUniverseId(universeId);
  return setup?.lineup ?? [];
}

/** Local human XI and opponent XI (MP away uses opponentLineup as "mine"). */
export function getMyAndOpponentLineups(): {
  myLineup: LineupSlot[];
  oppLineup: LineupSlot[];
} {
  const s = useGameStore.getState();

  if (!isSyncedMultiplayerMatch()) {
    return { myLineup: s.lineup, oppLineup: s.opponentLineup };
  }

  const playerIsHome = resolveMyMatchSide() === "home";
  return {
    myLineup: playerIsHome ? s.lineup : s.opponentLineup,
    oppLineup: playerIsHome ? s.opponentLineup : s.lineup,
  };
}

/** Player names from the local human's squad (XI + bench) for the active match. */
export function getMySquadPlayerNames(): string[] {
  const s = useGameStore.getState();
  const { myLineup } = getMyAndOpponentLineups();
  const myBench = isSyncedMultiplayerMatch()
    ? resolveMyMatchSide() === "home"
      ? s.matchBench
      : s.opponentBench
    : s.matchBench;  return [
    ...myLineup.map((slot) => slot.playerName).filter((p): p is string => !!p),
    ...myBench.filter((p): p is string => !!p),
  ];
}

export function myUniverseIdForMatch(matchState: Pick<MatchState, "homeUniverseId" | "awayUniverseId">): string {
  if (!isSyncedMultiplayerMatch()) {
    return useGameStore.getState().selectedUniverseId ?? matchState.homeUniverseId;
  }
  return resolveMyMatchSide() === "home" ? matchState.homeUniverseId : matchState.awayUniverseId;
}
export function myPlayerStatsForMatch(
  matchState: Pick<MatchState, "homePlayerStats" | "awayPlayerStats">
): Record<string, { goals?: number; assists?: number }> {
  return resolveMyMatchSide() === "home" ? matchState.homePlayerStats : matchState.awayPlayerStats;
}

/** Home/away lineups as shown on the pitch (simulation home = left). */
export function getDisplayLineups(): {
  homeLineup: LineupSlot[];
  awayLineup: LineupSlot[];
} {
  const s = useGameStore.getState();
  const homeUni = s.matchState?.homeUniverseId ?? s.selectedUniverseId;
  const awayUni = s.matchState?.awayUniverseId ?? s.opponentUniverseId;
  return {
    homeLineup: lineupForUniverse(homeUni),
    awayLineup: lineupForUniverse(awayUni),
  };
}
