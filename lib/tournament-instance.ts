import type { FormationId, LineupSlot } from "./types";
import type { CpuPreferredXI, PersistedPlayerInjury } from "./injuries";
import {
  applyPersistedInjury,
  filterLineupForAvailability,
  injuryKey,
  isPlayerInjuredOut,
  tickInjuries,
} from "./injuries";
import { getUniverse } from "./squads";
import { autoFillLineup } from "./simulation";
import { weightedPick, pickRandomBench } from "./lineup";

export interface TournamentInstanceState {
  instanceKey: string;
  injuries: Record<string, PersistedPlayerInjury>;
  playerForm: Record<string, number>;
  cpuLineups: Record<string, CpuPreferredXI>;
  squadStamina: Record<string, number>;
}

export function emptyTournamentInstance(instanceKey: string): TournamentInstanceState {
  return {
    instanceKey,
    injuries: {},
    playerForm: {},
    cpuLineups: {},
    squadStamina: {},
  };
}

export function newTournamentInstanceKey(): string {
  return `tour-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isPlayerInjuredOutForTournament(
  state: TournamentInstanceState,
  playerName: string
): boolean {
  for (const row of Object.values(state.injuries)) {
    if (row.playerName === playerName && row.gamesOut > 0) return true;
  }
  return false;
}

export function tickTournamentInjuries(state: TournamentInstanceState): TournamentInstanceState {
  return { ...state, injuries: tickInjuries(state.injuries) };
}

export function applyInjuriesToTournament(
  state: TournamentInstanceState,
  entries: PersistedPlayerInjury[]
): TournamentInstanceState {
  let injuries = state.injuries;
  for (const e of entries) {
    injuries = applyPersistedInjury(injuries, e);
  }
  return { ...state, injuries };
}

export function resolveTournamentCpuLineup(
  state: TournamentInstanceState,
  opponentUniverseId: string,
  unavailable: Set<string> = new Set()
): { state: TournamentInstanceState; formationId: FormationId; lineup: LineupSlot[]; bench: string[] } {
  let next = state;
  let preferred = next.cpuLineups[opponentUniverseId];
  if (!preferred) {
    const formationId: FormationId = "4-3-3";
    const lineup = autoFillLineup(opponentUniverseId, formationId);
    const bench = pickRandomBench(opponentUniverseId, lineup);
    preferred = { formationId, lineup, bench };
    next = {
      ...next,
      cpuLineups: { ...next.cpuLineups, [opponentUniverseId]: preferred },
    };
  }

  const uni = getUniverse(opponentUniverseId);
  const players = uni?.players ?? [];
  const onPitch = new Set(
    preferred.lineup.map((s) => s.playerName).filter(Boolean) as string[]
  );
  preferred.bench.forEach((n) => onPitch.add(n));

  const fillFromPool = (slot: LineupSlot): string | null => {
    const pool = players.filter(
      (p) => !unavailable.has(p.name) && !onPitch.has(p.name)
    );
    if (!pool.length) return null;
    const chosen = weightedPick(pool, (p) => p.ovr);
    if (chosen) onPitch.add(chosen.name);
    return chosen?.name ?? null;
  };

  const { lineup, bench } = filterLineupForAvailability(preferred, unavailable, fillFromPool);
  return {
    state: next,
    formationId: preferred.formationId,
    lineup,
    bench,
  };
}

export function userTournamentInjuries(
  state: TournamentInstanceState,
  playerNames: string[]
): PersistedPlayerInjury[] {
  const names = new Set(playerNames);
  return Object.values(state.injuries)
    .filter((r) => names.has(r.playerName) && r.gamesOut > 0)
    .sort((a, b) => b.gamesOut - a.gamesOut);
}

export function tournamentInjuryKey(playerName: string, universeId: string): string {
  return injuryKey(universeId, playerName);
}
