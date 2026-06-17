import { autoFillLineup, createInitialMatchState, processTick } from "../lib/simulation";
import type { TeamSetup } from "../lib/types";

const N = 300;
const homeId = "famous-retards";
const awayId = "futurama";

function playMatch() {
  const home: TeamSetup = {
    universeId: homeId,
    formationId: "4-4-2",
    lineup: autoFillLineup(homeId, "4-4-2"),
    bench: [],
  };
  const away: TeamSetup = {
    universeId: awayId,
    formationId: "4-3-3",
    lineup: autoFillLineup(awayId, "4-3-3"),
    bench: [],
  };
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
  return state.score;
}

let totalGoals = 0;
let homeWins = 0;
let awayWins = 0;
let draws = 0;
let blowouts = 0;
let totalShots = 0;

for (let i = 0; i < N; i++) {
  const home: TeamSetup = {
    universeId: homeId,
    formationId: "4-4-2",
    lineup: autoFillLineup(homeId, "4-4-2"),
    bench: [],
  };
  const away: TeamSetup = {
    universeId: awayId,
    formationId: "4-3-3",
    lineup: autoFillLineup(awayId, "4-3-3"),
    bench: [],
  };
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
  const s = state.score;
  totalShots += state.homeStats.shots + state.awayStats.shots;
  totalGoals += s.home + s.away;
  if (s.home > s.away) homeWins++;
  else if (s.away > s.home) awayWins++;
  else draws++;
  if (Math.abs(s.home - s.away) >= 4) blowouts++;
}

console.log(`Famous Retards vs Futurama (${N} sims)`);
console.log(`Home W-D-L: ${homeWins}-${draws}-${awayWins}`);
console.log(`Avg goals: ${(totalGoals / N).toFixed(2)}`);
console.log(`Avg shots: ${(totalShots / N).toFixed(2)}`);
console.log(`Blowouts (4+): ${((blowouts / N) * 100).toFixed(1)}%`);
