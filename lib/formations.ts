import type { Formation, FormationId } from "./types";

function slots(...entries: [string, Formation["slots"][0]["role"], string][]): Formation["slots"] {
  return entries.map(([id, role, label]) => ({ id, role, label }));
}

export const FORMATIONS: Formation[] = [
  {
    id: "4-4-2",
    label: "4-4-2",
    slots: slots(
      ["gk", "GK", "GK"],
      ["cb1", "CB", "CB"],
      ["cb2", "CB", "CB"],
      ["fb1", "FB", "LB"],
      ["fb2", "FB", "RB"],
      ["cm1", "CM", "CM"],
      ["cm2", "CM", "CM"],
      ["w1", "W", "LW"],
      ["w2", "W", "RW"],
      ["st1", "ST", "ST"],
      ["st2", "ST", "ST"]
    ),
  },
  {
    id: "4-3-3",
    label: "4-3-3",
    slots: slots(
      ["gk", "GK", "GK"],
      ["cb1", "CB", "CB"],
      ["cb2", "CB", "CB"],
      ["fb1", "FB", "LB"],
      ["fb2", "FB", "RB"],
      ["cm1", "CM", "CM"],
      ["cm2", "CM", "CM"],
      ["cm3", "CM", "CM"],
      ["w1", "W", "LW"],
      ["w2", "W", "RW"],
      ["st1", "ST", "ST"]
    ),
  },
  {
    id: "4-2-3-1",
    label: "4-2-3-1",
    slots: slots(
      ["gk", "GK", "GK"],
      ["cb1", "CB", "CB"],
      ["cb2", "CB", "CB"],
      ["fb1", "FB", "LB"],
      ["fb2", "FB", "RB"],
      ["dm1", "DM", "DM"],
      ["dm2", "DM", "DM"],
      ["am1", "AM", "LAM"],
      ["am2", "AM", "CAM"],
      ["am3", "AM", "RAM"],
      ["st1", "ST", "ST"]
    ),
  },
  {
    id: "3-5-2",
    label: "3-5-2",
    slots: slots(
      ["gk", "GK", "GK"],
      ["cb1", "CB", "CB"],
      ["cb2", "CB", "CB"],
      ["cb3", "CB", "CB"],
      ["fb1", "FB", "LWB"],
      ["fb2", "FB", "RWB"],
      ["cm1", "CM", "CM"],
      ["cm2", "CM", "CM"],
      ["cm3", "CM", "CM"],
      ["st1", "ST", "ST"],
      ["st2", "ST", "ST"]
    ),
  },
  {
    id: "5-3-2",
    label: "5-3-2",
    slots: slots(
      ["gk", "GK", "GK"],
      ["cb1", "CB", "CB"],
      ["cb2", "CB", "CB"],
      ["cb3", "CB", "CB"],
      ["fb1", "FB", "LWB"],
      ["fb2", "FB", "RWB"],
      ["cm1", "CM", "CM"],
      ["cm2", "CM", "CM"],
      ["cm3", "CM", "CM"],
      ["st1", "ST", "ST"],
      ["st2", "ST", "ST"]
    ),
  },
];

export function getFormation(id: FormationId): Formation {
  const f = FORMATIONS.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown formation: ${id}`);
  return f;
}

export const DEFAULT_FORMATION: FormationId = "4-4-2";
