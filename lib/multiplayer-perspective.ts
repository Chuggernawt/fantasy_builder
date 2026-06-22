import type { FormationId, LineupSlot } from "./types";
import { getUniverse } from "./squads";
import { getMultiplayerSession } from "./multiplayer-session";
import { useGameStore } from "@/store/game-store";
import { resolveMyMatchSide, resolvePlayerIsHome, isSyncedMultiplayerMatch } from "./player-side";

export type MatchSide = "home" | "away";

export function myMatchSide(): MatchSide | null {
  const session = getMultiplayerSession();
  if (!session || !isSyncedMultiplayerMatch()) {
    const s = useGameStore.getState();
    if (!s.matchState) return null;
    return resolveMyMatchSide();
  }
  if (session.matchSide) return session.matchSide;
  if (session.role === "spectator" || session.role === "player") return null;
  return session.role === "host" ? "home" : "away";
}
export function isMultiplayerMatch(): boolean {
  return !!getMultiplayerSession();
}

export interface MyTeamView {
  side: MatchSide;
  universeId: string;
  formationId: FormationId;
  lineup: LineupSlot[];
  matchBench: string[];
  accent: string;
  name: string;
}

export function getMyTeamView(): MyTeamView | null {
  const s = useGameStore.getState();
  const side = myMatchSide() ?? resolveMyMatchSide();
  if (!isSyncedMultiplayerMatch()) {
    if (!s.selectedUniverseId) return null;
    const universe = getUniverse(s.selectedUniverseId);
    if (!universe) return null;
    return {
      side,
      universeId: s.selectedUniverseId,
      formationId: s.formationId as FormationId,
      lineup: s.lineup,
      matchBench: s.matchBench,
      accent: universe.accentColor,
      name: universe.name,
    };
  }

  if (!s.selectedUniverseId) return null;

  const playerIsHome = resolvePlayerIsHome();
  const universeId = playerIsHome ? s.selectedUniverseId : s.opponentUniverseId;
  if (!universeId) return null;

  const universe = getUniverse(universeId);
  if (!universe) return null;

  return {
    side,
    universeId,
    formationId: (playerIsHome ? s.formationId : s.opponentFormationId) as FormationId,
    lineup: playerIsHome ? s.lineup : s.opponentLineup,
    matchBench: playerIsHome ? s.matchBench : s.opponentBench,
    accent: universe.accentColor,
    name: universe.name,
  };
}

export function updateMyTeamLineup(lineup: LineupSlot[]): void {
  if (!isSyncedMultiplayerMatch()) {
    useGameStore.setState({ lineup });
    return;
  }
  const playerIsHome = resolvePlayerIsHome();
  if (playerIsHome) {
    useGameStore.setState({ lineup });
  } else {
    useGameStore.setState({ opponentLineup: lineup });
  }
}

/** Universe ids from the local player's perspective (works for MP away + offline). */
export function playerRevealUniverses(): { myUniId: string; oppUniId: string } {
  const s = useGameStore.getState();
  if (!isSyncedMultiplayerMatch()) {
    return {
      myUniId: s.selectedUniverseId ?? s.matchState?.homeUniverseId ?? "",
      oppUniId: s.opponentUniverseId ?? s.matchState?.awayUniverseId ?? "",
    };
  }

  const playerIsHome = resolvePlayerIsHome();
  const myUniId = playerIsHome
    ? s.selectedUniverseId ?? s.matchState?.homeUniverseId ?? ""
    : s.opponentUniverseId ?? s.matchState?.awayUniverseId ?? "";
  const oppUniId = playerIsHome
    ? s.opponentUniverseId ?? s.matchState?.awayUniverseId ?? ""
    : s.selectedUniverseId ?? s.matchState?.homeUniverseId ?? "";

  return { myUniId, oppUniId };
}
