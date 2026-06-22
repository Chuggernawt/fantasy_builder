import type { InteractiveSetPiece, MatchState, SetPieceBudget } from "./types";
import { defaultSetPieceBudget } from "./types";
import { getPlayer } from "./squads";
import { roleRating } from "./stats";
import { commentaryId } from "./simulation-utils";
import { recordAssist, recordGoal } from "./player-match-stats";
import { stoppageClockDisplay } from "./stoppage-time";
import { advancePenaltyShootout } from "./penalty-shootout";
import { getHomeMatchSetup, getAwayMatchSetup } from "./player-side";

export const SET_PIECE_CHOOSE_MS = 10_000;
export const SET_PIECE_REVEAL_MS = 5_000;

const CORNER_ATTACK_OPTIONS = ["In-swinger", "Out-swinger", "In the Mixer"] as const;
const CORNER_DEFEND_OPTIONS = ["Focus near post", "Focus far post", "Keeper claim"] as const;
const PEN_ATTACK_OPTIONS = ["Shoot left", "Shoot middle", "Shoot right"] as const;
const PEN_DEFEND_OPTIONS = ["Dive left", "Stay center", "Dive right"] as const;

export function setPieceAttackOptions(kind: "corner" | "penalty"): readonly string[] {
  return kind === "corner" ? CORNER_ATTACK_OPTIONS : PEN_ATTACK_OPTIONS;
}

export function setPieceDefendOptions(kind: "corner" | "penalty"): readonly string[] {
  return kind === "corner" ? CORNER_DEFEND_OPTIONS : PEN_DEFEND_OPTIONS;
}

function playerAbility(universeId: string, name: string, kind: "outfield" | "gk"): number {
  const p = getPlayer(universeId, name);
  if (!p) return 50;
  if (kind === "gk") return roleRating(p.stats, "GK");
  return (p.stats.pace + p.stats.power + p.stats.passing) / 3;
}

function clamp01(n: number): number {
  return Math.max(0.02, Math.min(0.98, n));
}

export function resolveCornerChance(
  atkUni: string,
  defUni: string,
  taker: string,
  keeper: string,
  cornerTaker: string,
  atkChoice: number,
  defChoice: number
): number {
  if (atkChoice === defChoice) return 0;

  const atk =
    playerAbility(atkUni, taker, "outfield") * 0.55 +
    playerAbility(atkUni, cornerTaker, "outfield") * 0.45;
  const def =
    playerAbility(defUni, keeper, "gk") * 0.7 + playerAbility(defUni, taker, "outfield") * 0.3;
  const edge = (atk - def) / 120;
  return clamp01(0.15 + edge + 0.1);
}

export function resolvePenaltyChance(
  atkUni: string,
  defUni: string,
  taker: string,
  keeper: string,
  atkChoice: number,
  defChoice: number
): number {
  const takerR = playerAbility(atkUni, taker, "outfield");
  const keeperR = playerAbility(defUni, keeper, "gk");
  const skillEdge = (takerR - keeperR) / 200;

  // Tuned for ~80% conversion vs random CPU (1/3 same-zone, 2/9 keeper central, 4/9 wrong dive).
  if (atkChoice === defChoice) return clamp01(0.5 - skillEdge);
  if (defChoice === 2 && (atkChoice === 1 || atkChoice === 3)) return clamp01(0.92 + skillEdge);
  if (atkChoice !== defChoice) return clamp01(0.96 + skillEdge);
  return clamp01(0.5);
}

export function canUseCornerAttack(budget: SetPieceBudget, team: "home" | "away"): boolean {
  return !budget[team].attackCorner;
}

export function canUseCornerDefend(budget: SetPieceBudget, team: "home" | "away"): boolean {
  return !budget[team].defendCorner;
}

export function markCornerUsed(
  budget: SetPieceBudget,
  attacking: "home" | "away"
): SetPieceBudget {
  const defending = attacking === "home" ? "away" : "home";
  return {
    ...budget,
    [attacking]: { ...budget[attacking], attackCorner: true },
    [defending]: { ...budget[defending], defendCorner: true },
  };
}

export function beginInteractiveSetPiece(
  state: MatchState,
  kind: "corner" | "penalty",
  attacking: "home" | "away",
  taker: string,
  keeper: string,
  cornerTaker?: string
): MatchState {
  const budget =
    kind === "corner" ? markCornerUsed(state.setPieceBudget, attacking) : state.setPieceBudget;

  const piece: InteractiveSetPiece = {
    kind,
    attacking,
    phase: "choose",
    chooseEndsAt: new Date(Date.now() + SET_PIECE_CHOOSE_MS).toISOString(),
    taker,
    keeper,
    cornerTaker: cornerTaker ?? taker,
  };

  return {
    ...state,
    status: "set_piece_pause",
    setPieceBudget: budget,
    interactiveSetPiece: piece,
  };
}

