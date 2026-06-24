import type { FormationId, LineupSlot } from "./types";

export type InjurySeverity = "impact" | "short" | "mid" | "long";
export type InjuryBodyPart =
  | "ankle"
  | "knee"
  | "calf"
  | "shoulder"
  | "rib"
  | "head"
  | "hamstring"
  | "groin";

export type InjuryIncident = "tackle" | "collision" | "sprint";

export const MAX_CONCURRENT_INJURIES = 11;
export const INJURY_UPGRADE_MINUTES = 20;

export interface PersistedPlayerInjury {
  universeId: string;
  playerName: string;
  severity: InjurySeverity;
  bodyPart: InjuryBodyPart;
  /** Fixtures remaining unavailable (0 = available). */
  gamesOut: number;
}

export interface ActiveMatchInjury {
  playerName: string;
  severity: InjurySeverity;
  bodyPart: InjuryBodyPart;
  occurredMinute: number;
  /** Upgraded once via the 20-minute rule. */
  upgraded: boolean;
  /** Player left the pitch — no further upgrades. */
  subbedOff: boolean;
}

export interface MatchInjuryReport {
  playerName: string;
  team: "home" | "away";
  severity: InjurySeverity;
  bodyPart: InjuryBodyPart;
  minute: number;
  /** Final severity at full time (after any upgrade). */
  finalSeverity: InjurySeverity;
  gamesOut: number;
}

export function injuryKey(universeId: string, playerName: string): string {
  return `${universeId}:${playerName}`;
}

export function parseInjuryKey(key: string): { universeId: string; playerName: string } | null {
  const idx = key.indexOf(":");
  if (idx <= 0) return null;
  return { universeId: key.slice(0, idx), playerName: key.slice(idx + 1) };
}

export function gamesOutForSeverity(severity: InjurySeverity): number {
  switch (severity) {
    case "impact":
      return 0;
    case "short":
      return 1;
    case "mid":
      return 3;
    case "long":
      return 5;
  }
}

export function upgradeSeverity(severity: InjurySeverity): InjurySeverity {
  switch (severity) {
    case "impact":
      return "short";
    case "short":
      return "mid";
    case "mid":
      return "long";
    case "long":
      return "long";
  }
}

export function severityLabel(severity: InjurySeverity): string {
  switch (severity) {
    case "impact":
      return "Impact";
    case "short":
      return "Short-term";
    case "mid":
      return "Mid-term";
    case "long":
      return "Long-term";
  }
}

export function bodyPartLabel(part: InjuryBodyPart): string {
  return part.charAt(0).toUpperCase() + part.slice(1);
}

/** Rating penalty while playing through an in-match injury. */
export function injuryEffectivenessMultiplier(severity: InjurySeverity): number {
  switch (severity) {
    case "impact":
      return 0.82;
    case "short":
      return 0.72;
    case "mid":
      return 0.62;
    case "long":
      return 0.55;
  }
}

const TACKLE_PARTS: InjuryBodyPart[] = ["ankle", "knee", "calf"];
const COLLISION_PARTS: InjuryBodyPart[] = ["shoulder", "rib", "head"];
const SPRINT_PARTS: InjuryBodyPart[] = ["hamstring", "groin", "calf"];

