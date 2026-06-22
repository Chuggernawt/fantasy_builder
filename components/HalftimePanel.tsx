"use client";

import { useMemo, useState } from "react";
import type { Formation, FormationId, LineupSlot, PlayerMatchStats, TeamTactics } from "@/lib/types";
import { FORMATIONS } from "@/lib/formations";
import { getBenchPlayerNames } from "@/lib/match-stats-bench";
import { getPlayer } from "@/lib/squads";
import { applySubstitution, swapLineupSlots } from "@/lib/subs";
import { analyzeLineupChanges, sentOffPlayerNames } from "@/lib/sub-utils";
import { MAX_MATCH_SUBS } from "@/lib/constants";
import { formatTacticsBrief } from "@/lib/tactics";
import {
  TacticAxisRows,
  TacticConfirmButton,
  TacticsSheet,
  useTacticDraft,
} from "@/components/TacticPicker";
import { liveRatingsForLineup, livePlayerMatchRating, hasMatchActivity, ratingDisplayClass } from "@/lib/match-rating";
import { PitchView } from "@/components/PitchView";
import { CaptainPicker } from "@/components/CaptainPicker";
import { writeDragData } from "@/lib/pitch-dnd";
import { useGameStore } from "@/store/game-store";

interface SubstitutionPanelProps {
  universeId: string;
  formationId: FormationId;
  accent: string;
  lineup: LineupSlot[];
  matchBench: string[];
  stamina: Record<string, number>;
  playerStats?: Record<string, PlayerMatchStats>;
  teamGoals?: number;
  goalsConceded?: number;
  subsUsed: number;
  maxSubs: number;
  title: string;
  heading: string;
  confirmLabel: string;
  showSecondHalfInfluence?: boolean;
  currentTactics?: TeamTactics | null;
  currentCaptain?: string | null;
  onConfirm: (
    lineup: LineupSlot[],
    subsMade: number,
    tactics?: TeamTactics | null,
    captain?: string | null
  ) => void;
}

