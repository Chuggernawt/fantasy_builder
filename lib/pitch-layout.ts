import type { FormationId } from "./types";

/** Pitch coordinates in % — x across, y from own goal (bottom) to opponent goal (top). */
export type PitchCoord = { x: number; y: number };

const LAYOUTS: Record<FormationId, Record<string, PitchCoord>> = {
  "4-4-2": {
    gk: { x: 50, y: 90 },
    cb1: { x: 36, y: 72 },
    cb2: { x: 64, y: 72 },
    fb1: { x: 14, y: 62 },
    fb2: { x: 86, y: 62 },
    cm1: { x: 36, y: 46 },
    cm2: { x: 64, y: 46 },
    w1: { x: 14, y: 28 },
    w2: { x: 86, y: 28 },
    st1: { x: 38, y: 12 },
    st2: { x: 62, y: 12 },
  },
  "4-3-3": {
    gk: { x: 50, y: 90 },
    cb1: { x: 36, y: 72 },
    cb2: { x: 64, y: 72 },
    fb1: { x: 14, y: 62 },
    fb2: { x: 86, y: 62 },
    cm1: { x: 28, y: 44 },
    cm2: { x: 50, y: 48 },
    cm3: { x: 72, y: 44 },
    w1: { x: 14, y: 22 },
    w2: { x: 86, y: 22 },
    st1: { x: 50, y: 10 },
  },
  "4-2-3-1": {
    gk: { x: 50, y: 90 },
    cb1: { x: 36, y: 72 },
    cb2: { x: 64, y: 72 },
    fb1: { x: 14, y: 62 },
    fb2: { x: 86, y: 62 },
    dm1: { x: 38, y: 52 },
    dm2: { x: 62, y: 52 },
    am1: { x: 18, y: 30 },
    am2: { x: 50, y: 26 },
    am3: { x: 82, y: 30 },
    st1: { x: 50, y: 10 },
  },
  "3-5-2": {
    gk: { x: 50, y: 90 },
    cb1: { x: 28, y: 72 },
    cb2: { x: 50, y: 74 },
    cb3: { x: 72, y: 72 },
    fb1: { x: 10, y: 54 },
    fb2: { x: 90, y: 54 },
    cm1: { x: 28, y: 40 },
    cm2: { x: 50, y: 44 },
    cm3: { x: 72, y: 40 },
    st1: { x: 38, y: 12 },
    st2: { x: 62, y: 12 },
  },
  "5-3-2": {
    gk: { x: 50, y: 90 },
    cb1: { x: 22, y: 72 },
    cb2: { x: 50, y: 75 },
    cb3: { x: 78, y: 72 },
    fb1: { x: 8, y: 58 },
    fb2: { x: 92, y: 58 },
    cm1: { x: 30, y: 42 },
    cm2: { x: 50, y: 46 },
    cm3: { x: 70, y: 42 },
    st1: { x: 38, y: 12 },
    st2: { x: 62, y: 12 },
  },
};

export function getPitchCoord(formationId: FormationId, slotId: string): PitchCoord {
  return LAYOUTS[formationId][slotId] ?? { x: 50, y: 50 };
}