export function pickBodyPartForIncident(incident: InjuryIncident): InjuryBodyPart {
  const pool =
    incident === "tackle" ? TACKLE_PARTS : incident === "collision" ? COLLISION_PARTS : SPRINT_PARTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickInitialSeverity(): InjurySeverity {
  const r = Math.random();
  if (r < 0.42) return "impact";
  if (r < 0.72) return "short";
  if (r < 0.92) return "mid";
  return "long";
}

/** Base per-incident injury chance, scaled by stamina and role exposure. */
export function injuryRollChance(stamina: number, isSubstitute: boolean): number {
  const tired = Math.max(0, (100 - stamina) / 100);
  const base = isSubstitute ? 0.004 : 0.011;
  return base + tired * (isSubstitute ? 0.012 : 0.028);
}

export function countActiveInjuries(injuries: Record<string, PersistedPlayerInjury>): number {
  return Object.values(injuries).filter((i) => i.gamesOut > 0).length;
}

export function isPlayerInjuredOut(
  injuries: Record<string, PersistedPlayerInjury>,
  universeId: string,
  playerName: string
): boolean {
  const row = injuries[injuryKey(universeId, playerName)];
  return (row?.gamesOut ?? 0) > 0;
}

export function returnTimelineLabel(gamesOut: number): string {
  if (gamesOut <= 0) return "Available";
  if (gamesOut === 1) return "Out 1 match";
  return `Out ${gamesOut} matches`;
}

export function injuryCommentaryLine(
  playerName: string,
  bodyPart: InjuryBodyPart,
  severity: InjurySeverity
): string {
  const part = bodyPartLabel(bodyPart).toLowerCase();
  switch (severity) {
    case "impact":
      return `${playerName} is down — the medical team are checking that ${part}.`;
    case "short":
      return `${playerName} looks in real discomfort — that ${part} could be a problem.`;
    case "mid":
      return `Concern for ${playerName} — the ${part} injury looks serious.`;
    case "long":
      return `${playerName} is in agony. That ${part} does not look good at all.`;
  }
}

export function injuryUpgradeCommentary(playerName: string, bodyPart: InjuryBodyPart): string {
  return `${playerName} is still struggling — the ${bodyPartLabel(bodyPart).toLowerCase()} is getting worse. They need to come off.`;
}

export function doctorReportLine(injury: MatchInjuryReport | PersistedPlayerInjury): string {
  const sev = "finalSeverity" in injury ? injury.finalSeverity : injury.severity;
  const name = injury.playerName;
  const part = bodyPartLabel(injury.bodyPart);
  const games = "gamesOut" in injury ? injury.gamesOut : gamesOutForSeverity(sev);
  if (games <= 0) {
    return `${name} — ${part} (${severityLabel(sev)}): cleared for the next fixture after treatment.`;
  }
  return `${name} — ${part} (${severityLabel(sev)}): ${returnTimelineLabel(games)}.`;
}

export function tickInjuries(
  injuries: Record<string, PersistedPlayerInjury>
): Record<string, PersistedPlayerInjury> {
  const next: Record<string, PersistedPlayerInjury> = {};
  for (const [key, row] of Object.entries(injuries)) {
    const left = row.gamesOut - 1;
    if (left > 0) {
      next[key] = { ...row, gamesOut: left };
    }
  }
  return next;
}

export function applyPersistedInjury(
  injuries: Record<string, PersistedPlayerInjury>,
  entry: PersistedPlayerInjury
): Record<string, PersistedPlayerInjury> {
  if (entry.gamesOut <= 0) return injuries;
  if (countActiveInjuries(injuries) >= MAX_CONCURRENT_INJURIES) return injuries;
  const key = injuryKey(entry.universeId, entry.playerName);
  const existing = injuries[key];
  if (existing && existing.gamesOut > entry.gamesOut) return injuries;
  return { ...injuries, [key]: entry };
}

export function finalizeMatchInjuries(
  homeInjuries: Record<string, ActiveMatchInjury>,
  awayInjuries: Record<string, ActiveMatchInjury>,
  homeUniverseId: string,
  awayUniverseId: string,
  homeOrigins: Record<string, string> | undefined,
  awayOrigins: Record<string, string> | undefined
): MatchInjuryReport[] {
  const reports: MatchInjuryReport[] = [];

  const process = (
    map: Record<string, ActiveMatchInjury>,
    team: "home" | "away",
    teamUni: string,
    origins?: Record<string, string>
  ) => {
    for (const row of Object.values(map)) {
      const finalSeverity = row.severity;
      const gamesOut = gamesOutForSeverity(finalSeverity);
      reports.push({
        playerName: row.playerName,
        team,
        severity: row.severity,
        bodyPart: row.bodyPart,
        minute: row.occurredMinute,
        finalSeverity,
        gamesOut,
      });
      void teamUni;
      void origins;
    }
  };

  process(homeInjuries, "home", homeUniverseId, homeOrigins);
  process(awayInjuries, "away", awayUniverseId, awayOrigins);

  return reports.filter((r) => r.gamesOut > 0 || r.finalSeverity === "impact");
}

export function reportsToPersisted(
  reports: MatchInjuryReport[],
  homeUniverseId: string,
  awayUniverseId: string,
  homeOrigins: Record<string, string> | undefined,
  awayOrigins: Record<string, string> | undefined
): PersistedPlayerInjury[] {
  const out: PersistedPlayerInjury[] = [];
  for (const r of reports) {
    if (r.gamesOut <= 0) continue;
    const uni =
      r.team === "home"
        ? homeOrigins?.[r.playerName] ?? homeUniverseId
        : awayOrigins?.[r.playerName] ?? awayUniverseId;
    out.push({
      universeId: uni,
      playerName: r.playerName,
      severity: r.finalSeverity,
      bodyPart: r.bodyPart,
      gamesOut: r.gamesOut,
    });
  }
  return out;
}

export interface CpuPreferredXI {
  formationId: FormationId;
  lineup: LineupSlot[];
  bench: string[];
}

export function filterLineupForAvailability(
  preferred: CpuPreferredXI,
  unavailable: Set<string>,
  fillFromPool: (slot: LineupSlot) => string | null
): { lineup: LineupSlot[]; bench: string[] } {
  const used = new Set<string>();
  const lineup = preferred.lineup.map((slot) => {
    if (slot.playerName && !unavailable.has(slot.playerName)) {
      used.add(slot.playerName);
      return slot;
    }
    const replacement = fillFromPool(slot);
    if (replacement) used.add(replacement);
    return { ...slot, playerName: replacement };
  });
  const bench = preferred.bench.filter((n) => !unavailable.has(n) && !used.has(n));
  return { lineup, bench };
}
