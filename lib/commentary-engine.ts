import { pickFlavourLine } from "./commentary-flavour";
import type { CommentaryKind, CommentarySession } from "./commentary-types";

const MEMORY_SIZE = 24;
/** Universe pool lines in generic commentary — kept low; specials handle character moments. */
const FLAVOUR_CHANCE = 0;
/** Rare dry aside on top of straight lines only (ambient/buildup). */
const WIT_CHANCE = 0.04;
const CONTEXT_EXTRA_CHANCE = 0.18;

function fill(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, v),
    template
  );
}

function pickFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rememberLine(session: CommentarySession, text: string): void {
  session.recentLines = [...session.recentLines.slice(-(MEMORY_SIZE - 1)), text];
}

function pickUnique(session: CommentarySession, candidates: string[]): string {
  const fresh = candidates.filter((c) => !session.recentLines.includes(c));
  const pool = fresh.length ? fresh : candidates;
  return pickFrom(pool);
}

function scorerGoals(session: CommentarySession, name: string): number {
  const h = session.homePlayerStats[name]?.goals ?? 0;
  const a = session.awayPlayerStats[name]?.goals ?? 0;
  return h + a;
}

function teamScore(session: CommentarySession, team: "home" | "away") {
  return team === "home" ? session.score.home : session.score.away;
}

function isLate(session: CommentarySession): boolean {
  return session.minute >= 78 || (session.half === 2 && session.minute >= 75);
}

function attackingTrail(session: CommentarySession): boolean {
  if (!session.attacking) return false;
  const us = teamScore(session, session.attacking);
  const them = teamScore(session, session.attacking === "home" ? "away" : "home");
  return us < them;
}

function momentumHot(session: CommentarySession): boolean {
  if (!session.attacking) return false;
  const m = session.attacking === "home" ? session.momentum : -session.momentum;
  return m >= 3;
}

