import type {
  CommentaryEvent,
  FormationId,
  LineupSlot,
  MatchState,
  PendingSetPiece,
  Player,
  Role,
  TeamMatchStats,
  TeamSetup,
} from "./types";
import { defaultSetPieceBudget, emptyTeamStats } from "./types";
import { getFormation } from "./formations";
import {
  FORMATION_ZONE_MOD,
  pickAttackChannel,
  slotChannel,
  slotZone,
  type Channel,
} from "./formation-zones";
import { avgRating, rollChance, rollDuel, winProbability } from "./duels";
import { getPlayer, getUniverse } from "./squads";
import { roleRating, staminaMultiplier } from "./stats";
import { applyStaminaDrain } from "./stamina";
import {
  createCommentarySession,
  maybeAmbient,
  say,
  syncCommentaryMemory,
} from "./commentary";
import type { CommentaryKind, SeasonMatchMeta } from "./commentary-types";
import {
  beginInteractiveSetPiece,
  canUseCornerAttack,
  canUseCornerDefend,
} from "./set-piece-interactive";
import {
  commentaryId,
  minuteFromTick,
  spreadEventMinutes,
  TICK_MS,
  TICKS_PER_HALF,
} from "./simulation-utils";
import type { AttackContext } from "./special-events-types";
import {
  addSpecialCast,
  createAttackContextExtras,
  flushPhaseSpecial,
} from "./special-events";
import { applyDuelModifiers, applyXgModifiers } from "./special-effects";
import {
  applyTacticalBuildMod,
  applyTacticalXgMod,
  applyTraitFoulBias,
  applyTraitToXg,
  captainDuelBonus,
  captainXgBonus,
  pickAttackChannelForTactic,
  tacticActiveForHalf,
} from "./match-influence";
import { getUniverseTrait } from "./universe-traits";
import { cpuRandomLineup } from "./lineup";
import {
  recordAssist,
  recordGoal,
  recordYellow,
  recordRed,
  resolveAssist,
} from "./player-match-stats";

export { TICK_MS, TICKS_PER_HALF };

function commLine(
  ctx: AttackContext,
  kind: CommentaryKind,
  vars: Record<string, string>,
  playerName?: string
): string {
  return say(ctx.comm, kind, vars, playerName, ctx.attacking);
}

interface ResolvedPlayer {
  slotId: string;
  name: string;
  role: Role;
  stats: Player["stats"];
  channel: Channel;
  zone: ReturnType<typeof slotZone>;
}

function resolveLineup(setup: TeamSetup): ResolvedPlayer[] {
  const formation = getFormation(setup.formationId);
  return formation.slots.map((slot) => {
    const assigned = setup.lineup.find((l) => l.slotId === slot.id);
    const playerName = assigned?.playerName;
    const player = playerName ? getPlayer(setup.universeId, playerName) : null;
    return {
      slotId: slot.id,
      name: playerName ?? "Unknown",
      role: slot.role,
      stats: player?.stats ?? {
        pace: 50,
        power: 50,
        stamina: 50,
        tackling: 50,
        passing: 50,
        gk: 50,
      },
      channel: slotChannel(slot.id),
      zone: slotZone(slot.role),
    };
  });
}