export function applySetPieceChoices(
  state: MatchState,
  atkChoice: number,
  defChoice: number
): MatchState {
  const piece = state.interactiveSetPiece;
  if (!piece || piece.phase !== "choose") return state;

  const attacking = piece.attacking;
  const defending = attacking === "home" ? "away" : "home";
  const atkUni = attacking === "home" ? state.homeUniverseId : state.awayUniverseId;
  const defUni = defending === "home" ? state.homeUniverseId : state.awayUniverseId;

  const goalChance =
    piece.kind === "corner"
      ? resolveCornerChance(
          atkUni,
          defUni,
          piece.taker,
          piece.keeper,
          piece.cornerTaker ?? piece.taker,
          atkChoice,
          defChoice
        )
      : resolvePenaltyChance(atkUni, defUni, piece.taker, piece.keeper, atkChoice, defChoice);

  const samePick = atkChoice === defChoice;
  const goalScored = samePick && piece.kind === "corner" ? false : Math.random() < goalChance;

  let resultText: string;
  if (piece.kind === "corner") {
    if (samePick) {
      resultText = `Corner defended — ${CORNER_DEFEND_OPTIONS[defChoice - 1]} matches ${CORNER_ATTACK_OPTIONS[atkChoice - 1]}.`;
    } else if (goalScored) {
      resultText = `GOAL from the corner! ${piece.taker} finishes after ${CORNER_ATTACK_OPTIONS[atkChoice - 1]}.`;
    } else {
      resultText = `Corner cleared — ${piece.keeper} deals with ${CORNER_ATTACK_OPTIONS[atkChoice - 1]}.`;
    }
  } else if (goalScored) {
    resultText = `PENALTY GOAL! ${piece.taker} — ${PEN_ATTACK_OPTIONS[atkChoice - 1]}.`;
  } else {
    resultText = `Penalty saved! ${piece.keeper} — ${PEN_DEFEND_OPTIONS[defChoice - 1]}.`;
  }

  return {
    ...state,
    interactiveSetPiece: {
      ...piece,
      phase: "reveal",
      attackerChoice: atkChoice,
      defenderChoice: defChoice,
      goalScored,
      resultText,
      revealEndsAt: new Date(Date.now() + SET_PIECE_REVEAL_MS).toISOString(),
    },
  };
}

export function mergeSetPiecePick(
  state: MatchState,
  isAttacker: boolean,
  choice: number
): MatchState {
  const piece = state.interactiveSetPiece;
  if (!piece || piece.phase !== "choose") return state;

  const withPick: InteractiveSetPiece = {
    ...piece,
    attackerPick: isAttacker ? choice : piece.attackerPick,
    defenderPick: isAttacker ? piece.defenderPick : choice,
  };

  if (withPick.attackerPick && withPick.defenderPick) {
    return applySetPieceChoices(state, withPick.attackerPick, withPick.defenderPick);
  }

  return { ...state, interactiveSetPiece: withPick };
}

export function setPieceChooseExpired(piece: InteractiveSetPiece): boolean {
  return Date.now() >= new Date(piece.chooseEndsAt).getTime();
}

export function setPieceRevealExpired(piece: InteractiveSetPiece): boolean {
  return !!piece.revealEndsAt && Date.now() >= new Date(piece.revealEndsAt).getTime();
}

export function cpuSetPieceChoice(): number {
  return 1 + Math.floor(Math.random() * 3);
}

export function setPieceTimeLeft(iso: string | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

export function matchEventMinute(state: MatchState): number {
  if (state.inStoppageTime && state.stoppageTick > 0) {
    return stoppageClockDisplay(state.stoppageTick).minute;
  }
  return state.half === 1
    ? Math.round((state.tick / state.ticksPerHalf) * 45)
    : Math.min(90, 45 + Math.round((state.tick / state.ticksPerHalf) * 45));
}

export function finalizeSetPieceReveal(state: MatchState): MatchState {
  const piece = state.interactiveSetPiece;
  if (!piece) return { ...state, status: "running", interactiveSetPiece: null };

  const isShootoutKick = !!piece.shootoutDecider;
  const attacking = piece.attacking;
  const score = { ...state.score };
  const commentary = [...state.commentary];
  const minute = matchEventMinute(state);

  if (piece.goalScored) {
    if (!isShootoutKick) {
      if (attacking === "home") score.home++;
      else score.away++;
    }
    const homePlayerStats = { ...state.homePlayerStats };
    const awayPlayerStats = { ...state.awayPlayerStats };
    if (!isShootoutKick) {
      const atkStats = attacking === "home" ? homePlayerStats : awayPlayerStats;
      recordGoal(atkStats, piece.taker);
      const cornerTaker = piece.cornerTaker;
      if (piece.kind === "corner" && cornerTaker && cornerTaker !== piece.taker) {
        recordAssist(atkStats, cornerTaker);
      }
    }
    commentary.push({
      id: commentaryId(),
      minute,
      half: state.half,
      type: piece.kind === "penalty" ? "penalty" : "goal",
      text: piece.resultText ?? "Goal!",
      team: attacking,
      playerName: piece.taker,
      assistPlayerName:
        !isShootoutKick &&
        piece.kind === "corner" &&
        piece.cornerTaker &&
        piece.cornerTaker !== piece.taker
          ? piece.cornerTaker
          : undefined,
    });

    if (isShootoutKick) {
      const home = getHomeMatchSetup();
      const away = getAwayMatchSetup();
      if (home && away) {
        return advancePenaltyShootout(
          { ...state, score, commentary, homePlayerStats, awayPlayerStats },
          home,
          away,
          attacking,
          true
        );
      }
    }

    return {
      ...state,
      status: "running",
      score,
      commentary,
      homePlayerStats,
      awayPlayerStats,
      interactiveSetPiece: null,
    };
  }

  if (piece.resultText) {
    commentary.push({
      id: commentaryId(),
      minute,
      half: state.half,
      type: piece.kind === "penalty" ? "penalty" : "corner",
      text: piece.resultText,
      team: attacking,
    });
  }

  if (isShootoutKick) {
    const home = getHomeMatchSetup();
    const away = getAwayMatchSetup();
    if (home && away) {
      return advancePenaltyShootout({ ...state, score, commentary }, home, away, attacking, false);
    }
  }

  return {
    ...state,
    status: "running",
    score,
    commentary,
    interactiveSetPiece: null,
  };
}

export function resetSetPieceBudgetForHalf(state: MatchState): MatchState {
  return { ...state, setPieceBudget: defaultSetPieceBudget() };
}