const STRAIGHT: Record<CommentaryKind, string[]> = {
  goal: [
    "GOAL! {scorer} finds the net!",
    "GOAL! {scorer} buries it!",
    "GOAL! What a finish from {scorer}!",
    "GOAL! {scorer} scores — the crowd erupts!",
    "GOAL! {scorer} tucks it away!",
    "GOAL! Back of the net! {scorer} with the finish!",
    "GOAL! {scorer} makes no mistake!",
    "GOAL! Sensational strike by {scorer}!",
    "GOAL! {scorer} thumps it home!",
    "GOAL! Clinical from {scorer}!",
    "GOAL! {scorer} — take a bow!",
    "GOAL! Top bins! {scorer} with a screamer!",
    "GOAL! {scorer} slots it past the keeper!",
    "GOAL! They think it's all over... {scorer} scores!",
  ],
  save: [
    "{gk} denies {shooter}!",
    "Brilliant save from {gk} to stop {shooter}!",
    "{gk} palms it away from {shooter}!",
    "{gk} stands tall — {shooter} denied!",
    "{gk} with a sprawling save to keep out {shooter}!",
    "{shooter} thought they'd scored — {gk} says no!",
    "Strong hands from {gk} — {shooter} frustrated!",
  ],
  miss: [
    "{shooter} fires wide.",
    "{shooter} drags it past the post!",
    "{shooter} blazes over the bar!",
    "{shooter} can't keep it down — off target.",
    "{shooter} snatches at it — wayward!",
    "{shooter} skews it into the stands!",
  ],
  foul: [
    "Foul on {attacker} by {defender}! Free kick.",
    "{defender} clips {attacker} — referee blows for a foul.",
    "Late challenge from {defender} on {attacker}. Free kick.",
    "{attacker} brought down by {defender}!",
    "The ref points to the spot... no, just a free kick. {defender} fouled {attacker}.",
  ],
  freekick: [
    "Free kick for {team}. {taker} over the ball...",
    "{taker} lines up the free kick for {team}...",
    "Dangerous position — {taker} will take this for {team}.",
    "Wall set. {taker} ready for {team}.",
  ],
  turnover: [
    "{player} wins the ball in the middle.",
    "{player} intercepts and turns over possession.",
    "{player} breaks it up in midfield.",
    "{player} nicks the ball — change of possession.",
    "{player} steps in to win it back.",
    "Loose ball — {player} recovers for the defence.",
  ],
  tackle: [
    "{defender} shuts down {attacker}.",
    "Crunching tackle from {defender} on {attacker}!",
    "{defender} times it perfectly against {attacker}.",
    "{defender} wins the duel with {attacker}.",
    "Superb defending — {defender} stops {attacker} dead.",
    "{defender} slides in — {attacker} dispossessed!",
  ],
  chance: [
    "{shooter} goes close for {team}!",
    "{shooter} can't quite convert for {team}.",
    "Half a yard away for {shooter}!",
    "{shooter} flashes a shot — just wide for {team}.",
    "So close for {team} — {shooter} agonisingly off target.",
  ],
  cross: [
    "{crosser} whips in a cross — {target} attacks it!",
    "{crosser} floats it to the back post for {target}!",
    "{crosser} drills a low cross — {target} is in there!",
    "Delivery from {crosser} — {target} meets it!",
  ],
  clearance: [
    "{defender} hacks it clear!",
    "Desperate clearance from {defender}!",
    "{defender} launches it into row Z.",
    "{defender} gets a vital block on the line!",
  ],
  pressure: [
    "{team} piling on the pressure...",
    "Wave after wave from {team}.",
    "{team} camped in the final third.",
    "Relentless from {team} — can they break through?",
    "{team} probing for an opening...",
  ],
  longball: [
    "{player} launches it long for {target}!",
    "Route one from {player} — {target} chases it down!",
    "{player} goes direct — {target} in pursuit!",
  ],
  header: [
    "{player} meets it with his head — just wide!",
    "{player} gets up highest — header off target!",
    "{player} glances a header goalwards — close!",
  ],
  corner: [
    "Corner kick to {team}.",
    "Behind for a corner — {team} send men forward.",
    "Corner for {team} — big lads up from the back.",
  ],
  offside: [
    "Flag up! {player} offside.",
    "Offside against {player} — attack cut short.",
    "{player} inches offside — tight call!",
  ],
  yellowcard: [
    "Yellow card for {player}.",
    "{player} goes into the book.",
    "Referee cautions {player}.",
    "{player} sees yellow — needs to be careful now.",
  ],
  redcard: [
    "RED CARD! {player} is sent off!",
    "{player} sees red — down to ten!",
    "Dismissal for {player}!",
    "The referee sends {player} off!",
  ],
  stamina: [
    "{player} is gasping for air...",
    "{player} looks leggy out there.",
    "{player} bent double — needs a breather.",
    "The pace is catching up with {player}.",
    "{player} cramping up?",
  ],
  buildup: [
    "{player} sprays a pass wide.",
    "Patient build-up through {player}.",
    "{player} switches play.",
    "{player} carries it forward.",
    "{player} threads a neat ball through.",
    "{player} holds off a challenge and keeps it.",
  ],
  ambient: [
    "Midfield battle continues — {team} looking to assert themselves.",
    "Tempo rising — {team} in control for now.",
    "Crowd urging {team} forward.",
    "Scrappy phase — neither side giving an inch.",
    "{team} recycle possession at the back.",
    "Stalemate in the middle — {team} reset.",
    "Physical contest — {team} win a throw-in.",
    "{team} slow it down, looking for a gap.",
    "End to end stuff — {team} on the ball.",
    "Tight affair — {team} probing.",
    "{team} knock it around at the back — no rush.",
    "Manager barking orders — {team} need more width.",
    "{team} win a cheap free kick in midfield.",
    "Nervy moments — {team} keep their composure.",
    "{team} fans in full voice now.",
    "Neither keeper troubled for a while.",
    "{team} drop deeper, inviting pressure.",
    "Quick drink break as the ball goes out — {team} to restart.",
    "Tactical chess — {team} shift shape.",
    "{team} hunting the opener still.",
  ],
  kickoff: ["KICK OFF — {home} vs {away}!"],
  halftime: ["HALF TIME — {homeScore} - {awayScore}"],
  fulltime: ["FULL TIME — {homeScore} - {awayScore}"],
};

/** Occasional dry aside — never mixed into the main pool. */
const WIT: Partial<Record<CommentaryKind, string[]>> = {
  ambient: ["Quiet spell. {team} patient.", "Not much happening. {team} keep the ball."],
  buildup: ["{player} takes an extra touch. No rush."],
};

function contextExtras(session: CommentarySession, kind: CommentaryKind, vars: Record<string, string>): string[] {
  const extras: string[] = [];
  const scorer = vars.scorer ?? vars.shooter ?? vars.player;

  if (kind === "goal" && scorer) {
    const prior = Math.max(0, scorerGoals(session, scorer) - 1);
    if (prior >= 2) {
      extras.push(`GOAL! HAT-TRICK for {scorer}!`);
      extras.push(`GOAL! {scorer} completes the hat-trick!`);
    } else if (prior === 1) {
      extras.push(`GOAL! Brace for {scorer}!`);
      extras.push(`GOAL! {scorer} scores again!`);
    }
  }

  if (isLate(session)) {
    if (kind === "goal") {
      extras.push(`GOAL! Late drama! {scorer} scores!`);
      extras.push(`GOAL! {scorer} in the dying minutes!`);
    }
    if (kind === "chance" && attackingTrail(session)) {
      extras.push("{shooter} goes close — time running out for {team}!");
    }
  }

  if (attackingTrail(session) && kind === "goal") {
    extras.push("GOAL! {scorer} pulls one back for {team}!");
  }
  if (attackingTrail(session) && kind === "pressure") {
    extras.push("{team} pushing hard for an equaliser...");
  }

  if (momentumHot(session) && kind === "pressure") {
    extras.push("{team} relentless — can they break through?");
    extras.push("Wave after wave from {team}.");
  }

  return extras.map((t) => fill(t, vars));
}