function initStamina(lineup: ResolvedPlayer[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of lineup) {
    if (p.name !== "Unknown") map[p.name] = 100;
  }
  return map;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function effectiveRating(
  player: ResolvedPlayer,
  staminaMap: Record<string, number>,
  formationId: FormationId,
  zoneMod = 0
): number {
  const mult = staminaMultiplier(staminaMap[player.name] ?? 100);
  const zone = slotZone(player.role);
  const formMod = FORMATION_ZONE_MOD[formationId][zone];
  return roleRating(player.stats, player.role, mult) + formMod + zoneMod;
}

function playersByZone(lineup: ResolvedPlayer[], zone: ResolvedPlayer["zone"]): ResolvedPlayer[] {
  return lineup.filter((p) => p.zone === zone && p.name !== "Unknown");
}

function playersByChannel(lineup: ResolvedPlayer[], channel: Channel): ResolvedPlayer[] {
  return lineup.filter((p) => p.channel === channel && p.name !== "Unknown");
}

function pickAttacker(lineup: ResolvedPlayer[], channel: Channel): ResolvedPlayer {
  const inChannel = playersByChannel(lineup, channel);
  const st = inChannel.filter((p) => p.role === "ST");
  const w = inChannel.filter((p) => p.role === "W");
  const am = inChannel.filter((p) => p.role === "AM" || p.role === "CM");
  const pool =
    channel === "center"
      ? [...st, ...am, ...w]
      : [...w, ...st, ...am];
  if (pool.length) return pick(pool);
  const forwards = lineup.filter((p) => ["ST", "W", "AM"].includes(p.role));
  return forwards.length ? pick(forwards) : pick(lineup);
}

function pickDefender(lineup: ResolvedPlayer[], channel: Channel, attacker: ResolvedPlayer): ResolvedPlayer {
  const inChannel = playersByChannel(lineup, channel);
  const fb = inChannel.filter((p) => p.role === "FB");
  const cb = inChannel.filter((p) => p.role === "CB");
  const dm = lineup.filter((p) => p.role === "DM" || p.role === "CM");
  if (channel !== "center" && fb.length) return pick(fb);
  if (cb.length) return pick(cb);
  if (dm.length && attacker.role !== "GK") return pick(dm);
  const defs = lineup.filter((p) => ["CB", "FB", "DM", "GK"].includes(p.role));
  return defs.length ? pick(defs) : pick(lineup);
}

function computeXg(
  atkRating: number,
  defRating: number,
  channel: Channel,
  staminaMap: Record<string, number>,
  striker: ResolvedPlayer,
  setPieceBonus = 0,
  momentum = 0
): number {
  const margin = Math.max(-25, Math.min(25, atkRating - defRating));
  let xg = 0.12 + margin * 0.008;
  if (channel === "center") xg += 0.035;
  const stMult = staminaMultiplier(staminaMap[striker.name] ?? 100);
  xg *= 0.88 + stMult * 0.12;
  xg += setPieceBonus;
  xg += momentum * 0.01;
  return Math.max(0.06, Math.min(0.45, xg));
}

function rollFoul(defender: ResolvedPlayer, channel: Channel): boolean {
  const base = channel === "center" ? 0.06 : 0.09;
  const tack = defender.stats.tackling / 100;
  const p = base + tack * 0.08;
  return rollChance(p);
}

function mentionPhase(ctx: AttackContext, name: string): void {
  if (name && name !== "Unknown") ctx.phaseMentions.push(name);
}

function activeTactic(
  ctx: AttackContext,
  team: "home" | "away"
): import("./types").TacticalStyle | null {
  if (team === "home") {
    return tacticActiveForHalf(ctx.homeTacticHalf, ctx.half) ? ctx.homeTactic : null;
  }
  return tacticActiveForHalf(ctx.awayTacticHalf, ctx.half) ? ctx.awayTactic : null;
}

function traitForTeam(ctx: AttackContext, team: "home" | "away") {
  return getUniverseTrait(team === "home" ? ctx.homeUniverseId : ctx.awayUniverseId);
}

function playerStatsMap(ctx: AttackContext, team: "home" | "away") {
  return team === "home" ? ctx.homePlayerStats : ctx.awayPlayerStats;
}

function recordCard(
  ctx: AttackContext,
  team: "home" | "away",
  playerName: string,
  events: CommentaryEvent[],
  half: 1 | 2
): "yellow" | "red" {
  const isRed = Math.random() < 0.22;
  if (isRed) {
    recordRed(playerStatsMap(ctx, team), playerName);
    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: "redcard",
      text: commLine(ctx, "redcard", { player: playerName }, playerName),
      team,
      playerName,
    });
    return "red";
  }
  recordYellow(playerStatsMap(ctx, team), playerName);
  events.push({
    id: commentaryId(),
    minute: 0,
    half,
    type: "yellowcard",
    text: commLine(ctx, "yellowcard", { player: playerName }, playerName),
    team,
    playerName,
  });
  return "yellow";
}

