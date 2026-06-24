import type { CommentaryEvent, MatchState } from "./types";
import type { AttackContext } from "./special-events-types";
import {
  type ActiveMatchInjury,
  type InjuryBodyPart,
  type InjuryIncident,
  type InjurySeverity,
  INJURY_UPGRADE_MINUTES,
  injuryCommentaryLine,
  injuryEffectivenessMultiplier,
  injuryRollChance,
  injuryUpgradeCommentary,
  pickBodyPartForIncident,
  pickInitialSeverity,
  upgradeSeverity,
} from "./injuries";
import { commentaryId } from "./simulation-utils";

function sideInjuries(state: MatchState, team: "home" | "away"): Record<string, ActiveMatchInjury> {
  return team === "home" ? (state.homeActiveInjuries ?? {}) : (state.awayActiveInjuries ?? {});
}

function setSideInjuries(
  state: MatchState,
  team: "home" | "away",
  map: Record<string, ActiveMatchInjury>
): MatchState {
  return team === "home"
    ? { ...state, homeActiveInjuries: map }
    : { ...state, awayActiveInjuries: map };
}

export function playerHasActiveInjury(state: MatchState, team: "home" | "away", name: string): boolean {
  return !!sideInjuries(state, team)[name];
}

export function getActiveInjury(
  state: MatchState,
  team: "home" | "away",
  name: string
): ActiveMatchInjury | undefined {
  return sideInjuries(state, team)[name];
}

function ctxSideInjuries(
  ctx: AttackContext,
  team: "home" | "away"
): Record<string, ActiveMatchInjury> {
  return team === "home" ? (ctx.homeActiveInjuries ?? {}) : (ctx.awayActiveInjuries ?? {});
}

function setCtxSideInjuries(
  ctx: AttackContext,
  team: "home" | "away",
  map: Record<string, ActiveMatchInjury>
): void {
  if (team === "home") ctx.homeActiveInjuries = map;
  else ctx.awayActiveInjuries = map;
}

export function syncInjuriesFromState(state: MatchState, ctx: AttackContext): void {
  ctx.persistentMatchMode = state.persistentMatchMode;
  ctx.homeActiveInjuries = { ...(state.homeActiveInjuries ?? {}) };
  ctx.awayActiveInjuries = { ...(state.awayActiveInjuries ?? {}) };
}

export function syncInjuriesToState(state: MatchState, ctx: AttackContext): MatchState {
  return {
    ...state,
    homeActiveInjuries: { ...(ctx.homeActiveInjuries ?? {}) },
    awayActiveInjuries: { ...(ctx.awayActiveInjuries ?? {}) },
  };
}

export function tryInflictInjuryOnCtx(
  ctx: AttackContext,
  team: "home" | "away",
  playerName: string,
  stamina: number,
  minute: number,
  half: 1 | 2,
  incident: InjuryIncident,
  isSubstitute: boolean
): CommentaryEvent | null {
  if (!ctx.persistentMatchMode) return null;
  const existing = ctxSideInjuries(ctx, team)[playerName];
  if (existing && !existing.subbedOff) return null;

  const chance = injuryRollChance(stamina, isSubstitute);
  if (Math.random() >= chance) return null;

  const severity = pickInitialSeverity();
  const bodyPart = pickBodyPartForIncident(incident);
  const injury: ActiveMatchInjury = {
    playerName,
    severity,
    bodyPart,
    occurredMinute: minute,
    upgraded: false,
    subbedOff: false,
  };

  const map = { ...ctxSideInjuries(ctx, team), [playerName]: injury };
  setCtxSideInjuries(ctx, team, map);
  return {
    id: commentaryId(),
    minute,
    half,
    type: "injury",
    text: injuryCommentaryLine(playerName, bodyPart, severity),
    team,
    playerName,
  };
}

export function processInjuryUpgradesOnCtx(
  ctx: AttackContext,
  minute: number,
  half: 1 | 2
): CommentaryEvent[] {
  if (!ctx.persistentMatchMode) return [];
  const events: CommentaryEvent[] = [];

  for (const team of ["home", "away"] as const) {
    const map = { ...ctxSideInjuries(ctx, team) };
    let changed = false;
    for (const [name, row] of Object.entries(map)) {
      if (row.subbedOff || row.upgraded || row.severity === "long") continue;
      if (minute - row.occurredMinute < INJURY_UPGRADE_MINUTES) continue;
      const newSeverity = upgradeSeverity(row.severity);
      map[name] = { ...row, severity: newSeverity, upgraded: true };
      changed = true;
      events.push({
        id: commentaryId(),
        minute,
        half,
        type: "injury",
        text: injuryUpgradeCommentary(name, row.bodyPart),
        team,
        playerName: name,
      });
    }
    if (changed) setCtxSideInjuries(ctx, team, map);
  }

  return events;
}