function seasonExtras(session: CommentarySession, kind: CommentaryKind, vars: Record<string, string>): string[] {
  const meta = session.seasonMeta;
  if (!meta?.isFinale) return [];

  const extras: string[] = [];
  const user = meta.userTeamName;

  if (kind === "kickoff") {
    extras.push(`FINAL MATCHDAY — {home} vs {away}.`);
    if (meta.titleRace) {
      extras.push(`TITLE DECIDER — {home} vs {away}.`);
    }
  }

  if (kind === "halftime" && meta.titleRace) {
    extras.push(`Half time in the title race — {homeScore}-{awayScore}.`);
  }

  if (kind === "fulltime") {
    extras.push(`FULL TIME on the final matchday — {homeScore}-{awayScore}.`);
    if (meta.userLeading && meta.titleRace) {
      extras.push(`Full time — {homeScore}-{awayScore}. {user} could be champions.`);
    }
  }

  if (kind === "goal" && meta.titleRace) {
    extras.push(`GOAL! {scorer} — huge on the final day!`);
    extras.push(`GOAL! {scorer}! The title race shifts!`);
  }

  if (kind === "ambient" && meta.titleRace) {
    extras.push(`Final-day nerves — {team} under pressure.`);
  }

  return extras.map((t) => fill(t, { ...vars, user }));
}

export function pickCommentary(
  session: CommentarySession,
  kind: CommentaryKind,
  vars: Record<string, string>,
  playerName?: string
): string {
  if (playerName && FLAVOUR_CHANCE > 0 && Math.random() < FLAVOUR_CHANCE) {
    const flavour = pickFlavourLine(kind, playerName, vars);
    if (flavour) {
      rememberLine(session, flavour);
      return flavour;
    }
  }

  const straight = (STRAIGHT[kind] ?? []).map((t) => fill(t, vars));
  let candidates = straight;

  const wit = WIT[kind];
  if (wit?.length && Math.random() < WIT_CHANCE) {
    candidates = wit.map((t) => fill(t, vars));
  }

  const season = seasonExtras(session, kind, vars).filter((l) => !session.recentLines.includes(l));
  const finaleKinds: CommentaryKind[] = ["kickoff", "halftime", "fulltime"];
  if (season.length && finaleKinds.includes(kind)) {
    candidates = [...season, ...straight];
  } else if (season.length && Math.random() < 0.25) {
    candidates = [...season, ...straight];
  }

  const contextual = contextExtras(session, kind, vars).filter((l) => !session.recentLines.includes(l));
  if (contextual.length && Math.random() < CONTEXT_EXTRA_CHANCE) {
    candidates = [pickFrom(contextual), ...straight];
  }

  const text = pickUnique(session, candidates);
  rememberLine(session, text);
  return text;
}

export function createCommentarySession(
  state: {
    score: CommentarySession["score"];
    recentCommentaryLines?: string[];
    homePlayerStats: Record<string, import("./types").PlayerMatchStats>;
    awayPlayerStats: Record<string, import("./types").PlayerMatchStats>;
    seasonMeta?: CommentarySession["seasonMeta"];
  },
  minute: number,
  half: 1 | 2,
  momentum: number,
  homeName: string,
  awayName: string
): CommentarySession {
  return {
    recentLines: [...(state.recentCommentaryLines ?? [])],
    score: { ...state.score },
    minute,
    half,
    momentum,
    homeName,
    awayName,
    homePlayerStats: state.homePlayerStats,
    awayPlayerStats: state.awayPlayerStats,
    seasonMeta: state.seasonMeta,
  };
}

export function syncCommentaryMemory(session: CommentarySession): string[] {
  return session.recentLines.slice(-MEMORY_SIZE);
}

export function maybeAmbientEvent(
  session: CommentarySession,
  team: "home" | "away",
  teamName: string,
  probability = 0.22
): string | null {
  if (Math.random() > probability) return null;
  session.attacking = team;
  return pickCommentary(session, "ambient", { team: teamName });
}