export function createInitialMatchState(
  home: TeamSetup,
  away: TeamSetup,
  options?: { seasonMeta?: SeasonMatchMeta }
): MatchState {
  const homeLineup = resolveLineup(home);
  const awayLineup = resolveLineup(away);
  const homeName = getUniverse(home.universeId)?.name ?? "Home";
  const awayName = getUniverse(away.universeId)?.name ?? "Away";
  const kickoffSession = createCommentarySession(
    {
      score: { home: 0, away: 0 },
      homePlayerStats: {},
      awayPlayerStats: {},
      seasonMeta: options?.seasonMeta,
    },
    0,
    1,
    0,
    homeName,
    awayName
  );
  const kickoffText = say(kickoffSession, "kickoff", { home: homeName, away: awayName });
  return {
    status: "running",
    half: 1,
    tick: 0,
    ticksPerHalf: TICKS_PER_HALF,
    score: { home: 0, away: 0 },
    homeStamina: initStamina(homeLineup),
    awayStamina: initStamina(awayLineup),
    commentary: [
      {
        id: commentaryId(),
        minute: 0,
        half: 1,
        type: "info",
        text: kickoffText,
      },
    ],
    homeUniverseId: home.universeId,
    awayUniverseId: away.universeId,
    homeSubsUsed: 0,
    awaySubsUsed: 0,
    homeStats: emptyTeamStats(),
    awayStats: emptyTeamStats(),
    pendingSetPiece: null,
    setPieceBudget: defaultSetPieceBudget(),
    interactiveSetPiece: null,
    momentum: 0,
    specialCooldown: {},
    recentCommentaryLines: syncCommentaryMemory(kickoffSession),
    seasonMeta: options?.seasonMeta,
    homePlayerStats: {},
    awayPlayerStats: {},
    homeTactic: null,
    awayTactic: null,
    homeTacticHalf: 0,
    awayTacticHalf: 0,
    homeCaptain: null,
    awayCaptain: null,
    homeCaptainHalf: 0,
    awayCaptainHalf: 0,
    homeCaptainBoostTicks: 0,
    awayCaptainBoostTicks: 0,
  };
}

function drainTeamsForTick(
  homeLineup: ResolvedPlayer[],
  awayLineup: ResolvedPlayer[],
  homeStamina: Record<string, number>,
  awayStamina: Record<string, number>,
  attackingTeam: "home" | "away"
): void {
  if (attackingTeam === "home") {
    applyStaminaDrain(homeLineup, homeStamina, "attacking");
    applyStaminaDrain(awayLineup, awayStamina, "defending");
  } else {
    applyStaminaDrain(awayLineup, awayStamina, "attacking");
    applyStaminaDrain(homeLineup, homeStamina, "defending");
  }
}

function atkDef(ctx: AttackContext) {
  const isHome = ctx.attacking === "home";
  return {
    atkLineup: (isHome ? ctx.homeLineup : ctx.awayLineup) as ResolvedPlayer[],
    defLineup: (isHome ? ctx.awayLineup : ctx.homeLineup) as ResolvedPlayer[],
    atkForm: isHome ? ctx.homeFormation : ctx.awayFormation,
    defForm: isHome ? ctx.awayFormation : ctx.homeFormation,
    atkStamina: isHome ? ctx.homeStamina : ctx.awayStamina,
    defStamina: isHome ? ctx.awayStamina : ctx.homeStamina,
    atkStats: isHome ? ctx.homeStats : ctx.awayStats,
    defStats: isHome ? ctx.awayStats : ctx.homeStats,
    atkName: isHome ? ctx.homeName : ctx.awayName,
  };
}

