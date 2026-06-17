import specialData from "@/data/special-events.json";
import type { CommentaryKind } from "./commentary-types";

interface PoolDef {
  members: string[];
  lines: { text: string; effect: string }[];
}

const pools = (specialData as { pools: Record<string, PoolDef> }).pools;

/** Commentary-only lines keyed by pool — gameplay effects ignored here. */
const POOL_COMMENTARY: Record<string, Partial<Record<CommentaryKind, string[]>>> = {
  quidditch_seeker: {
    goal: [
      "GOAL! {scorer} dives through the posts — wrong sport, right result!",
      "GOAL! {scorer} catches the golden... no wait, that's a football. In anyway!",
      "GOAL! Seeker instincts — {scorer} finds the net!",
    ],
    save: [
      "{gk} plucks it out of the air like a Snitch — {shooter} baffled!",
      "{gk} makes a seeker-grade save on {shooter}!",
    ],
    miss: ["{shooter} swerves for a Snitch that isn't there — wide!", "{shooter} loses the Quaffle... I mean the ball."],
    buildup: ["{player} scans the sky mid-pass. Focus, {player}.", "{player} feints like a broom dodge."],
    ambient: ["Crowd half-expecting a Bludger — {team} keep their heads.", "{team} playing like it's the Quidditch World Cup."],
  },
  force_user: {
    goal: [
      "GOAL! The Force was strong with {scorer}!",
      "GOAL! {scorer} — the ball obeyed.",
      "GOAL! That's not a goal, that's destiny. {scorer} scores.",
    ],
    save: ["{gk} uses the Force — {shooter} denied!", "{gk} senses the shot before {shooter} takes it!"],
    miss: ["{shooter} misread the Force — well wide.", "The dark side tempted {shooter}. Off target."],
    buildup: ["{player} closes their eyes... then plays a perfect ball.", "{player} channels something. The pass lands."],
    ambient: ["You can feel the tension in the Force — {team} in control.", "{team} move like they share one mind."],
  },
  slasher_stalk: {
    goal: [
      "GOAL! {scorer} strikes from the shadows!",
      "GOAL! {scorer} — you should've looked behind you, keeper.",
      "GOAL! {scorer} with a horror-movie finish!",
    ],
    save: ["{gk} survives the scare — {shooter} kept out!", "{gk} won't die that easily. {shooter} denied!"],
    miss: ["{shooter} swings... and the ball sails wide. Classic.", "{shooter} telegraphed it. Everyone saw it coming."],
    tackle: ["{defender} appears from nowhere — {attacker} dispossessed!", "{defender} with a slasher-film tackle on {attacker}!"],
    ambient: ["An eerie silence — then {team} attack.", "Something's lurking. {team} on the ball."],
  },
  wwe_promo: {
    goal: [
      "GOAL! {scorer} — AND HIS NAME IS... IN THE NET!",
      "GOAL! {scorer} hits the finisher!",
      "GOAL! Bah gawd! {scorer} with the three count!",
    ],
    save: ["{gk} kicks out at two! {shooter} denied!", "{gk} no-sells {shooter}'s effort!"],
    foul: ["{defender} with a heel turn on {attacker}!", "Cheap shot from {defender} — the crowd boos!"],
    ambient: ["{team} cutting a promo with this possession.", "The crowd chants for {team}!"],
  },
  super_strength: {
    goal: ["GOAL! {scorer} absolutely launches it home!", "GOAL! {scorer} — physics optional!"],
    save: ["{gk} catches it like a tissue — {shooter} stunned!", "{gk} swats {shooter}'s shot aside!"],
    clearance: ["{defender} clears it into the next postcode!", "{defender} launches it. Row Z is nervous."],
    buildup: ["{player} carries three players and the ball.", "{player} shrugs off a challenge. Effortless."],
  },
  mad_scientist: {
    goal: ["GOAL! {scorer}'s experiment succeeds!", "GOAL! Eureka! {scorer} has cracked it!"],
    miss: ["{shooter}'s hypothesis was wrong — wide.", "{shooter} miscalculated the angle. Bad science."],
    buildup: ["{player} plots something diabolical in midfield.", "{player} threads a pass only a madman would try."],
    ambient: ["{team} conducting experiments in the final third.", "Unorthodox from {team} — it might work."],
  },
  trickster: {
    goal: ["GOAL! {scorer} — was that even legal?", "GOAL! {scorer} tricks everyone, including the keeper!"],
    miss: ["{shooter} tried to be clever. Too clever.", "{shooter} fools nobody but themselves."],
    buildup: ["{player} with a nutmeg's worth of audacity.", "{player} sells a dummy. The crowd bought it."],
    turnover: ["{player} pickpockets the ball — classic trickster!", "{player} steals it with a grin."],
  },
  tv_antihero: {
    goal: ["GOAL! {scorer} — morally questionable, technically brilliant.", "GOAL! {scorer} does the wrong thing beautifully."],
    foul: ["{defender} crosses a line. Par for the course.", "{defender} fouls {attacker}. Shocking absolutely no one."],
    ambient: ["{team} doing it the hard way. As usual.", "Nobody likes {team} right now. They're winning anyway."],
  },
};

const playerToPools = new Map<string, string[]>();

for (const [poolId, pool] of Object.entries(pools)) {
  for (const member of pool.members) {
    const existing = playerToPools.get(member) ?? [];
    existing.push(poolId);
    playerToPools.set(member, existing);
  }
}

export function getPlayerPoolIds(playerName: string): string[] {
  return playerToPools.get(playerName) ?? [];
}

export function pickFlavourLine(
  kind: CommentaryKind,
  playerName: string,
  vars: Record<string, string>
): string | null {
  const poolIds = getPlayerPoolIds(playerName);
  if (!poolIds.length) return null;

  const candidates: string[] = [];
  for (const poolId of poolIds) {
    const lines = POOL_COMMENTARY[poolId]?.[kind];
    if (lines) candidates.push(...lines);
  }
  if (!candidates.length) return null;

  const template = candidates[Math.floor(Math.random() * candidates.length)];
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, v),
    template
  );
}
