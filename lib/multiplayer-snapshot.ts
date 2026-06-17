import type { MultiplayerSnapshot } from "./multiplayer-types";
import { defaultMpMatchMeta } from "./multiplayer-match-flow";
import { useGameStore } from "@/store/game-store";
import type { FormationId, LineupSlot, MatchState } from "./types";

export function createSnapshotFromStore(): MultiplayerSnapshot {
  const s = useGameStore.getState();
  return {
    selectedUniverseId: s.selectedUniverseId,
    formationId: s.formationId,
    lineup: s.lineup,
    matchBench: s.matchBench,
    opponentUniverseId: s.opponentUniverseId,
    opponentFormationId: s.opponentFormationId,
    opponentLineup: s.opponentLineup,
    opponentBench: s.opponentBench,
    matchState: s.matchState,
    mp: s.mpMatchMeta ?? defaultMpMatchMeta(),
    updatedAt: new Date().toISOString(),
  };
}

export function applySnapshotToStore(snapshot: MultiplayerSnapshot): void {
  const prev = useGameStore.getState();
  const keepLocalReveal =
    prev.matchState?.status === "finished" &&
    (prev.pendingReveal !== null || prev.revealHighlights !== null);

  useGameStore.setState({
    selectedUniverseId: snapshot.selectedUniverseId,
    formationId: snapshot.formationId as FormationId,
    lineup: snapshot.lineup as LineupSlot[],
    matchBench: snapshot.matchBench,
    opponentUniverseId: snapshot.opponentUniverseId,
    opponentFormationId: snapshot.opponentFormationId as FormationId,
    opponentLineup: snapshot.opponentLineup as LineupSlot[],
    opponentBench: snapshot.opponentBench,
    matchState: snapshot.matchState as MatchState | null,
    mpMatchMeta: snapshot.mp ?? defaultMpMatchMeta(),
    ...(keepLocalReveal
      ? {
          pendingReveal: prev.pendingReveal,
          revealHighlights: prev.revealHighlights,
          revealedStats: prev.revealedStats,
        }
      : {}),
  });

  if (
    snapshot.matchState?.status === "finished" &&
    prev.matchState?.status !== "finished" &&
    !keepLocalReveal
  ) {
    useGameStore.getState().processMatchFinishReveal();
  }
}