function runAttackPhase(ctx: AttackContext): CommentaryEvent[] {
  const events: CommentaryEvent[] = [];
  const { attacking, half, momentum, pendingSetPiece } = ctx;
  const { atkLineup, defLineup, atkForm, defForm, atkStamina, defStamina, atkStats, defStats, atkName } =
    atkDef(ctx);

  const momBonus = attacking === "home" ? momentum : -momentum;

  // --- Set piece (free kick) from prior foul ---
  if (pendingSetPiece?.team === attacking) {
    const taker = pickAttacker(atkLineup, "center");
    const wall = pickDefender(defLineup, "center", taker);
    ctx.freekickTaker = taker.name;
    ctx.playmaker = taker.name;
    mentionPhase(ctx, taker.name);

    let atkR = effectiveRating(taker, atkStamina, atkForm, 4);
    const defR = effectiveRating(wall, defStamina, defForm);
    let xg = computeXg(atkR, defR, "center", atkStamina, taker, pendingSetPiece.xgBonus + 0.1, momBonus);
    const atkTrait = traitForTeam(ctx, attacking);
    xg = applyTraitToXg(atkTrait, xg, true);
    xg = applyTacticalXgMod(activeTactic(ctx, attacking), true, "center", xg);

    const capTicks = attacking === "home" ? ctx.homeCaptainBoostTicks : ctx.awayCaptainBoostTicks;
    const captain = attacking === "home" ? ctx.homeCaptain : ctx.awayCaptain;
    const capHalf = attacking === "home" ? ctx.homeCaptainHalf : ctx.awayCaptainHalf;
    atkR += captainDuelBonus(captain, capHalf, half, capTicks, taker.name);
    xg += captainXgBonus(captain, capHalf, half, capTicks, taker.name);

    atkStats.possessionPhases++;
    atkStats.shots++;
    if (xg >= 0.12) atkStats.chances++;

    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: "freekick",
      text: commLine(ctx, "freekick", { team: atkName, taker: taker.name }, taker.name),
      team: attacking,
    });

    addSpecialCast(ctx, taker.name, attacking, 3);
    flushPhaseSpecial(ctx, events);

    atkR = applyDuelModifiers(ctx, attacking, atkR);
    xg = applyXgModifiers(ctx, attacking, xg);

    ctx.pendingSetPiece = null;
    return resolveShot(events, ctx, taker, defLineup, xg, atkStats, defStats, attacking, half);
  }

  atkStats.possessionPhases++;

  // --- Phase 1+2: Build-up (midfield + progression combined) ---
  const atkMids = playersByZone(atkLineup, "mid");
  const defMids = playersByZone(defLineup, "mid");
  let atkBuild =
    avgRating(atkMids.map((p) => effectiveRating(p, atkStamina, atkForm))) +
    FORMATION_ZONE_MOD[atkForm].mid * 0.4 +
    avgRating(
      atkMids.concat(playersByZone(atkLineup, "att").slice(0, 2)).map((p) => {
        const mult = staminaMultiplier(atkStamina[p.name] ?? 100);
        return p.stats.passing * mult;
      })
    ) *
      0.35 +
    5;
  let defBuild =
    avgRating(defMids.map((p) => effectiveRating(p, defStamina, defForm))) +
    FORMATION_ZONE_MOD[defForm].mid * 0.4 +
    avgRating(
      defMids.concat(playersByZone(defLineup, "def").filter((p) => p.role !== "GK")).map((p) => {
        const mult = staminaMultiplier(defStamina[p.name] ?? 100);
        return p.stats.tackling * mult * 0.85 + p.stats.pace * mult * 0.15;
      })
    ) *
      0.35;

  const defTeam = attacking === "home" ? "away" : "home";
  const atkTactic = activeTactic(ctx, attacking);
  const defTactic = activeTactic(ctx, defTeam);
  if (atkTactic) {
    const mod = applyTacticalBuildMod(atkTactic, true, atkBuild, defBuild);
    atkBuild = mod.atkBuild;
    defBuild = mod.defBuild;
  }
  if (defTactic) {
    const mod = applyTacticalBuildMod(defTactic, false, atkBuild, defBuild);
    atkBuild = mod.atkBuild;
    defBuild = mod.defBuild;
  }

  const turnoverBase = 0.042 - (traitForTeam(ctx, attacking).pressBonus ?? 0) * 0.15;

  if (!rollDuel(atkBuild, defBuild, turnoverBase)) {
    defStats.possessionPhases++;
    const breaker = defMids.length ? pick(defMids) : pick(defLineup);
    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: "turnover",
      text: commLine(ctx, "turnover", { player: breaker.name }, breaker.name),
      team: attacking === "home" ? "away" : "home",
    });
    addSpecialCast(ctx, breaker.name, attacking === "home" ? "away" : "home", 2);
    flushPhaseSpecial(ctx, events);
    const amb = maybeAmbient(ctx.comm, half, attacking, atkName, commentaryId, 0.15);
    if (amb) events.push(amb);
    return events;
  }

  const channel = pickAttackChannelForTactic(() => pickAttackChannel(atkForm), atkTactic ?? null);
  const striker = pickAttacker(atkLineup, channel);
  mentionPhase(ctx, striker.name);

  const playmaker = atkMids.length ? pick(atkMids) : pick(atkLineup);
  ctx.playmaker = playmaker.name;
  if (Math.random() < 0.35) {
    mentionPhase(ctx, playmaker.name);
    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: Math.random() < 0.5 ? "longball" : "pressure",
      text:
        Math.random() < 0.5
          ? commLine(ctx, "longball", { player: playmaker.name, target: striker.name }, playmaker.name)
          : commLine(ctx, "pressure", { team: atkName }),
      team: attacking,
    });
  } else if (Math.random() < 0.4) {
    mentionPhase(ctx, playmaker.name);
    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: "info",
      text: commLine(ctx, "buildup", { player: playmaker.name }, playmaker.name),
      team: attacking,
    });
  }

  if (channel !== "center" && Math.random() < 0.45) {
    const crossers = playersByChannel(atkLineup, channel).filter(
      (p) => p.role === "W" || p.role === "FB"
    );
    const crosser = crossers.length ? pick(crossers) : striker;
    ctx.crosser = crosser.name;
    mentionPhase(ctx, crosser.name);
    mentionPhase(ctx, striker.name);
    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: "cross",
      text: commLine(ctx, "cross", { crosser: crosser.name, target: striker.name }, crosser.name),
      team: attacking,
    });
    addSpecialCast(ctx, crosser.name, attacking, 2);
  }

  addSpecialCast(ctx, striker.name, attacking, 3);
  addSpecialCast(ctx, playmaker.name, attacking, 2);

  if (Math.random() < 0.06) {
    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: "offside",
      text: commLine(ctx, "offside", { player: striker.name }, striker.name),
      team: attacking,
    });
    flushPhaseSpecial(ctx, events);
    return events;
  }

  const defender = pickDefender(defLineup, channel, striker);
  let atkR = effectiveRating(striker, atkStamina, atkForm) + 2;
  const defR = effectiveRating(defender, defStamina, defForm) + FORMATION_ZONE_MOD[defForm].def * 0.4;

  const capTicks = attacking === "home" ? ctx.homeCaptainBoostTicks : ctx.awayCaptainBoostTicks;
  const captain = attacking === "home" ? ctx.homeCaptain : ctx.awayCaptain;
  const capHalf = attacking === "home" ? ctx.homeCaptainHalf : ctx.awayCaptainHalf;
  atkR += captainDuelBonus(captain, capHalf, half, capTicks, striker.name);

  addSpecialCast(ctx, defender.name, attacking === "home" ? "away" : "home", 2);
  flushPhaseSpecial(ctx, events);

  if (ctx.forceTurnover) {
    ctx.forceTurnover = false;
    defStats.possessionPhases++;
    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: "turnover",
      text: commLine(ctx, "turnover", { player: defender.name }, defender.name),
      team: attacking === "home" ? "away" : "home",
    });
    return events;
  }

  atkR = applyDuelModifiers(ctx, attacking, atkR);

  // Foul chance before duel resolved
  const defTrait = traitForTeam(ctx, defTeam);
  const foulRoll = rollFoul(defender, channel);
  const foulProb = applyTraitFoulBias(defTrait, winProbability(atkR, defR, 0.04));
  if (foulRoll && Math.random() < foulProb) {
    defStats.foulsCommitted++;
    const gk = defLineup.find((p) => p.role === "GK") ?? defLineup[0];
    const penaltyInBox = channel === "ST" && Math.random() < 0.38;
    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: "foul",
      text: commLine(ctx, "foul", { attacker: striker.name, defender: defender.name }, defender.name),
      team: attacking,
    });
    if (penaltyInBox) {
      ctx.pendingSetPiece = null;
      ctx.setPieceTrigger = {
        kind: "penalty",
        attacking,
        taker: striker.name,
        keeper: gk.name,
      };
    } else {
      atkStats.freeKicksWon++;
      ctx.pendingSetPiece = { team: attacking, kind: "freekick", xgBonus: 0.14 };
    }
    if (Math.random() < 0.2) {
      recordCard(ctx, defTeam, defender.name, events, half);
    }
    return events;
  }

  if (!rollDuel(atkR, defR, 0.052)) {
    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: Math.random() < 0.35 ? "clearance" : "tackle",
      text:
        Math.random() < 0.35
          ? commLine(ctx, "clearance", { defender: defender.name }, defender.name)
          : commLine(ctx, "tackle", { defender: defender.name, attacker: striker.name }, defender.name),
      team: attacking === "home" ? "away" : "home",
    });
    return events;
  }

  // --- Phase 4: Shot ---
  let xg = computeXg(atkR, defR, channel, atkStamina, striker, 0, momBonus);
  xg = applyTraitToXg(traitForTeam(ctx, attacking), xg, false);
  xg = applyTacticalXgMod(atkTactic ?? null, true, channel, xg);
  xg += captainXgBonus(captain, capHalf, half, capTicks, striker.name);
  xg = applyXgModifiers(ctx, attacking, xg);

  if (ctx.forceChance === attacking) {
    xg = Math.max(xg, 0.11);
    ctx.forceChance = null;
  }

  atkStats.shots++;
  if (xg >= 0.14) atkStats.chances++;

  if (xg < 0.07) {
    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: "chance",
      text: commLine(ctx, "chance", { shooter: striker.name, team: atkName }, striker.name),
      team: attacking,
    });
    return events;
  }

  return resolveShot(events, ctx, striker, defLineup, xg, atkStats, defStats, attacking, half);
}

