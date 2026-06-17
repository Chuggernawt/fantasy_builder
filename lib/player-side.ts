import { getMultiplayerSession } from "./multiplayer-session";
import { useGameStore } from "@/store/game-store";
import type { TeamSetup } from "./types";

/** True when the local human controls the home side in match simulation. */
export function resolvePlayerIsHome(): boolean {
  const session = getMultiplayerSession();
  if (session?.matchSide) return session.matchSide === "home";
  if (session?.role === "away") return false;
  if (session?.role === "host") return true;
  const s = useGameStore.getState();
  if (!s.seasonActiveFixtureId) return true;
  return s.seasonPlayerIsHome;
}

/** Local player's side in the current match (SP away fixtures + MP roles). */
export function resolveMyMatchSide(): "home" | "away" {
  const session = getMultiplayerSession();
  if (session?.matchSide) return session.matchSide;
  if (session?.role === "away") return "away";
  if (session?.role === "host") return "home";
  const s = useGameStore.getState();
  if (!s.seasonActiveFixtureId) return "home";
  return s.seasonPlayerIsHome ? "home" : "away";
}

export function getHomeMatchSetup(): TeamSetup | null {
  const s = useGameStore.getState();
  const playerIsHome = resolvePlayerIsHome();

  if (playerIsHome) {
    if (!s.selectedUniverseId) return null;
    return {
      universeId: s.selectedUniverseId,
      formationId: s.formationId,
      lineup: s.lineup,
      bench: s.matchBench,
    };
  }

  if (!s.opponentUniverseId) return null;
  return {
    universeId: s.opponentUniverseId,
    formationId: s.opponentFormationId,
    lineup: s.opponentLineup,
    bench: s.opponentBench,
  };
}

export function getAwayMatchSetup(): TeamSetup | null {
  const s = useGameStore.getState();
  const playerIsHome = resolvePlayerIsHome();

  if (playerIsHome) {
    if (!s.opponentUniverseId) return null;
    return {
      universeId: s.opponentUniverseId,
      formationId: s.opponentFormationId,
      lineup: s.opponentLineup,
      bench: s.opponentBench,
    };
  }

  if (!s.selectedUniverseId) return null;
  return {
    universeId: s.selectedUniverseId,
    formationId: s.formationId,
    lineup: s.lineup,
    bench: s.matchBench,
  };
}