function ActionButton({
  label,
  sublabel,
  disabled,
  active,
  accent,
  onClick,
}: {
  label: string;
  sublabel: string;
  disabled?: boolean;
  active?: boolean;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[3.75rem] flex-1 flex-col items-center justify-center border-2 px-2 py-2 text-center transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-broadcast-highlight bg-broadcast-highlight/10"
          : "border-broadcast-border bg-black/70 hover:border-broadcast-highlight"
      }`}
      style={active ? { borderColor: accent } : undefined}
    >
      <span className="font-display text-xs font-bold uppercase tracking-wide text-broadcast-highlight md:text-sm">
        {label}
      </span>
      <span className="mt-0.5 text-[9px] leading-snug text-slate-400 md:text-[10px]">{sublabel}</span>
    </button>
  );
}

export function SubstitutionPanel({
  universeId,
  formationId,
  accent,
  lineup,
  matchBench,
  stamina,
  playerStats = {},
  teamGoals = 0,
  goalsConceded = 0,
  subsUsed,
  maxSubs,
  title,
  heading,
  confirmLabel,
  showSecondHalfInfluence = false,
  currentTactics = null,
  currentCaptain = null,
  onConfirm,
}: SubstitutionPanelProps) {
  const [draft, setDraft] = useState<LineupSlot[]>(lineup);
  const [subTargetSlotId, setSubTargetSlotId] = useState<string | null>(null);
  const [pendingTactics, setPendingTactics] = useState<TeamTactics | null>(null);
  const displayTactics = pendingTactics ?? currentTactics;
  const [captain, setCaptain] = useState<string | null>(currentCaptain);
  const [panel, setPanel] = useState<"tactic" | "captain" | null>(null);

  const formation = FORMATIONS.find((f) => f.id === formationId)!;
  const subsRemaining = maxSubs - subsUsed;

  const sentOff = useMemo(() => sentOffPlayerNames(playerStats), [playerStats]);

  const availableBench = useMemo(
    () => getBenchPlayerNames(universeId, draft, matchBench),
    [universeId, draft, matchBench]
  );

  const changeAnalysis = useMemo(
    () => analyzeLineupChanges(lineup, draft, matchBench),
    [lineup, draft, matchBench]
  );
  const pendingSubs = changeAnalysis.subs;
  const positionSwapCount = changeAnalysis.positionSwappedPlayers.length;

  const changedSlotIds = useMemo(() => {
    const ids = new Set<string>();
    draft.forEach((slot) => {
      const orig = lineup.find((s) => s.slotId === slot.slotId);
      if (orig?.playerName !== slot.playerName) ids.add(slot.slotId);
    });
    return ids;
  }, [draft, lineup]);

  const liveRatings = useMemo(
    () =>
      liveRatingsForLineup(draft, playerStats, {
        teamGoals,
        oppGoals: goalsConceded,
        goalsConceded,
      }),
    [draft, playerStats, teamGoals, goalsConceded]
  );

  function assignPlayer(slotId: string, playerName: string) {
    const orig = lineup.find((s) => s.slotId === slotId);
    if (orig?.playerName && sentOff.has(orig.playerName)) return;
    if (subsUsed + pendingSubs >= maxSubs && !changedSlotIds.has(slotId)) {
      const slot = draft.find((s) => s.slotId === slotId);
      if (slot?.playerName !== playerName) return;
    }
    if (!matchBench.includes(playerName) && !draft.some((s) => s.playerName === playerName)) return;
    const next = applySubstitution(draft, slotId, playerName);
    if (next) {
      setDraft(next);
      setSubTargetSlotId(null);
    }
  }

  function swapPitchSlots(slotA: string, slotB: string) {
    const slotAPlayer = draft.find((s) => s.slotId === slotA)?.playerName;
    const slotBPlayer = draft.find((s) => s.slotId === slotB)?.playerName;
    if (
      (slotAPlayer && sentOff.has(slotAPlayer)) ||
      (slotBPlayer && sentOff.has(slotBPlayer))
    ) {
      return;
    }
    const next = swapLineupSlots(draft, slotA, slotB);
    if (next) {
      setDraft(next);
      setSubTargetSlotId(null);
    }
  }


  function handleBenchPick(playerName: string) {
    if (!subTargetSlotId) return;
    if (subsRemaining - pendingSubs <= 0 && !changedSlotIds.has(subTargetSlotId)) return;
    assignPlayer(subTargetSlotId, playerName);
  }

  function resetDraft() {
    setDraft(lineup);
    setSubTargetSlotId(null);
  }

  const isPlayerFullyRevealed = useGameStore((s) => s.isPlayerFullyRevealed);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="glass-panel mb-2 shrink-0 border-t-4 p-2" style={{ borderTopColor: accent }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="broadcast-label text-[10px]">{title}</p>
            <p className="font-display text-sm font-bold uppercase">{heading}</p>
          </div>
          <p className="font-mono text-[10px] text-slate-400">
            {subsRemaining - pendingSubs}/{maxSubs} subs
            {pendingSubs > 0 ? (
              <span className="text-amber-400"> · {pendingSubs} pending</span>
            ) : null}
            {positionSwapCount > 0 ? (
              <span className="text-sky-400"> · {positionSwapCount} reshuffle</span>
            ) : null}
          </p>
          <p className="mt-1 text-[9px] text-slate-500">
            Drag subs onto the pitch, or drag two players to swap positions (−5 fitness each).
          </p>
        </div>

        {showSecondHalfInfluence ? (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <ActionButton
              label="Tactic"
              sublabel={displayTactics ? formatTacticsBrief(displayTactics) : "Optional 2nd-half change"}
              active={panel === "tactic"}
              accent={accent}
              onClick={() => setPanel((p) => (p === "tactic" ? null : "tactic"))}
            />
            <ActionButton
              label="Captain"
              sublabel={captain ? "Set" : "Pick"}
              active={panel === "captain"}
              accent={accent}
              onClick={() => setPanel((p) => (p === "captain" ? null : "captain"))}
            />
            <ActionButton
              label="Subs"
              sublabel={subTargetSlotId ? "Pick sub" : "Tap pitch"}
              active={!!subTargetSlotId}
              accent={accent}
              onClick={() => setSubTargetSlotId(null)}
            />
          </div>
        ) : null}

        {panel === "captain" && showSecondHalfInfluence ? (
          <div className="mt-2">
            <CaptainPicker
              universeId={universeId}
              lineup={draft}
              value={captain}
              disabled={false}
              accent={accent}
              onSelect={setCaptain}
            />
          </div>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(0,1fr)_9.5rem]">
        <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden p-1.5">
          <div className="min-h-0 flex-1">
            <PitchView
              formation={formation}
              formationId={formationId}
              lineup={draft}
              accent={accent}
              compact
              interactive
              stamina={stamina}
              playerRatings={liveRatings}
              subTargetSlotId={subTargetSlotId}
              changedSlotIds={changedSlotIds}
              allowPitchDrag
              getPlayer={(name) => getPlayer(universeId, name)}
              onSlotClick={(slotId) => {
                const slot = draft.find((s) => s.slotId === slotId);
                if (!slot?.playerName) return;
                if (sentOff.has(slot.playerName)) return;
                setSubTargetSlotId((prev) => (prev === slotId ? null : slotId));
                setPanel(null);
              }}
              onAssignPlayer={assignPlayer}
              onSwapSlots={swapPitchSlots}
            />
          </div>
        </div>

        <div className="glass-panel flex min-h-0 flex-col p-1.5">
          <p className="broadcast-label mb-1 text-[10px]">Subs</p>
          <div className="mb-1 grid grid-cols-[1fr_2rem] gap-1 text-[8px] uppercase tracking-wider text-slate-600">
            <span>Player</span>
            <span className="text-center">Rtg</span>
          </div>
          <ul className="grid flex-1 grid-rows-5 gap-1">
            {matchBench.map((name) => {
              const onPitch = draft.some((s) => s.playerName === name);
              const p = getPlayer(universeId, name);
              if (!p) return null;
              const available = availableBench.includes(name);
              const pitchSlot = draft.find((s) => s.playerName === name);
              const benchRating = liveRatings[name] ??
                (hasMatchActivity(playerStats[name])
                  ? livePlayerMatchRating(playerStats[name], pitchSlot?.role ?? "CM", {
                      teamGoals,
                      oppGoals: goalsConceded,
                    })
                  : null);
              return (
                <li key={name}>
                  <button
                    type="button"
                    draggable={available}
                    disabled={!available}
                    onDragStart={(e) => {
                      if (!available) return;
                      writeDragData(e, { kind: "bench", playerName: name });
                    }}
                    onClick={() => {
                      if (subTargetSlotId) handleBenchPick(name);
                    }}
                    className={`flex h-full w-full items-center gap-2 border px-2 py-1.5 text-left transition ${
                      onPitch
                        ? "border-slate-700 bg-black/30 opacity-50"
                        : available && subTargetSlotId
                          ? "border-broadcast-highlight bg-black/80 hover:bg-black/90"
                          : "border-broadcast-border bg-black/60 hover:border-broadcast-highlight disabled:opacity-40"
                    } ${available ? "cursor-grab active:cursor-grabbing" : ""}`}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center font-display text-[10px] font-bold"
                      style={{ backgroundColor: accent, color: "#0a0a0a" }}
                    >
                      {isPlayerFullyRevealed(name) ? p.ovr : "??"}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-display text-[10px] font-semibold uppercase">
                      {p.name}
                    </span>
                    <span
                      className={`shrink-0 font-mono text-[10px] font-bold ${
                        benchRating != null ? ratingDisplayClass(benchRating) : "text-slate-700"
                      }`}
                    >
                      {benchRating != null ? benchRating.toFixed(1) : "—"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mt-2 flex shrink-0 gap-2">
        <button
          type="button"
          className="btn-broadcast flex-1 text-xs"
          disabled={pendingSubs === 0 && positionSwapCount === 0}
          onClick={resetDraft}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn-broadcast-solid flex-1 text-xs"
          disabled={pendingSubs > subsRemaining}
          onClick={() =>
            onConfirm(
              draft,
              pendingSubs,
              showSecondHalfInfluence ? pendingTactics ?? undefined : undefined,
              showSecondHalfInfluence ? captain : undefined
            )
          }
        >
          {confirmLabel}
        </button>
      </div>

      {showSecondHalfInfluence ? (
        <HalftimeTacticsSheet
          open={panel === "tactic"}
          displayTactics={displayTactics}
          onClose={() => setPanel(null)}
          onConfirm={setPendingTactics}
        />
      ) : null}
    </div>
  );
}

function HalftimeTacticsSheet({
  open,
  displayTactics,
  onClose,
  onConfirm,
}: {
  open: boolean;
  displayTactics: TeamTactics | null;
  onClose: () => void;
  onConfirm: (tactics: TeamTactics) => void;
}) {
  const { draft, updateDraft } = useTacticDraft(displayTactics);

  if (!open) return null;

  return (
    <TacticsSheet
      open
      title="Second-half tactics"
      description="Keep your first-half plan or set a new one for the second half."
      onClose={onClose}
      footer={
        <TacticConfirmButton
          draft={draft}
          value={displayTactics}
          disabled={false}
          confirmLabel="Set for 2nd half"
          onSelect={(t) => {
            onConfirm(t);
            onClose();
          }}
        />
      }
    >
      <TacticAxisRows draft={draft} disabled={false} onUpdate={updateDraft} />
    </TacticsSheet>
  );
}

/** @deprecated use SubstitutionPanel */
export const HalftimePanel = SubstitutionPanel;
