import {
  autoFillLineup,
  createInitialMatchState,
  processTick,
} from "../lib/simulation";
import { getUniverse } from "../lib/squads";
import { TICKS_PER_HALF } from "../lib/simulation-utils";
import type { LineupSlot, Role } from "../lib/types";

const home = {
  universeId: "futurama",
  formationId: "4-3-3" as const,
  lineup: autoFillLineup("futurama", "4-3-3"),
  bench: [] as string[],
};
const away = {
  universeId: "lotr",
  formationId: "4-4-2" as const,
  lineup: autoFillLineup("lotr", "4-4-2"),
  bench: [] as string[],
};

let state = createInitialMatchState(home, away);
for (let i = 0; i < TICKS_PER_HALF * 2 + 2; i++) {
  const r = processTick(state, home, away);
  state = r.state;
  if (state.status === "halftime") {
    state = { ...state, status: "running", half: 2, tick: 0 };
  }
  if (state.status === "finished") break;
}

function report(
  label: string,
  stamina: Record<string, number>,
  lineup: LineupSlot[],
  universeId: string
) {
  const u = getUniverse(universeId)!;
  const byRole: Partial<Record<Role, number[]>> = {};
  for (const slot of lineup) {
    if (!slot.playerName) continue;
    const bucket = byRole[slot.role] ?? [];
    bucket.push(stamina[slot.playerName] ?? 100);
    byRole[slot.role] = bucket;
  }
  const avg = Object.fromEntries(
    Object.entries(byRole).map(([r, vals]) => [
      r,
      Math.round(vals!.reduce((a, b) => a + b, 0) / vals!.length),
    ])
  );
  console.log(`${label} avg STA by role:`, avg);
  const gk = lineup.find((s) => s.role === "GK")?.playerName;
  if (gk) console.log(`  GK ${gk}: ${Math.round(stamina[gk] ?? 100)}%`);
}

report("Home (Futurama)", state.homeStamina, home.lineup, "futurama");
report("Away (LOTR)", state.awayStamina, away.lineup, "lotr");
