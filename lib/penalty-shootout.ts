import type { LineupSlot, MatchState, PenaltyShootoutState, TeamSetup } from "./types";
import { commentaryId } from "./simulation-utils";

const SHOOTOUT_CHOOSE_MS = 10_000;

export function initialPenaltyShootout(): PenaltyShootoutState {
  return { home: 0, away: 0, homeTaken: 0, awayTaken: 0, nextShooter: "home", homeKicks: [], awayKicks: [] };
}

function randomKick(): boolean {
  return Math.random() < 0.8;
}

/** Build a valid simulated shootout with alternating kicks until a winner. */
export function simulatedShootoutResult(): PenaltyShootoutState {
  let ps = initialPenaltyShootout();
  while (!shootoutWinner(ps)) {
    const attacking = ps.nextShooter;
    ps = recordShootoutKick(ps, attacking, randomKick());
  }
  return ps;
}

/**
 * FIFA-style shootout winner:
 * - During the first 5 each: mathematical elimination if the trailing side cannot catch up.
 * - After 5 each: if scores differ, winner; if tied, sudden death until both have kicked
 *   the same number of times in the extra round and scores differ.
 */
export function shootoutWinner(ps: PenaltyShootoutState): "home" | "away" | null {
  const h = ps.homeTaken;
  const a = ps.awayTaken;

  if (h !== a) {
    const homeRem = Math.max(0, 5 - h);
    const awayRem = Math.max(0, 5 - a);
    if (h <= 5 && a <= 5) {
      if (ps.home > ps.away + awayRem) return "home";
      if (ps.away > ps.home + homeRem) return "away";
    }
    return null;
  }

  if (h === 0) return null;

  if (h >= 5 && ps.home !== ps.away) {
    return ps.home > ps.away ? "home" : "away";
  }

  return null;
}

export function recordShootoutKick(
  ps: PenaltyShootoutState,
  attacking: "home" | "away",
  scored: boolean
): PenaltyShootoutState {
  const kick = scored ? ("goal" as const) : ("miss" as const);
  const next: PenaltyShootoutState = {
    ...ps,
    nextShooter: attacking === "home" ? "away" : "home",
    homeKicks: attacking === "home" ? [...(ps.homeKicks ?? []), kick] : ps.homeKicks ?? [],
    awayKicks: attacking === "away" ? [...(ps.awayKicks ?? []), kick] : ps.awayKicks ?? [],
  };
  if (scored) {
    if (attacking === "home") next.home++;
    else next.away++;
  }
  if (attacking === "home") next.homeTaken++;
  else next.awayTaken++;
  return next;
}

function pickShooter(lineup: LineupSlot[], kickIndex: number): string {
  const outfield = lineup.filter((s) => s.playerName && s.role !== "GK");
  if (!outfield.length) {
    const any = lineup.find((s) => s.playerName);
    return any?.playerName ?? "?";
  }
  return outfield[kickIndex % outfield.length]?.playerName ?? outfield[0].playerName!;
}

function pickKeeper(lineup: LineupSlot[]): string {
  const filled = lineup.filter((s) => s.playerName);
  return filled.find((s) => s.role === "GK")?.playerName ?? filled[0]?.playerName ?? "?";
}

export function beginCupPenaltyShootout(
  state: MatchState,
  home: TeamSetup,
  away: TeamSetup
): MatchState {
  const withShootout: MatchState = {
    ...state,
    penaltyShootout: initialPenaltyShootout(),
  };
  return beginShootoutKick(withShootout, home, away);
}

export function beginShootoutKick(
  state: MatchState,
  home: TeamSetup,
  away: TeamSetup
): MatchState {
  const ps = state.penaltyShootout ?? initialPenaltyShootout();
  const attacking = ps.nextShooter;
  const atkSetup = attacking === "home" ? home : away;
  const defSetup = attacking === "home" ? away : home;
  const kickIndex = attacking === "home" ? ps.homeTaken : ps.awayTaken;
  const taker = pickShooter(atkSetup.lineup, kickIndex);
  const keeper = pickKeeper(defSetup.lineup);

  return {
    ...state,
    status: "set_piece_pause",
    penaltyShootout: ps,
    interactiveSetPiece: {
      kind: "penalty",
      attacking,
      phase: "choose",
      chooseEndsAt: new Date(Date.now() + SHOOTOUT_CHOOSE_MS).toISOString(),
      taker,
      keeper,
      shootoutDecider: true,
    },
  };
}

function shootoutCommentary(
  state: MatchState,
  attacking: "home" | "away",
  scored: boolean,
  taker: string,
  ps: PenaltyShootoutState
): MatchState["commentary"] {
  const minute = state.half === 1 ? 45 : 90;
  const tally = `${ps.home}-${ps.away} on pens`;
  const text = scored
    ? `Shootout: ${taker} scores! (${tally})`
    : `Shootout: ${taker} misses. (${tally})`;
  return [
    ...state.commentary,
    {
      id: commentaryId(),
      minute,
      half: state.half,
      type: "penalty" as const,
      text,
      team: attacking,
      playerName: taker,
    },
  ];
}

export function advancePenaltyShootout(
  state: MatchState,
  home: TeamSetup,
  away: TeamSetup,
  attacking: "home" | "away",
  scored: boolean
): MatchState {
  const piece = state.interactiveSetPiece;
  const ps = state.penaltyShootout ?? initialPenaltyShootout();
  const kickSide = piece?.attacking ?? attacking;
  const nextPs = recordShootoutKick(ps, kickSide, scored);
  const taker = piece?.taker ?? "?";
  const commentary = shootoutCommentary(state, kickSide, scored, taker, nextPs);
  const winner = shootoutWinner(nextPs);

  if (winner) {
    return {
      ...state,
      status: "finished",
      penaltyShootout: nextPs,
      interactiveSetPiece: null,
      commentary,
    };
  }

  return beginShootoutKick(
    {
      ...state,
      penaltyShootout: nextPs,
      interactiveSetPiece: null,
      commentary,
    },
    home,
    away
  );
}

/** Regulation draw decided on penalties — not a true draw. */
export function matchDecidedWinner(state: MatchState): "home" | "away" | "draw" {
  const ps = state.penaltyShootout;
  if (ps && state.status === "finished") {
    if (ps.home > ps.away) return "home";
    if (ps.away > ps.home) return "away";
  }
  if (state.score.home > state.score.away) return "home";
  if (state.score.away > state.score.home) return "away";
  return "draw";
}

export function shootoutDisplaySlots(kicks: ("goal" | "miss")[] | undefined, taken: number): number {
  const count = kicks?.length ?? taken;
  return Math.max(5, count);
}
