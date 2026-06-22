import specialData from "@/data/special-events.json";
import type { CommentaryEvent } from "./types";
import type { SpecialEffect } from "./special-effects";
import { applySpecialEffect } from "./special-effects";
import type { AttackContext, SpecialCastEntry } from "./special-events-types";
import { commentaryId } from "./simulation-utils";
import { isPlayerSentOff } from "./player-match-stats";

export interface SpecialLine {
  text: string;
  effect: SpecialEffect;
}

interface PoolDef {
  members: string[];
  lines: SpecialLine[];
}

interface SpecialDataFile {
  pools: Record<string, PoolDef>;
  players: Record<string, SpecialLine[]>;
}

const data = specialData as SpecialDataFile;

/**
 * One roll per attack phase (~40 per match). Expected specials ≈ 40 × 0.152 ≈ 6 (~3/team).
 * Poisson-style variance — not a hard cap.
 */
export const SPECIAL_PHASE_PROBABILITY = 0.152;

/** Soft cooldown so the same player rarely headlines twice within this span. */
export const SPECIAL_PLAYER_COOLDOWN_MINUTES = 7;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function collectLines(playerName: string): SpecialLine[] {
  const lines: SpecialLine[] = [...(data.players[playerName] ?? [])];
  for (const pool of Object.values(data.pools)) {
    if (!pool.members.includes(playerName)) continue;
    for (const line of pool.lines) {
      lines.push({
        text: line.text.replaceAll("{name}", playerName),
        effect: line.effect as SpecialEffect,
      });
    }
  }
  return lines;
}

export function addSpecialCast(
  ctx: AttackContext,
  name: string,
  team: "home" | "away",
  weight: number
): void {
  if (!name || name === "Unknown" || weight <= 0) return;
  ctx.specialCast.push({ name, team, weight });
}

function pickWeightedCast(cast: SpecialCastEntry[]): SpecialCastEntry | null {
  if (!cast.length) return null;
  const total = cast.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * total;
  for (const entry of cast) {
    r -= entry.weight;
    if (r <= 0) return entry;
  }
  return cast[cast.length - 1];
}

function castHasLines(name: string): boolean {
  if (data.players[name]?.length) return true;
  for (const pool of Object.values(data.pools)) {
    if (pool.members.includes(name)) return true;
  }
  return false;
}

function leadWithPlayerName(playerName: string, text: string): string {
  const trimmed = text.trimStart();
  if (trimmed.toLowerCase().startsWith(playerName.toLowerCase())) {
    return text;
  }
  return `${playerName} — ${text}`;
}

/** Roll at most one special headline for this attack phase; regular commentary unchanged. */
export function tryPhaseSpecial(
  ctx: AttackContext,
  events: CommentaryEvent[]
): void {
  const cast = ctx.specialCast.filter((c) => {
    if (!castHasLines(c.name)) return false;
    const stats = c.team === "home" ? ctx.homePlayerStats : ctx.awayPlayerStats;
    return !isPlayerSentOff(stats, c.name);
  });
  if (!cast.length) return;
  if (Math.random() >= SPECIAL_PHASE_PROBABILITY) return;

  const picked = pickWeightedCast(cast);
  if (!picked) return;

  const lastAt = ctx.specialCooldown[picked.name];
  if (
    lastAt != null &&
    ctx.currentMinute - lastAt < SPECIAL_PLAYER_COOLDOWN_MINUTES
  ) {
    return;
  }

  const pool = collectLines(picked.name);
  if (!pool.length) return;

  const line = pick(pool);
  ctx.specialCooldown[picked.name] = ctx.currentMinute;

  applySpecialEffect(ctx, line.effect, picked.team, picked.name, events, ctx.half);

  events.push({
    id: commentaryId(),
    minute: 0,
    half: ctx.half,
    type: "special",
    text: leadWithPlayerName(picked.name, line.text),
    team: picked.team,
    playerName: picked.name,
  });
}

export function flushPhaseSpecial(ctx: AttackContext, events: CommentaryEvent[]): void {
  tryPhaseSpecial(ctx, events);
  ctx.specialCast = [];
}

export function createAttackContextExtras(): Pick<
  AttackContext,
  | "attackBonus"
  | "attackPenalty"
  | "forceChance"
  | "gkMoment"
  | "forceTurnover"
  | "specialCast"
  | "phaseMentions"
  | "playmaker"
  | "crosser"
  | "freekickTaker"
  | "setPieceTrigger"
> {
  return {
    attackBonus: null,
    attackPenalty: null,
    forceChance: null,
    gkMoment: null,
    forceTurnover: false,
    specialCast: [],
    phaseMentions: [],
    playmaker: null,
    crosser: null,
    freekickTaker: null,
    setPieceTrigger: null,
  };
}