export function markInjuredPlayerSubbedOffOnCtx(
  ctx: AttackContext,
  team: "home" | "away",
  playerName: string
): void {
  const map = { ...ctxSideInjuries(ctx, team) };
  const row = map[playerName];
  if (!row) return;
  map[playerName] = { ...row, subbedOff: true };
  setCtxSideInjuries(ctx, team, map);
}

export function markInjuredPlayerSubbedOff(
  state: MatchState,
  team: "home" | "away",
  playerName: string
): MatchState {
  const map = { ...sideInjuries(state, team) };
  const row = map[playerName];
  if (!row) return state;
  map[playerName] = { ...row, subbedOff: true };
  return setSideInjuries(state, team, map);
}

export function clearInjuredPlayer(
  state: MatchState,
  team: "home" | "away",
  playerName: string
): MatchState {
  const map = { ...sideInjuries(state, team) };
  delete map[playerName];
  return setSideInjuries(state, team, map);
}

export function tryInflictInjury(
  state: MatchState,
  team: "home" | "away",
  playerName: string,
  stamina: number,
  minute: number,
  half: 1 | 2,
  incident: InjuryIncident,
  isSubstitute: boolean
): { state: MatchState; event: CommentaryEvent | null } {
  const existing = sideInjuries(state, team)[playerName];
  if (existing && !existing.subbedOff) {
    return { state, event: null };
  }

  const chance = injuryRollChance(stamina, isSubstitute);
  if (Math.random() >= chance) return { state, event: null };

  const severity = pickInitialSeverity();
  const bodyPart = pickBodyPartForIncident(incident);
  const injury: ActiveMatchInjury = {
    playerName,
    severity,
    bodyPart,
    occurredMinute: minute,
    upgraded: false,
    subbedOff: false,
  };

  const map = { ...sideInjuries(state, team), [playerName]: injury };
  const next = setSideInjuries(state, team, map);
  const event: CommentaryEvent = {
    id: commentaryId(),
    minute,
    half,
    type: "injury",
    text: injuryCommentaryLine(playerName, bodyPart, severity),
    team,
    playerName,
  };
  return { state: next, event };
}

export function processInjuryUpgrades(
  state: MatchState,
  minute: number,
  half: 1 | 2
): { state: MatchState; events: CommentaryEvent[] } {
  const events: CommentaryEvent[] = [];
  let next = state;

  for (const team of ["home", "away"] as const) {
    const map = { ...sideInjuries(next, team) };
    let changed = false;
    for (const [name, row] of Object.entries(map)) {
      if (row.subbedOff || row.upgraded || row.severity === "long") continue;
      if (minute - row.occurredMinute < INJURY_UPGRADE_MINUTES) continue;
      const newSeverity = upgradeSeverity(row.severity);
      map[name] = { ...row, severity: newSeverity, upgraded: true };
      changed = true;
      events.push({
        id: commentaryId(),
        minute,
        half,
        type: "injury",
        text: injuryUpgradeCommentary(name, row.bodyPart),
        team,
        playerName: name,
      });
    }
    if (changed) next = setSideInjuries(next, team, map);
  }

  return { state: next, events };
}

export function injuryRatingPenalty(state: MatchState, team: "home" | "away", playerName: string): number {
  const row = sideInjuries(state, team)[playerName];
  if (!row || row.subbedOff) return 0;
  const mult = injuryEffectivenessMultiplier(row.severity);
  return mult - 1;
}

export function activeInjurySeverity(
  state: MatchState,
  team: "home" | "away",
  playerName: string
): InjurySeverity | null {
  const row = sideInjuries(state, team)[playerName];
  if (!row || row.subbedOff) return null;
  return row.severity;
}

export function activeInjuryBodyPart(
  state: MatchState,
  team: "home" | "away",
  playerName: string
): InjuryBodyPart | null {
  const row = sideInjuries(state, team)[playerName];
  if (!row || row.subbedOff) return null;
  return row.bodyPart;
}