function maybeQueueInteractiveCorner(
  ctx: AttackContext,
  attacking: "home" | "away",
  striker: ResolvedPlayer,
  gk: ResolvedPlayer
): boolean {
  const defending = attacking === "home" ? "away" : "home";
  if (
    !canUseCornerAttack(ctx.setPieceBudget, attacking) ||
    !canUseCornerDefend(ctx.setPieceBudget, defending)
  ) {
    return false;
  }
  ctx.setPieceTrigger = {
    kind: "corner",
    attacking,
    taker: striker.name,
    keeper: gk.name,
    cornerTaker: striker.name,
  };
  return true;
}

function resolveShot(
  events: CommentaryEvent[],
  ctx: AttackContext,
  striker: ResolvedPlayer,
  defLineup: ResolvedPlayer[],
  xg: number,
  atkStats: TeamMatchStats,
  defStats: TeamMatchStats,
  attacking: "home" | "away",
  half: 1 | 2
): CommentaryEvent[] {
  const gk = defLineup.find((p) => p.role === "GK") ?? defLineup[0];
  const defStamina = attacking === "home" ? ctx.awayStamina : ctx.homeStamina;
  const gkR = effectiveRating(gk, defStamina, attacking === "home" ? ctx.awayFormation : ctx.homeFormation);

  const onTarget = rollChance(0.62 + xg * 0.55);
  if (!onTarget) {
    const headerShot = Math.random() < 0.22;
    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: headerShot ? "header" : "miss",
      text: headerShot
        ? commLine(ctx, "header", { player: striker.name }, striker.name)
        : commLine(ctx, "miss", { shooter: striker.name }, striker.name),
      team: attacking,
    });
    if (Math.random() < 0.35) {
      if (!maybeQueueInteractiveCorner(ctx, attacking, striker, gk)) {
        events.push({
          id: commentaryId(),
          minute: 0,
          half,
          type: "corner",
          text: commLine(
            ctx,
            "corner",
            { team: attacking === "home" ? ctx.homeName : ctx.awayName }
          ),
          team: attacking,
        });
      }
    }
    return events;
  }

  atkStats.shotsOnTarget++;

  const gkStopChance = winProbability(gkR, striker.stats.power * 0.5 + striker.stats.passing * 0.3, 0.05);
  let goalChance = xg * (1.15 - gkStopChance * 0.32);

  if (ctx.gkMoment === "save") {
    goalChance *= 0.55;
    ctx.gkMoment = null;
  } else if (ctx.gkMoment === "blunder") {
    goalChance = Math.min(0.92, goalChance * 1.45);
    ctx.gkMoment = null;
  }

  if (rollChance(goalChance)) {
    if (attacking === "home") ctx.momentum = Math.min(5, ctx.momentum + 1);
    else ctx.momentum = Math.max(-5, ctx.momentum - 1);

    const assister = resolveAssist(
      striker.name,
      ctx.phaseMentions,
      ctx.playmaker,
      ctx.crosser,
      ctx.freekickTaker
    );
    recordGoal(playerStatsMap(ctx, attacking), striker.name);
    if (assister) recordAssist(playerStatsMap(ctx, attacking), assister);

    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: "goal",
      text: commLine(
        ctx,
        "goal",
        { scorer: striker.name, team: attacking === "home" ? ctx.homeName : ctx.awayName },
        striker.name
      ),
      team: attacking,
      playerName: striker.name,
      assistPlayerName: assister ?? undefined,
    });
  } else {
    defStats.saves++;
    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: "save",
      text: commLine(ctx, "save", { gk: gk.name, shooter: striker.name }, gk.name),
      team: attacking,
    });
    if (Math.random() < 0.25) {
      if (!maybeQueueInteractiveCorner(ctx, attacking, striker, gk)) {
        events.push({
          id: commentaryId(),
          minute: 0,
          half,
          type: "corner",
          text: commLine(
            ctx,
            "corner",
            { team: attacking === "home" ? ctx.homeName : ctx.awayName }
          ),
          team: attacking,
        });
      }
    }
  }

  return events;
}

