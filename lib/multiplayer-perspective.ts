import type { FormationId, LineupSlot } from "./types";
import { getUniverse } from "./squads";
import { getMultiplayerSession } from "./multiplayer-session";
import { useGameStore } from "@/store/game-store";

export type MatchSide = "home" | "away";

export function myMatchSide(): MatchSide | null {
  const session = getMultiplayerSession();
  if (!session) return null;
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
  const side = myMatchSide() ?? "home";
  if (!isMultiplayerMatch() && !s.selectedUniverseId) return null;

  const universeId =
    side === "home" ? s.selectedUniverseId : s.opponentUniverseId;
  if (!universeId) return null;

  const universe = getUniverse(universeId);
  if (!universe) return null;

  return {
    side,
    universeId,
    formationId: (side === "home" ? s.formationId : s.opponentFormationId) as FormationId,
    lineup: side === "home" ? s.lineup : s.opponentLineup,
    matchBench: side === "home" ? s.matchBench : s.opponentBench,
    accent: universe.accentColor,
    name: universe.name,
  };
}

export function updateMyTeamLineup(lineup: LineupSlot[]): void {
  const side = myMatchSide() ?? "home";
  if (side === "home") {
    useGameStore.setState({ lineup });
  } else {
    useGameStore.setState({ opponentLineup: lineup });
  }
}

/** Universe ids from the local player's perspective (works for MP away + offline). */
export function playerRevealUniverses(): { myUniId: string; oppUniId: string } {
  const s = useGameStore.getState();
  const session = getMultiplayerSession();
  const playerIsHome =
    session?.role === "away"
      ? false
      : session?.role === "host"
        ? true
        : s.seasonPlayerIsHome;

  const myUniId = playerIsHome
    ? s.selectedUniverseId ?? s.matchState?.homeUniverseId ?? ""
    : s.opponentUniverseId ?? s.matchState?.awayUniverseId ?? "";
  const oppUniId = playerIsHome
    ? s.opponentUniverseId ?? s.matchState?.awayUniverseId ?? ""
    : s.selectedUniverseId ?? s.matchState?.homeUniverseId ?? "";

  return { myUniId, oppUniId };
}
