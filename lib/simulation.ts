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
import { resolveRosterPlayer } from "./season-lite";
import { bestRoleForStats, roleRating, staminaMultiplier } from "./stats";
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
import { beginCupPenaltyShootout, simulatedShootoutResult } from "./penalty-shootout";
import {
  commentaryId,
  minuteFromTick,
  spreadEventMinutes,
  TICK_MS,
  TICKS_PER_HALF,
} from "./simulation-utils";
import {
  computeStoppageMinutes,
  spreadStoppageEventMinutes,
  stoppageClockDisplay,
  stoppageWeightForEvent,
  TICKS_PER_STOPPAGE_MINUTE,
} from "./stoppage-time";
import type { AttackContext, SimLineupPlayer } from "./special-events-types";
import {
  addSpecialCast,
  createAttackContextExtras,
  flushPhaseSpecial,
} from "./special-events";
import { applyDuelModifiers, applyXgModifiers } from "./special-effects";
import {
  applyExtraTimeBuildMod,
  applyBuildUpMod,
  applyAttackingShapeMod,
  applyDefensiveShapeMod,
  applyChanceCreationXgMod,
  applyExtraTimeXgMod,
  applyTraitFoulBias,
  applyTraitToXg,
  buildUpTurnoverMod,
  pressTurnoverMod,
  defensiveShapeFoulMod,
  captainDuelBonus,
  captainXgBonus,
  pickAttackChannelForTactics,
  roleTacticRatingBonus,
  defensiveRoleTacticBonus,
  tacticsActive,
} from "./match-influence";
import { maybeTacticalPhaseCommentary } from "./tactics";
import { getUniverseTrait } from "./universe-traits";
import { cpuRandomLineup } from "./lineup";
import {
  isPlayerSentOff,
  recordAssist,
  recordClearance,
  recordDribble,
  recordGoal,
  recordPass,
  recordRed,
  recordSave,
  recordShot,
  recordShotBlocked,
  recordTackle,
  recordYellow,
  resolveAssist,
} from "./player-match-stats";
import {
  seedMatchPlayerStats,
  simulateBackgroundMatchTick,
} from "./background-match-stats";
import { formRatingBonus, inMatchPerformanceBoost } from "./match-rating";
import { pickCornerTaker, pickHeaderThreat } from "./simulation-picks";
import { normalizeMatchState } from "./match-state";
import {
  listSevereMisfits,
  pickMisfitCommentary,
  positionMisfitPenalty,
  shouldApplyMisfitPenalty,
} from "./position-fit";

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
  naturalRole: Role;
  stats: Player["stats"];
  channel: Channel;
  zone: ReturnType<typeof slotZone>;
}

