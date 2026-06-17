import type { Channel } from "./formation-zones";
import type { CommentaryEvent } from "./types";
import type { CommentaryKind, CommentarySession } from "./commentary-types";
import {
  createCommentarySession,
  maybeAmbientEvent,
  pickCommentary,
} from "./commentary-engine";

export type { CommentaryKind, CommentarySession, SeasonMatchMeta } from "./commentary-types";
export { createCommentarySession, pickCommentary, syncCommentaryMemory } from "./commentary-engine";

/** Legacy fallback when no session is available (e.g. tests). */
function ephemeralSay(kind: CommentaryKind, vars: Record<string, string>, player?: string): string {
  const session = createCommentarySession(
    { score: { home: 0, away: 0 }, homePlayerStats: {}, awayPlayerStats: {} },
    45,
    1,
    0,
    "Home",
    "Away"
  );
  return pickCommentary(session, kind, vars, player);
}

export function say(
  session: CommentarySession,
  kind: CommentaryKind,
  vars: Record<string, string>,
  playerName?: string,
  attacking?: "home" | "away"
): string {
  if (attacking) session.attacking = attacking;
  return pickCommentary(session, kind, vars, playerName);
}

export function goalText(scorer: string): string {
  return ephemeralSay("goal", { scorer }, scorer);
}

export function saveText(gk: string, shooter: string): string {
  return ephemeralSay("save", { gk, shooter }, gk);
}

export function missText(shooter: string): string {
  return ephemeralSay("miss", { shooter }, shooter);
}

export function foulText(attacker: string, defender: string): string {
  return ephemeralSay("foul", { attacker, defender }, defender);
}

export function freeKickText(team: string, taker: string): string {
  return ephemeralSay("freekick", { team, taker }, taker);
}

export function turnoverText(player: string): string {
  return ephemeralSay("turnover", { player }, player);
}

export function tackleText(defender: string, attacker: string): string {
  return ephemeralSay("tackle", { defender, attacker }, defender);
}

export function chanceText(shooter: string, team: string): string {
  return ephemeralSay("chance", { shooter, team }, shooter);
}

export function crossText(crosser: string, target: string): string {
  return ephemeralSay("cross", { crosser, target }, crosser);
}

export function clearanceText(defender: string): string {
  return ephemeralSay("clearance", { defender }, defender);
}

export function pressureText(team: string): string {
  return ephemeralSay("pressure", { team });
}

export function longBallText(player: string, target: string): string {
  return ephemeralSay("longball", { player, target }, player);
}

export function headerText(player: string, scored: boolean): string {
  if (scored) return `${player} powers a header into the net!`;
  return ephemeralSay("header", { player }, player);
}

export function cornerText(team: string): string {
  return ephemeralSay("corner", { team });
}

export function offsideText(player: string): string {
  return ephemeralSay("offside", { player }, player);
}

export function yellowCardText(player: string): string {
  return ephemeralSay("yellowcard", { player }, player);
}

export function redCardText(player: string): string {
  return ephemeralSay("redcard", { player }, player);
}

export function staminaText(player: string): string {
  return ephemeralSay("stamina", { player }, player);
}

export function buildUpText(player: string): string {
  return ephemeralSay("buildup", { player }, player);
}

export function ambientText(team: string): string {
  return ephemeralSay("ambient", { team });
}

export function maybeAmbient(
  session: CommentarySession,
  half: 1 | 2,
  team: "home" | "away",
  teamName: string,
  id: () => string,
  probability = 0.22
): CommentaryEvent | null {
  const text = maybeAmbientEvent(session, team, teamName, probability);
  if (!text) return null;
  return {
    id: id(),
    minute: 0,
    half,
    type: "info",
    text,
    team,
  };
}

export function channelLabel(channel: Channel): string {
  if (channel === "left") return "down the left";
  if (channel === "right") return "down the right";
  return "through the middle";
}
