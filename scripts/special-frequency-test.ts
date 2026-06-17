/**
 * Simulates matches and reports special-event frequency.
 * Run: npx tsx scripts/special-frequency-test.ts
 */
import squads from "../data/squads.json";
import { autoFillLineup, createInitialMatchState, processTick } from "../lib/simulation";
import type { TeamSetup } from "../lib/types";

const universes = squads.universes;
const MATCHES = 200;

function randomSetup(): [TeamSetup, TeamSetup] {
  const pick = () => {
    const u = universes[Math.floor(Math.random() * universes.length)];
    return {
      universeId: u.id,
      formationId: "4-3-3" as const,
      lineup: autoFillLineup(u.id, "4-3-3"),
      bench: [],
    };
  };
  return [pick(), pick()];
}

let totalSpecials = 0;
let totalHome = 0;
let totalAway = 0;

for (let m = 0; m < MATCHES; m++) {
  const [home, away] = randomSetup();
  let state = createInitialMatchState(home, away);
  state.status = "running";

  while (state.status !== "finished") {
    if (state.status === "halftime") {
      state = { ...state, status: "running", half: 2, tick: 0 };
      continue;
    }
    const { state: next } = processTick(state, home, away);
    state = next;
  }

  const specials = state.commentary.filter((e) => e.type === "special");
  totalSpecials += specials.length;
  totalHome += specials.filter((e) => e.team === "home").length;
  totalAway += specials.filter((e) => e.team === "away").length;
}

const avg = totalSpecials / MATCHES;
const avgHome = totalHome / MATCHES;
const avgAway = totalAway / MATCHES;

console.log(`Matches simulated: ${MATCHES}`);
console.log(`Avg specials/match: ${avg.toFixed(2)} (target ~6)`);
console.log(`Avg home: ${avgHome.toFixed(2)} | away: ${avgAway.toFixed(2)} (target ~3 each)`);
console.log(`Total specials: ${totalSpecials}`);