function resolveLineup(setup: TeamSetup): ResolvedPlayer[] {
  const formation = getFormation(setup.formationId);
  return formation.slots.map((slot) => {
    const assigned = setup.lineup.find((l) => l.slotId === slot.id);
    const playerName = assigned?.playerName;
    const player = playerName
      ? resolveRosterPlayer(setup.universeId, setup.playerOrigins, playerName)
      : null;
    return {
      slotId: slot.id,
      name: playerName ?? "Unknown",
      role: slot.role,
      naturalRole: player ? bestRoleForStats(player.stats) : slot.role,
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

function ratingCtx(
  ctx: AttackContext,
  team: "home" | "away"
): { playerForm: Record<string, number>; playerStats: Record<string, import("./types").PlayerMatchStats> } {
  return {
    playerForm: ctx.playerForm ?? {},
    playerStats: team === "home" ? ctx.homePlayerStats : ctx.awayPlayerStats,
  };
}

function effectiveRating(
  player: ResolvedPlayer,
  staminaMap: Record<string, number>,
  formationId: FormationId,
  zoneMod = 0,
  perfCtx?: { playerForm: Record<string, number>; playerStats: Record<string, import("./types").PlayerMatchStats> },
  teamSetup?: TeamSetup
): number {
  const staminaMult = 0.94 + staminaMultiplier(staminaMap[player.name] ?? 100) * 0.06;
  const zone = slotZone(player.role);
  const formMod = FORMATION_ZONE_MOD[formationId][zone];
  const form = perfCtx?.playerForm[player.name] ?? 0;
  const stats = perfCtx?.playerStats[player.name];
  let rating =
    roleRating(player.stats, player.role, staminaMult) +
    formMod +
    zoneMod +
    formRatingBonus(form) +
    inMatchPerformanceBoost(stats, player.role);

  if (teamSetup && player.name !== "Unknown") {
    if (
      shouldApplyMisfitPenalty(
        teamSetup,
        player.name,
        player.role,
        player.naturalRole,
        player.stats
      )
    ) {
      rating += positionMisfitPenalty(player.stats, player.role, player.naturalRole);
    }
  }
  return rating;
}

function playersByZone(lineup: ResolvedPlayer[], zone: ResolvedPlayer["zone"]): ResolvedPlayer[] {
  return lineup.filter((p) => p.zone === zone && p.name !== "Unknown");
}

function playersByChannel(lineup: ResolvedPlayer[], channel: Channel): ResolvedPlayer[] {
  return lineup.filter((p) => p.channel === channel && p.name !== "Unknown");
}

function pickAttacker(lineup: ResolvedPlayer[], channel: Channel): ResolvedPlayer {
  const inChannel = playersByChannel(lineup, channel);
  const source = inChannel.length
    ? inChannel
    : lineup.filter((p) => p.role !== "GK" && p.name !== "Unknown");
  const weights: Partial<Record<ResolvedPlayer["role"], number>> =
    channel === "center"
      ? { ST: 5, W: 3, AM: 3, CM: 2, FB: 2, CB: 2, DM: 1 }
      : { W: 5, FB: 4, ST: 3, AM: 2, CM: 1, CB: 1 };
  const pool: ResolvedPlayer[] = [];
  for (const p of source) {
    const w = weights[p.role] ?? 0;
    for (let i = 0; i < w; i++) pool.push(p);
  }
  if (pool.length) return pick(pool);
  const forwards = lineup.filter((p) => ["ST", "W", "AM", "FB"].includes(p.role));
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

function duelMargin(atkRating: number, defRating: number, maxSpread = 18): number {
  const raw = atkRating - defRating;
  const sign = raw >= 0 ? 1 : -1;
  const abs = Math.min(Math.abs(raw), maxSpread);
  // Soft cap — big rating gaps matter but don't run away.
  const compressed = abs * (0.75 + 0.25 * (1 - abs / maxSpread));
  return sign * compressed;
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
  const margin = duelMargin(atkRating, defRating);
  let xg = 0.1 + margin * 0.0065;
  if (channel === "center") xg += 0.03;
  const stMult = 0.96 + staminaMultiplier(staminaMap[striker.name] ?? 100) * 0.04;
  xg *= 0.92 + stMult * 0.08;
  xg += setPieceBonus;
  xg += momentum * 0.007;
  return Math.max(0.055, Math.min(0.36, xg));
}

function rollFoul(defender: ResolvedPlayer, channel: Channel): boolean {
  const base = channel === "center" ? 0.08 : 0.11;
  const tack = defender.stats.tackling / 100;
  const p = base + tack * 0.1;
  return rollChance(p);
}

function mentionPhase(ctx: AttackContext, name: string): void {
  if (!name || name === "Unknown") return;
  if (
    isPlayerSentOff(ctx.homePlayerStats, name) ||
    isPlayerSentOff(ctx.awayPlayerStats, name)
  ) {
    return;
  }
  ctx.phaseMentions.push(name);
}

function activeTactics(
  ctx: AttackContext,
  team: "home" | "away"
): import("./types").TeamTactics | null {
  if (team === "home") {
    return tacticsActive(ctx.homeTacticHalf, ctx.half, !!ctx.homeTactics) ? ctx.homeTactics : null;
  }
  return tacticsActive(ctx.awayTacticHalf, ctx.half, !!ctx.awayTactics) ? ctx.awayTactics : null;
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
  const isRed = Math.random() < 0.28;
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
    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: "info",
      text: `${playerName} is sent off — ${team === "home" ? ctx.homeName : ctx.awayName} continue with ten men.`,
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
  options?: { seasonMeta?: SeasonMatchMeta; playerForm?: Record<string, number> }
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
    playerForm: options?.playerForm ?? {},
    ...seedMatchPlayerStats(home.lineup, away.lineup),
    homeTactics: null,
    awayTactics: null,
    homeTacticHalf: 0,
    awayTacticHalf: 0,
    homeCaptain: null,
    awayCaptain: null,
    homeCaptainHalf: 0,
    awayCaptainHalf: 0,
    homeCaptainBoostTicks: 0,
    awayCaptainBoostTicks: 0,
    stoppageCount: 0,
    stoppageMinutes: 0,
    stoppageTick: 0,
    inStoppageTime: false,
    homeExtraTimeApproach: null,
    awayExtraTimeApproach: null,
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

function activeLineupPlayers(
  lineup: SimLineupPlayer[],
  stats: AttackContext["homePlayerStats"]
): ResolvedPlayer[] {
  const active = (lineup as ResolvedPlayer[]).filter(
    (p) => p.name !== "Unknown" && !isPlayerSentOff(stats, p.name)
  );
  if (active.length > 0) return active;
  return (lineup as ResolvedPlayer[]).filter((p) => p.name !== "Unknown");
}

function atkDef(ctx: AttackContext) {
  const isHome = ctx.attacking === "home";
  const homeActive = activeLineupPlayers(ctx.homeLineup, ctx.homePlayerStats);
  const awayActive = activeLineupPlayers(ctx.awayLineup, ctx.awayPlayerStats);
  return {
    atkLineup: isHome ? homeActive : awayActive,
    defLineup: isHome ? awayActive : homeActive,
    atkForm: isHome ? ctx.homeFormation : ctx.awayFormation,
    defForm: isHome ? ctx.awayFormation : ctx.homeFormation,
    atkStamina: isHome ? ctx.homeStamina : ctx.awayStamina,
    defStamina: isHome ? ctx.awayStamina : ctx.homeStamina,
    atkStats: isHome ? ctx.homeStats : ctx.awayStats,
    defStats: isHome ? ctx.awayStats : ctx.homeStats,
    atkName: isHome ? ctx.homeName : ctx.awayName,
    atkSetup: isHome ? ctx.homeSetup : ctx.awaySetup,
    defSetup: isHome ? ctx.awaySetup : ctx.homeSetup,
  };
}

function runAttackPhase(ctx: AttackContext): CommentaryEvent[] {
  const events: CommentaryEvent[] = [];
  const { attacking, half, momentum, pendingSetPiece } = ctx;
  const {
    atkLineup,
    defLineup,
    atkForm,
    defForm,
    atkStamina,
    defStamina,
    atkStats,
    defStats,
    atkName,
    atkSetup,
    defSetup,
  } = atkDef(ctx);

  if (!pendingSetPiece && Math.random() < 0.09) {
    const misfitSetup = Math.random() < 0.5 ? atkSetup : defSetup;
    const misfitTeam = misfitSetup === atkSetup ? attacking : attacking === "home" ? "away" : "home";
    const severe = listSevereMisfits(misfitSetup);
    if (severe.length) {
      const m = severe[Math.floor(Math.random() * severe.length)];
      events.push({
        id: commentaryId(),
        minute: 0,
        half,
        type: "info",
        text: pickMisfitCommentary(m.playerName, m.slotRole),
        team: misfitTeam,
        playerName: m.playerName,
      });
    }
  }

  const momBonus = attacking === "home" ? momentum : -momentum;

  const atkRc = ratingCtx(ctx, attacking);
  const defTeamSide = attacking === "home" ? "away" : "home";
  const defRc = ratingCtx(ctx, defTeamSide);

  // --- Set piece (free kick) from prior foul ---
  if (pendingSetPiece?.team === attacking) {
    return resolveFreeKick(ctx, events, half, momBonus, atkRc, defRc);
  }

  atkStats.possessionPhases++;

  // --- Phase 1+2: Build-up (midfield + progression combined) ---
  const atkMids = playersByZone(atkLineup, "mid");
  const defMids = playersByZone(defLineup, "mid");
  let atkBuild =
    avgRating(atkMids.map((p) => effectiveRating(p, atkStamina, atkForm, 0, atkRc, atkSetup))) +
    FORMATION_ZONE_MOD[atkForm].mid * 0.4 +
    avgRating(
      atkMids.concat(playersByZone(atkLineup, "att").slice(0, 2)).map((p) =>
        effectiveRating(p, atkStamina, atkForm, 0, atkRc, atkSetup)
      )
    ) *
      0.35 +
    5;
  let defBuild =
    avgRating(defMids.map((p) => effectiveRating(p, defStamina, defForm, 0, defRc, defSetup))) +
    FORMATION_ZONE_MOD[defForm].mid * 0.4 +
    avgRating(
      defMids.concat(playersByZone(defLineup, "def").filter((p) => p.role !== "GK")).map((p) =>
        effectiveRating(p, defStamina, defForm, 0, defRc, defSetup)
      )
    ) *
      0.35 +
    3;

  const defTeam = attacking === "home" ? "away" : "home";
  const atkTactics = activeTactics(ctx, attacking);
  const defTactics = activeTactics(ctx, defTeam);

  if (atkTactics) {
    let mod = applyBuildUpMod(atkTactics.buildUp, atkBuild, defBuild);
    atkBuild = mod.atkBuild;
    defBuild = mod.defBuild;
    mod = applyAttackingShapeMod(atkTactics.defensiveShape, atkBuild, defBuild);
    atkBuild = mod.atkBuild;
    defBuild = mod.defBuild;
  }

  if (ctx.inStoppageTime) {
    const et = applyExtraTimeBuildMod(
      attacking,
      ctx.homeExtraTimeApproach,
      ctx.awayExtraTimeApproach,
      atkBuild,
      defBuild
    );
    atkBuild = et.atkBuild;
    defBuild = et.defBuild;
  }

  const turnoverBase =
    0.048 -
    (traitForTeam(ctx, attacking).pressBonus ?? 0) * 0.15 +
    (atkTactics ? buildUpTurnoverMod(atkTactics.buildUp) : 0) +
    (defTactics ? pressTurnoverMod(defTactics.defensiveShape, true) : 0);

  if (!rollDuel(atkBuild, defBuild, turnoverBase)) {
    defStats.possessionPhases++;
    const breaker = defMids.length ? pick(defMids) : pick(defLineup);
    recordTackle(playerStatsMap(ctx, defTeamSide), breaker.name, true);
    for (const m of atkMids.slice(0, 2)) {
      recordPass(playerStatsMap(ctx, attacking), m.name, false);
    }
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

  const channel = pickAttackChannelForTactics(() => pickAttackChannel(atkForm), atkTactics ?? null);
  const striker = pickAttacker(atkLineup, channel);
  mentionPhase(ctx, striker.name);

  if (defTactics) {
    const channelDef = applyDefensiveShapeMod(defTactics.defensiveShape, channel, atkBuild, defBuild);
    atkBuild = channelDef.atkBuild;
    defBuild = channelDef.defBuild;
  }

  const tacticLine = atkTactics
    ? maybeTacticalPhaseCommentary(atkTactics, channel, striker.name, striker.role)
    : null;
  if (tacticLine) {
    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: "info",
      text: tacticLine,
      team: attacking,
      playerName: striker.name,
    });
  }

  const playmaker = atkMids.length ? pick(atkMids) : pick(atkLineup);
  ctx.playmaker = playmaker.name;
  recordPass(playerStatsMap(ctx, attacking), playmaker.name, true);
  recordDribble(playerStatsMap(ctx, attacking), playmaker.name, Math.random() < 0.55);
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
    recordPass(playerStatsMap(ctx, attacking), crosser.name, true);
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
  let atkR =
    effectiveRating(striker, atkStamina, atkForm, 2, atkRc, atkSetup) +
    2 +
    roleTacticRatingBonus(striker.role, channel, atkTactics ?? null);
  const defR =
    effectiveRating(defender, defStamina, defForm, FORMATION_ZONE_MOD[defForm].def * 0.4, defRc, defSetup) +
    FORMATION_ZONE_MOD[defForm].def * 0.4 +
    defensiveRoleTacticBonus(defender.role, channel, defTactics ?? null);

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
  const foulProb = applyTraitFoulBias(
    defTrait,
    winProbability(atkR, defR, 0.04 + (defTactics ? defensiveShapeFoulMod(defTactics.defensiveShape) : 0))
  );
  if (foulRoll && Math.random() < foulProb) {
    defStats.foulsCommitted++;
    const gk = defLineup.find((p) => p.role === "GK") ?? defLineup[0];
    // Late attack-phase foul — any player on the ball can be fouled in the box.
    const penaltyInBox = Math.random() < 0.38;
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
    if (Math.random() < 0.34) {
      recordCard(ctx, defTeam, defender.name, events, half);
    }
    return events;
  }

  if (!rollDuel(atkR, defR, 0.057)) {
    const defMap = playerStatsMap(ctx, defTeamSide);
    if (Math.random() < 0.35) {
      recordClearance(defMap, defender.name);
    } else {
      recordTackle(defMap, defender.name, true);
      recordShotBlocked(defMap, defender.name);
    }
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
  xg = applyChanceCreationXgMod(atkTactics ?? null, channel, xg);
  if (ctx.inStoppageTime) {
    xg = applyExtraTimeXgMod(
      attacking,
      ctx.homeExtraTimeApproach,
      ctx.awayExtraTimeApproach,
      xg
    );
  }
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

  return resolveShot(
    events,
    ctx,
    striker,
    atkLineup,
    defLineup,
    xg,
    atkStats,
    defStats,
    attacking,
    half
  );
}

function pickFreeKickTaker(lineup: ResolvedPlayer[]): ResolvedPlayer {
  return lineup.reduce((best, p) => {
    const score = p.stats.passing * 0.55 + p.stats.power * 0.45;
    const bestScore = best.stats.passing * 0.55 + best.stats.power * 0.45;
    return score > bestScore ? p : best;
  }, lineup[0]);
}

function pickFreeKickStyle(taker: ResolvedPlayer): "direct" | "cross" {
  const passingBias = taker.stats.passing / 100;
  const powerBias = taker.stats.power / 100;
  const crossChance = 0.22 + passingBias * 0.38 - powerBias * 0.08;
  return Math.random() < crossChance ? "cross" : "direct";
}

interface ShotContext {
  freeKick?: "direct" | "header";
  freeKickTaker?: string;
}

function resolveFreeKick(
  ctx: AttackContext,
  events: CommentaryEvent[],
  half: 1 | 2,
  momBonus: number,
  atkRc: ReturnType<typeof ratingCtx>,
  defRc: ReturnType<typeof ratingCtx>
): CommentaryEvent[] {
  const { attacking, pendingSetPiece } = ctx;
  const {
    atkLineup,
    defLineup,
    atkForm,
    defForm,
    atkStamina,
    defStamina,
    atkStats,
    defStats,
    atkName,
    atkSetup,
    defSetup,
  } = atkDef(ctx);

  const taker = pickFreeKickTaker(atkLineup);
  const wall = pickDefender(defLineup, "center", taker);
  const style = pickFreeKickStyle(taker);
  const xgBonus = pendingSetPiece?.xgBonus ?? 0.14;

  ctx.freekickTaker = taker.name;
  ctx.playmaker = taker.name;
  mentionPhase(ctx, taker.name);

  let atkR = effectiveRating(taker, atkStamina, atkForm, 4, atkRc, atkSetup);
  const defR = effectiveRating(wall, defStamina, defForm, 0, defRc, defSetup);

  const capTicks = attacking === "home" ? ctx.homeCaptainBoostTicks : ctx.awayCaptainBoostTicks;
  const captain = attacking === "home" ? ctx.homeCaptain : ctx.awayCaptain;
  const capHalf = attacking === "home" ? ctx.homeCaptainHalf : ctx.awayCaptainHalf;
  atkR += captainDuelBonus(captain, capHalf, half, capTicks, taker.name);

  atkStats.possessionPhases++;

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
  ctx.pendingSetPiece = null;

  if (style === "cross") {
    const headerPick = pickHeaderThreat(atkLineup);
    const header = atkLineup.find((p) => p.name === headerPick.name) ?? atkLineup[0];
    mentionPhase(ctx, header.name);
    ctx.crosser = taker.name;
    recordPass(playerStatsMap(ctx, attacking), taker.name, true);

    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: "cross",
      text: commLine(
        ctx,
        "freekick_cross",
        { team: atkName, taker: taker.name, target: header.name },
        taker.name
      ),
      team: attacking,
    });

    const headerR = effectiveRating(header, atkStamina, atkForm, 2, atkRc, atkSetup);
    const gk = defLineup.find((p) => p.role === "GK") ?? defLineup[0];
    const gkR = effectiveRating(
      gk,
      defStamina,
      attacking === "home" ? ctx.awayFormation : ctx.homeFormation,
      0,
      defRc,
      defSetup
    );
    let headerXg =
      0.1 +
      (headerR - gkR) * 0.004 +
      (taker.stats.passing / 100) * 0.1 +
      xgBonus * 0.5;
    headerXg = applyTraitToXg(traitForTeam(ctx, attacking), headerXg, true);
    headerXg = Math.max(0.11, Math.min(0.34, headerXg));
    if (xgBonus >= 0.12) atkStats.chances++;

    atkStats.shots++;
    const result = resolveShot(
      events,
      ctx,
      header,
      atkLineup,
      defLineup,
      headerXg,
      atkStats,
      defStats,
      attacking,
      half,
      { freeKick: "header", freeKickTaker: taker.name }
    );
    ctx.freekickTaker = null;
    return result;
  }

  let xg = computeXg(atkR, defR, "center", atkStamina, taker, xgBonus + 0.14, momBonus);
  const atkTrait = traitForTeam(ctx, attacking);
  xg = applyTraitToXg(atkTrait, xg, true);
  xg = applyChanceCreationXgMod(activeTactics(ctx, attacking), "center", xg);
  if (ctx.inStoppageTime) {
    xg = applyExtraTimeXgMod(
      attacking,
      ctx.homeExtraTimeApproach,
      ctx.awayExtraTimeApproach,
      xg
    );
  }
  xg += captainXgBonus(captain, capHalf, half, capTicks, taker.name);
  xg = applyXgModifiers(ctx, attacking, xg);
  xg = Math.max(0.19, Math.min(0.48, xg));
  if (xg >= 0.12) atkStats.chances++;

  atkStats.shots++;
  const result = resolveShot(
    events,
    ctx,
    taker,
    atkLineup,
    defLineup,
    xg,
    atkStats,
    defStats,
    attacking,
    half,
    { freeKick: "direct", freeKickTaker: taker.name }
  );
  ctx.freekickTaker = null;
  return result;
}

function maybeQueueInteractiveCorner(
  ctx: AttackContext,
  attacking: "home" | "away",
  atkLineup: ResolvedPlayer[],
  gk: ResolvedPlayer
): boolean {
  const defending = attacking === "home" ? "away" : "home";
  if (
    !canUseCornerAttack(ctx.setPieceBudget, attacking) ||
    !canUseCornerDefend(ctx.setPieceBudget, defending)
  ) {
    return false;
  }
  const header = pickHeaderThreat(atkLineup);
  const cornerTaker = pickCornerTaker(atkLineup);
  ctx.setPieceTrigger = {
    kind: "corner",
    attacking,
    taker: header.name,
    keeper: gk.name,
    cornerTaker: cornerTaker.name,
  };
  return true;
}

function resolveShot(
  events: CommentaryEvent[],
  ctx: AttackContext,
  striker: ResolvedPlayer,
  atkLineup: ResolvedPlayer[],
  defLineup: ResolvedPlayer[],
  xg: number,
  atkStats: TeamMatchStats,
  defStats: TeamMatchStats,
  attacking: "home" | "away",
  half: 1 | 2,
  shotContext?: ShotContext
): CommentaryEvent[] {
  const defSide = attacking === "home" ? "away" : "home";
  const atkMap = playerStatsMap(ctx, attacking);
  const defMap = playerStatsMap(ctx, defSide);
  const defRc = ratingCtx(ctx, defSide);
  const atkSetup = attacking === "home" ? ctx.homeSetup : ctx.awaySetup;
  const defSetup = attacking === "home" ? ctx.awaySetup : ctx.homeSetup;
  const atkName = attacking === "home" ? ctx.homeName : ctx.awayName;
  const fromFreeKick = shotContext?.freeKick;

  const gk = defLineup.find((p) => p.role === "GK") ?? defLineup[0];
  const defStamina = attacking === "home" ? ctx.awayStamina : ctx.homeStamina;
  const gkR = effectiveRating(
    gk,
    defStamina,
    attacking === "home" ? ctx.awayFormation : ctx.homeFormation,
    0,
    defRc,
    defSetup
  );

  recordShot(atkMap, striker.name, false);

  const onTarget = rollChance(
    fromFreeKick === "direct"
      ? 0.68 + xg * 0.38
      : fromFreeKick === "header"
        ? 0.54 + xg * 0.44
        : 0.56 + xg * 0.48
  );
  if (!onTarget) {
    if (fromFreeKick === "header") {
      events.push({
        id: commentaryId(),
        minute: 0,
        half,
        type: "header",
        text: commLine(ctx, "header", { player: striker.name }, striker.name),
        team: attacking,
      });
    } else if (fromFreeKick === "direct") {
      events.push({
        id: commentaryId(),
        minute: 0,
        half,
        type: "freekick",
        text: commLine(
          ctx,
          "freekick_miss",
          { shooter: striker.name, team: atkName },
          striker.name
        ),
        team: attacking,
      });
    } else {
      const headerShot = Math.random() < 0.22;
      const headerPlayer = headerShot ? pickHeaderThreat(atkLineup) : striker;
      if (headerShot) {
        recordShot(atkMap, headerPlayer.name, false);
      }
      events.push({
        id: commentaryId(),
        minute: 0,
        half,
        type: headerShot ? "header" : "miss",
        text: headerShot
          ? commLine(ctx, "header", { player: headerPlayer.name }, headerPlayer.name)
          : commLine(ctx, "miss", { shooter: striker.name }, striker.name),
        team: attacking,
      });
    }
    if (Math.random() < 0.42) {
      if (!maybeQueueInteractiveCorner(ctx, attacking, atkLineup, gk)) {
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

  recordShot(atkMap, striker.name, true);
  atkStats.shotsOnTarget++;

  const strikerShot = roleRating(striker.stats, striker.role);
  const gkStopChance = winProbability(gkR, strikerShot, 0.065);
  let goalChance = xg * (0.92 - gkStopChance * 0.46);
  if (fromFreeKick === "direct") {
    goalChance = Math.min(0.46, goalChance * 1.08);
  }

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

    const assister =
      fromFreeKick === "header" && shotContext?.freeKickTaker && striker.name !== shotContext.freeKickTaker
        ? shotContext.freeKickTaker
        : resolveAssist(
            striker.name,
            ctx.phaseMentions,
            ctx.playmaker,
            ctx.crosser,
            ctx.freekickTaker
          );
    recordGoal(atkMap, striker.name);
    if (assister) recordAssist(atkMap, assister);

    const goalText =
      fromFreeKick === "direct"
        ? commLine(
            ctx,
            "freekick_goal",
            { scorer: striker.name, team: atkName },
            striker.name
          )
        : fromFreeKick === "header" && shotContext?.freeKickTaker
          ? commLine(
              ctx,
              "freekick_header_goal",
              {
                scorer: striker.name,
                taker: shotContext.freeKickTaker,
                team: atkName,
              },
              striker.name
            )
          : commLine(
              ctx,
              "goal",
              { scorer: striker.name, team: atkName },
              striker.name
            );

    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: "goal",
      text: goalText,
      team: attacking,
      playerName: striker.name,
      assistPlayerName: assister ?? undefined,
    });
  } else {
    defStats.saves++;
    recordSave(defMap, gk.name);
    events.push({
      id: commentaryId(),
      minute: 0,
      half,
      type: fromFreeKick ? "freekick" : "save",
      text: fromFreeKick
        ? commLine(
            ctx,
            "freekick_save",
            { gk: gk.name, shooter: striker.name },
            gk.name
          )
        : commLine(ctx, "save", { gk: gk.name, shooter: striker.name }, gk.name),
      team: attacking,
    });
    if (Math.random() < 0.32) {
      if (!maybeQueueInteractiveCorner(ctx, attacking, atkLineup, gk)) {
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

function endSecondHalf(
  newState: MatchState,
  home: TeamSetup,
  away: TeamSetup,
  homeLineup: ReturnType<typeof resolveLineup>,
  awayLineup: ReturnType<typeof resolveLineup>,
  endMinute: number,
  events: CommentaryEvent[]
): TickResult {
  const homeName = getUniverse(home.universeId)?.name ?? "Home";
  const awayName = getUniverse(away.universeId)?.name ?? "Away";
  const endSession = createCommentarySession(
    newState,
    endMinute,
    2,
    newState.momentum,
    homeName,
    awayName
  );
  const scoreVars = {
    homeScore: String(newState.score.home),
    awayScore: String(newState.score.away),
  };

  const isCupKnockoutDraw =
    newState.score.home === newState.score.away && newState.tournamentMeta?.cupKnockout;

  if (isCupKnockoutDraw && newState.tournamentMeta?.penaltyMode === "interactive") {
    const decider = beginCupPenaltyShootout(newState, home, away);
    const ftLine = say(endSession, "fulltime", scoreVars);
    events.push({
      id: commentaryId(),
      minute: endMinute,
      half: 2,
      type: "fulltime",
      text: `${ftLine} — penalties to decide the tie.`,
    });
    decider.recentCommentaryLines = syncCommentaryMemory(endSession);
    decider.commentary = [...decider.commentary, ...events];
    return { state: decider, events };
  }

  if (isCupKnockoutDraw && newState.tournamentMeta?.penaltyMode === "sim") {
    const ps = simulatedShootoutResult();
    newState.status = "finished";
    newState.penaltyShootout = ps;
    const ftLine = say(endSession, "fulltime", scoreVars);
    events.push({
      id: commentaryId(),
      minute: endMinute,
      half: 2,
      type: "fulltime",
      text: `${ftLine} — penalties ${ps.home}-${ps.away}.`,
    });
    newState.recentCommentaryLines = syncCommentaryMemory(endSession);
    newState.commentary.push(...events);
    return { state: newState, events };
  }

  newState.status = "finished";
  const ftText = say(endSession, "fulltime", scoreVars);
  events.push({
    id: commentaryId(),
    minute: endMinute,
    half: 2,
    type: "fulltime",
    text: ftText,
  });
  newState.recentCommentaryLines = syncCommentaryMemory(endSession);
  newState.commentary.push(...events);
  return { state: newState, events };
}

function runSimTick(
  newState: MatchState,
  home: TeamSetup,
  away: TeamSetup,
  homeLineup: ReturnType<typeof resolveLineup>,
  awayLineup: ReturnType<typeof resolveLineup>,
  half: 1 | 2,
  tick: number,
  stoppageTick: number
): TickResult {
  const events: CommentaryEvent[] = [];
  const inStoppage = newState.inStoppageTime;
  const attackingTeam: "home" | "away" = inStoppage
    ? stoppageTick % 2 === 0
      ? "home"
      : "away"
    : tick % 2 === 0
      ? "home"
      : "away";

  drainTeamsForTick(homeLineup, awayLineup, newState.homeStamina, newState.awayStamina, attackingTeam);
  const homeName = getUniverse(home.universeId)?.name ?? "Home";
  const awayName = getUniverse(away.universeId)?.name ?? "Away";
  const clockMinute = inStoppage
    ? stoppageClockDisplay(stoppageTick).minute
    : minuteFromTick(half, tick);

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
    currentMinute: clockMinute,
    specialCooldown: newState.specialCooldown,
    homePlayerStats: newState.homePlayerStats,
    awayPlayerStats: newState.awayPlayerStats,
    playerForm: newState.playerForm ?? {},
    inStoppageTime: inStoppage,
    homeExtraTimeApproach: newState.homeExtraTimeApproach,
    awayExtraTimeApproach: newState.awayExtraTimeApproach,
    homeTactics: newState.homeTactics,
    awayTactics: newState.awayTactics,
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
    homeSetup: home,
    awaySetup: away,
    setPieceBudget: newState.setPieceBudget ?? defaultSetPieceBudget(),
    comm: createCommentarySession(
      newState,
      clockMinute,
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

  for (const e of phaseEvents) {
    newState.stoppageCount += stoppageWeightForEvent(e.type);
  }

  if (attackCtx.setPieceTrigger) {
    const trigger = attackCtx.setPieceTrigger;
    newState.stoppageCount += stoppageWeightForEvent(
      trigger.kind === "penalty" ? "penalty" : "corner"
    );
    if (inStoppage) {
      spreadStoppageEventMinutes(phaseEvents, stoppageTick);
    } else {
      spreadEventMinutes(phaseEvents, half, tick);
    }
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
    inStoppage ? 0.18 : 0.12
  );
  if (amb) phaseEvents.push(amb);

  if (inStoppage) {
    spreadStoppageEventMinutes(phaseEvents, stoppageTick);
  } else {
    spreadEventMinutes(phaseEvents, half, tick);
  }

  newState.recentCommentaryLines = syncCommentaryMemory(attackCtx.comm);
  newState.commentary.push(...phaseEvents);

  simulateBackgroundMatchTick(
    home.lineup,
    away.lineup,
    newState.homeUniverseId,
    newState.awayUniverseId,
    newState.homePlayerStats,
    newState.awayPlayerStats,
    attackingTeam
  );

  return { state: newState, events: phaseEvents };
}

export function processTick(state: MatchState, home: TeamSetup, away: TeamSetup): TickResult {
  state = normalizeMatchState(state);

  if (
    state.status === "finished" ||
    state.status === "halftime" ||
    state.status === "sub_window" ||
    state.status === "set_piece_pause" ||
    state.status === "extra_time_choice" ||
    (state.penaltyShootout && state.status === "running")
  ) {
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
    stoppageCount: state.stoppageCount ?? 0,
    stoppageMinutes: state.stoppageMinutes ?? 0,
    stoppageTick: state.stoppageTick ?? 0,
    inStoppageTime: state.inStoppageTime ?? false,
    homeExtraTimeApproach: state.homeExtraTimeApproach ?? null,
    awayExtraTimeApproach: state.awayExtraTimeApproach ?? null,
  };

  if (newState.homeCaptainBoostTicks > 0) newState.homeCaptainBoostTicks--;
  if (newState.awayCaptainBoostTicks > 0) newState.awayCaptainBoostTicks--;
  const events: CommentaryEvent[] = [];

  if (newState.inStoppageTime) {
    const nextStoppageTick = newState.stoppageTick + 1;
    const maxTicks = newState.stoppageMinutes * TICKS_PER_STOPPAGE_MINUTE;
    if (nextStoppageTick > maxTicks) {
      const endMinute = stoppageClockDisplay(newState.stoppageTick).minute;
      return endSecondHalf(newState, home, away, homeLineup, awayLineup, endMinute, events);
    }
    newState.stoppageTick = nextStoppageTick;
    newState.status = "running";
    return runSimTick(newState, home, away, homeLineup, awayLineup, 2, newState.tick, nextStoppageTick);
  }

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

    const added = computeStoppageMinutes(newState.stoppageCount, newState.score);
    newState.stoppageMinutes = added;
    newState.status = "extra_time_choice";
    newState.tick = TICKS_PER_HALF;
    events.push({
      id: commentaryId(),
      minute: 90,
      half: 2,
      type: "stoppage",
      text: `The fourth official indicates ${added} minute${added === 1 ? "" : "s"} of added time.`,
    });
    newState.recentCommentaryLines = syncCommentaryMemory(endSession);
    newState.commentary.push(...events);
    return { state: newState, events };
  }

  newState.tick = tick;
  newState.status = "running";
  return runSimTick(newState, home, away, homeLineup, awayLineup, half, tick, 0);
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
