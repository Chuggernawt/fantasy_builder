import type { AttackContext } from "./special-events-types";
import type { CommentaryEvent, MatchState } from "./types";
import { commentaryId } from "./simulation-utils";
import { say } from "./commentary";
import { recordYellow } from "./player-match-stats";

export type SpecialEffect =
  | "boost"
  | "disrupt"
  | "chaos"
  | "chance"
  | "gk_moment"
  | "momentum_up"
  | "momentum_down"
  | "stamina_opp"
  | "stamina_self"
  | "yellow"
  | "wide"
  | "set_piece"
  | "turnover";

export function applySpecialEffect(
  ctx: AttackContext,
  effect: SpecialEffect,
  playerTeam: "home" | "away",
  playerName: string,
  events: CommentaryEvent[],
  half: 1 | 2
): void {
  const isHomeAtk = ctx.attacking === "home";
  const helpsAttack = playerTeam === ctx.attacking;

  switch (effect) {
    case "boost":
      ctx.attackBonus = {
        team: playerTeam,
        duel: 6,
        xg: 0.1,
        wide: false,
      };
      break;
    case "wide":
      ctx.attackBonus = {
        team: playerTeam,
        duel: 4,
        xg: 0.06,
        wide: true,
      };
      break;
    case "disrupt":
      ctx.attackPenalty = {
        team: ctx.attacking,
        duel: 5,
        xg: 0.08,
      };
      break;
    case "momentum_up":
      if (playerTeam === "home") ctx.momentum = Math.min(5, ctx.momentum + 2);
      else ctx.momentum = Math.max(-5, ctx.momentum - 2);
      break;
    case "momentum_down":
      if (playerTeam === "home") ctx.momentum = Math.max(-5, ctx.momentum - 1);
      else ctx.momentum = Math.min(5, ctx.momentum + 1);
      break;
    case "stamina_opp": {
      const oppStamina = isHomeAtk ? ctx.awayStamina : ctx.homeStamina;
      for (const name of Object.keys(oppStamina)) {
        oppStamina[name] = Math.max(8, (oppStamina[name] ?? 100) - 6);
      }
      break;
    }
    case "stamina_self": {
      const ownStamina = playerTeam === "home" ? ctx.homeStamina : ctx.awayStamina;
      if (ownStamina[playerName] != null) {
        ownStamina[playerName] = Math.max(8, ownStamina[playerName] - 10);
      }
      break;
    }
    case "set_piece":
      if (!ctx.pendingSetPiece) {
        ctx.pendingSetPiece = { team: playerTeam, kind: "freekick", xgBonus: 0.12 };
      }
      break;
    case "yellow":
      if (helpsAttack) {
        const defTeam = isHomeAtk ? "away" : "home";
        const defStats = isHomeAtk ? ctx.awayStats : ctx.homeStats;
        defStats.foulsCommitted++;
        recordYellow(
          defTeam === "home" ? ctx.homePlayerStats : ctx.awayPlayerStats,
          playerName
        );
        events.push({
          id: commentaryId(),
          minute: 0,
          half,
          type: "yellowcard",
          text: say(ctx.comm, "yellowcard", { player: playerName }, playerName, playerTeam),
          team: playerTeam,
          playerName,
        });
      }
      break;
    case "chaos":
      if (Math.random() < 0.4) {
        ctx.pendingSetPiece = { team: playerTeam, kind: "freekick", xgBonus: 0.1 };
      } else if (Math.random() < 0.5) {
        ctx.momentum += playerTeam === "home" ? (Math.random() < 0.5 ? 1 : -1) : Math.random() < 0.5 ? -1 : 1;
        ctx.momentum = Math.max(-5, Math.min(5, ctx.momentum));
      }
      break;
    case "chance":
      ctx.forceChance = playerTeam;
      break;
    case "gk_moment":
      ctx.gkMoment = playerTeam === ctx.attacking ? "blunder" : "save";
      break;
    case "turnover":
      ctx.forceTurnover = true;
      break;
  }
}

export function applyDuelModifiers(
  ctx: AttackContext,
  attacking: "home" | "away",
  atkRating: number
): number {
  let atk = atkRating;
  if (ctx.attackBonus?.team === attacking) atk += ctx.attackBonus.duel;
  if (ctx.attackPenalty?.team === attacking) atk -= ctx.attackPenalty.duel;
  return Math.max(0, atk);
}

export function applyXgModifiers(
  ctx: AttackContext,
  attacking: "home" | "away",
  xg: number
): number {
  let result = xg;
  if (ctx.attackBonus?.team === attacking) result += ctx.attackBonus.xg;
  if (ctx.attackPenalty?.team === attacking) result -= ctx.attackPenalty.xg;
  ctx.attackBonus = null;
  ctx.attackPenalty = null;
  return Math.max(0.04, Math.min(0.38, result));
}

export function consumeAttackModifiers(
  ctx: AttackContext,
  attacking: "home" | "away",
  baseDuel: number,
  baseXg: number
): { duel: number; xg: number } {
  let duel = baseDuel;
  let xg = baseXg;

  if (ctx.attackBonus?.team === attacking) {
    duel += ctx.attackBonus.duel;
    xg += ctx.attackBonus.xg;
    ctx.attackBonus = null;
  }
  if (ctx.attackPenalty?.team === attacking) {
    duel -= ctx.attackPenalty.duel;
    xg -= ctx.attackPenalty.xg;
    ctx.attackPenalty = null;
  }

  return { duel: Math.max(0, duel), xg: Math.max(0.04, xg) };
}

export function initSpecialState(state: MatchState): MatchState {
  return {
    ...state,
    specialCooldown: { ...(state.specialCooldown ?? {}) },
  };
}
