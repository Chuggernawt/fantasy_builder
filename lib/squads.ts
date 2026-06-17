import squadsData from "@/data/squads.json";
import type { Player, SquadsData, Universe } from "./types";
import { getTeamOvr } from "./stats";

const data = squadsData as SquadsData;

export function getAllUniverses(): Universe[] {
  return [...data.universes].sort((a, b) => a.name.localeCompare(b.name));
}

export function getUniverse(id: string): Universe | undefined {
  return data.universes.find((u) => u.id === id);
}

export function getUniverseTeamOvr(universe: Universe): number {
  return getTeamOvr(universe.players);
}

export function getPlayer(universeId: string, playerName: string): Player | undefined {
  const universe = getUniverse(universeId);
  return universe?.players.find((p) => p.name === playerName);
}

export function sortPlayersByOvr(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.ovr - a.ovr);
}
