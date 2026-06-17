import { defaultMpMatchMeta } from "./multiplayer-match-flow";
import { DEFAULT_FORMATION } from "./formations";
import {
  countAssigned,
  emptyLineupForFormation,
  isMatchReady,
} from "./lineup";
import type { MultiplayerSnapshot, PlayerLobbyState } from "./multiplayer-types";
import { buildMatchFormMap } from "./match-finalize";
import { createInitialMatchState } from "./simulation";
import type { FormationId, LineupSlot } from "./types";

export function createEmptyLobby(): PlayerLobbyState {
  return {
    universeId: null,
    formationId: DEFAULT_FORMATION,
    lineup: emptyLineupForFormation(DEFAULT_FORMATION),
    matchBench: [],
    ready: false,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeLobby(raw: PlayerLobbyState | null | undefined): PlayerLobbyState {
  if (!raw) return createEmptyLobby();
  const formationId = (raw.formationId as FormationId) || DEFAULT_FORMATION;
  return {
    universeId: raw.universeId ?? null,
    formationId,
    lineup: raw.lineup?.length ? raw.lineup : emptyLineupForFormation(formationId),
    matchBench: raw.matchBench ?? [],
    ready: !!raw.ready,
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

export function lobbyTeamReady(lobby: PlayerLobbyState): boolean {
  if (!lobby.universeId) return false;
  return isMatchReady(lobby.lineup as LineupSlot[], lobby.matchBench);
}

export function validateLobbyPair(
  host: PlayerLobbyState,
  away: PlayerLobbyState
): { ok: true } | { ok: false; error: string } {
  if (!lobbyTeamReady(host) || !lobbyTeamReady(away)) {
    return { ok: false, error: "Both players need a full XI and 5 subs." };
  }
  if (!host.ready || !away.ready) {
    return { ok: false, error: "Both players must be ready." };
  }
  if (host.universeId === away.universeId) {
    return { ok: false, error: "Each player must choose a different universe." };
  }
  return { ok: true };
}

export function buildMatchSnapshotFromLobbies(
  host: PlayerLobbyState,
  away: PlayerLobbyState,
  storeForm?: Record<string, Record<string, number>>
): MultiplayerSnapshot {
  const homeSetup = {
    universeId: host.universeId!,
    formationId: host.formationId as FormationId,
    lineup: host.lineup as LineupSlot[],
    bench: host.matchBench,
  };
  const awaySetup = {
    universeId: away.universeId!,
    formationId: away.formationId as FormationId,
    lineup: away.lineup as LineupSlot[],
    bench: away.matchBench,
  };
  const playerForm = buildMatchFormMap(
    homeSetup.universeId,
    awaySetup.universeId,
    homeSetup.lineup,
    awaySetup.lineup,
    storeForm ?? {}
  );
  const base = createInitialMatchState(homeSetup, awaySetup, { playerForm });
  return {
    selectedUniverseId: host.universeId,
    formationId: host.formationId,
    lineup: host.lineup,
    matchBench: host.matchBench,
    opponentUniverseId: away.universeId,
    opponentFormationId: away.formationId,
    opponentLineup: away.lineup,
    opponentBench: away.matchBench,
    matchState: {
      ...base,
    },
    mp: defaultMpMatchMeta(),
    updatedAt: new Date().toISOString(),
  };
}

export function lobbyProgressLabel(lobby: PlayerLobbyState): string {
  if (!lobby.universeId) return "Choose a universe";
  const xi = countAssigned(lobby.lineup as LineupSlot[]);
  if (xi < 11) return `XI ${xi}/11`;
  if (lobby.matchBench.length < 5) return `Subs ${lobby.matchBench.length}/5`;
  return lobby.ready ? "Ready" : "Team complete";
}
