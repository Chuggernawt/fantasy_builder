import type { MatchState } from "./types";
import { defaultSetPieceBudget } from "./types";

/** Fill in fields added after older persisted saves. */
export function normalizeMatchState(state: MatchState): MatchState {
  return {
    ...state,
    homePlayerStats: state.homePlayerStats ?? {},
    awayPlayerStats: state.awayPlayerStats ?? {},
    homeTactic: state.homeTactic ?? null,
    awayTactic: state.awayTactic ?? null,
    homeTacticHalf: state.homeTacticHalf ?? 0,
    awayTacticHalf: state.awayTacticHalf ?? 0,
    homeCaptain: state.homeCaptain ?? null,
    awayCaptain: state.awayCaptain ?? null,
    homeCaptainHalf: state.homeCaptainHalf ?? 0,
    awayCaptainHalf: state.awayCaptainHalf ?? 0,
    homeCaptainBoostTicks: state.homeCaptainBoostTicks ?? 0,
    awayCaptainBoostTicks: state.awayCaptainBoostTicks ?? 0,
    setPieceBudget: state.setPieceBudget ?? defaultSetPieceBudget(),
    interactiveSetPiece: state.interactiveSetPiece ?? null,
    specialCooldown: state.specialCooldown ?? {},
    recentCommentaryLines: state.recentCommentaryLines ?? [],
    seasonMeta: state.seasonMeta,
  };
}