export interface TickResult {
  state: MatchState;
  events: CommentaryEvent[];
}

import { normalizeMatchState } from "./match-state";

export function processTick(state: MatchState, home: TeamSetup, away: TeamSetup): TickResult {
  state = normalizeMatchState(state);

  if (state.status === "finished" || state.status === "halftime" || state.status === "sub_window" || state.status === "set_piece_pause") {
    return { state, events: [] };
  }

  const homeLineup = resolveLineup(home);
  const awayLineup = resolveLineup(away);
  const newState: MatchState = {
    ...state,
    commentary: [...state.commentary],
    homeStamina: { ...state.homeStamina },
    awayStamina: { ...state.awayStamina },
    score: { ...state.score },
    homeStats: { ...state.homeStats },
    awayStats: { ...state.awayStats },
    homePlayerStats: { ...(state.homePlayerStats ?? {}) },
    awayPlayerStats: { ...(state.awayPlayerStats ?? {}) },
    pendingSetPiece: state.pendingSetPiece ? { ...state.pendingSetPiece } : null,
    setPieceBudget: state.setPieceBudget ?? defaultSetPieceBudget(),
    interactiveSetPiece: state.interactiveSetPiece
      ? { ...state.interactiveSetPiece }
      : null,
    momentum: state.momentum,
    specialCooldown: { ...(state.specialCooldown ?? {}) },
  };

  if (newState.homeCaptainBoostTicks > 0) newState.homeCaptainBoostTicks--;
  if (newState.awayCaptainBoostTicks > 0) newState.awayCaptainBoostTicks--;
  const events: CommentaryEvent[] = [];

  let tick = state.tick + 1;
  const half = state.half;

  if (tick > TICKS_PER_HALF) {
    const homeName = getUniverse(home.universeId)?.name ?? "Home";
    const awayName = getUniverse(away.universeId)?.name ?? "Away";
    const endSession = createCommentarySession(
      newState,
      half === 1 ? 45 : 90,
      half,
      newState.momentum,
      homeName,
      awayName
    );
    const scoreVars = {
      homeScore: String(state.score.home),
      awayScore: String(state.score.away),
    };

    if (half === 1) {
      newState.status = "halftime";
      newState.tick = TICKS_PER_HALF;
      const htText = say(endSession, "halftime", scoreVars);
      events.push({
        id: commentaryId(),
        minute: 45,
        half: 1,
        type: "halftime",
        text: htText,
      });
      newState.recentCommentaryLines = syncCommentaryMemory(endSession);
      newState.commentary.push(...events);
      return { state: newState, events };
    }

    const isCupDraw =
      state.score.home === state.score.away &&
      state.tournamentMeta?.cupKnockout &&
      state.tournamentMeta.penaltyMode === "interactive";

    if (isCupDraw) {
      const homeSt =
        homeLineup.find((p) => p.role === "ST") ??
        homeLineup.find((p) => p.role !== "GK") ??
        homeLineup[0];
      const awayGk = awayLineup.find((p) => p.role === "GK") ?? awayLineup[0];
      const decider = beginInteractiveSetPiece(
        newState,
        "penalty",
        "home",
        homeSt.name,
        awayGk.name
      );
      const ftLine = say(endSession, "fulltime", scoreVars);
      events.push({
        id: commentaryId(),
        minute: 90,
        half: 2,
        type: "fulltime",
        text: `${ftLine} — penalties to decide the tie.`,
      });
      decider.recentCommentaryLines = syncCommentaryMemory(endSession);
      decider.commentary = [...decider.commentary, ...events];
      return { state: decider, events };
    }

    newState.status = "finished";
    const ftText = say(endSession, "fulltime", scoreVars);
    events.push({
      id: commentaryId(),
      minute: 90,
      half: 2,
      type: "fulltime",
      text: ftText,
    });
    newState.recentCommentaryLines = syncCommentaryMemory(endSession);
    newState.commentary.push(...events);
    return { state: newState, events };
  }

  newState.tick = tick;
  newState.status = "running";
  const attackingTeam: "home" | "away" = tick % 2 === 0 ? "home" : "away";

  drainTeamsForTick(homeLineup, awayLineup, newState.homeStamina, newState.awayStamina, attackingTeam);
  const homeName = getUniverse(home.universeId)?.name ?? "Home";
  const awayName = getUniverse(away.universeId)?.name ?? "Away";

  const attackCtx: AttackContext = {
    attacking: attackingTeam,
    half,
    homeLineup,
    awayLineup,
    homeFormation: home.formationId,
    awayFormation: away.formationId,
    homeStamina: newState.homeStamina,
    awayStamina: newState.awayStamina,
    homeStats: newState.homeStats,
    awayStats: newState.awayStats,
    momentum: newState.momentum,
    pendingSetPiece: newState.pendingSetPiece,
    homeName,
    awayName,
    currentMinute: minuteFromTick(half, tick),
    specialCooldown: newState.specialCooldown,
    homePlayerStats: newState.homePlayerStats,
    awayPlayerStats: newState.awayPlayerStats,
    homeTactic: newState.homeTactic,
    awayTactic: newState.awayTactic,
    homeTacticHalf: newState.homeTacticHalf,
    awayTacticHalf: newState.awayTacticHalf,
    homeCaptain: newState.homeCaptain,
    awayCaptain: newState.awayCaptain,
    homeCaptainHalf: newState.homeCaptainHalf,
    awayCaptainHalf: newState.awayCaptainHalf,
    homeCaptainBoostTicks: newState.homeCaptainBoostTicks,
    awayCaptainBoostTicks: newState.awayCaptainBoostTicks,
    homeUniverseId: newState.homeUniverseId,
    awayUniverseId: newState.awayUniverseId,
    setPieceBudget: newState.setPieceBudget ?? defaultSetPieceBudget(),
    comm: createCommentarySession(
      newState,
      minuteFromTick(half, tick),
      half,
      newState.momentum,
      homeName,
      awayName
    ),
    ...createAttackContextExtras(),
  };

  const phaseEvents = runAttackPhase(attackCtx);
  newState.momentum = attackCtx.momentum;
  newState.pendingSetPiece = attackCtx.pendingSetPiece;

  if (attackCtx.setPieceTrigger) {
    const trigger = attackCtx.setPieceTrigger;
    spreadEventMinutes(phaseEvents, half, tick);
    const paused = beginInteractiveSetPiece(
      {
        ...newState,
        commentary: [...newState.commentary, ...phaseEvents],
        recentCommentaryLines: syncCommentaryMemory(attackCtx.comm),
      },
      trigger.kind,
      trigger.attacking,
      trigger.taker,
      trigger.keeper,
      trigger.cornerTaker
    );
    return { state: paused, events: phaseEvents };
  }

  for (const e of phaseEvents) {
    if (e.type === "goal") {
      if (e.team === "home") newState.score.home++;
      else if (e.team === "away") newState.score.away++;
      attackCtx.comm.score = { ...newState.score };
    }
  }

  const tiredSide = attackingTeam === "home" ? newState.homeStamina : newState.awayStamina;
  const tired = Object.entries(tiredSide).find(([, v]) => v < 35);
  if (tired && Math.random() < 0.1) {
    phaseEvents.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: "stamina",
      text: commLine(attackCtx, "stamina", { player: tired[0] }, tired[0]),
      team: attackingTeam,
    });
  }

  const amb = maybeAmbient(
    attackCtx.comm,
    half,
    attackingTeam,
    attackingTeam === "home" ? homeName : awayName,
    commentaryId,
    0.12
  );
  if (amb) phaseEvents.push(amb);

  spreadEventMinutes(phaseEvents, half, tick);

  newState.recentCommentaryLines = syncCommentaryMemory(attackCtx.comm);
  newState.commentary.push(...phaseEvents);
  return { state: newState, events: phaseEvents };
}

export function autoFillLineup(
  universeId: string,
  formationId: TeamSetup["formationId"],
  _existing: LineupSlot[] = []
): LineupSlot[] {
  return cpuRandomLineup(universeId, formationId);
}

export function isLineupComplete(lineup: LineupSlot[]): boolean {
  return lineup.length === 11 && lineup.every((s) => s.playerName);
}
