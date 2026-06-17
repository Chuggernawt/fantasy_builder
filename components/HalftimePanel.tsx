"use client";

import { useMemo, useState } from "react";
import type { Formation, FormationId, LineupSlot, TacticalStyle } from "@/lib/types";
import { FORMATIONS } from "@/lib/formations";
import { getBenchPlayerNames } from "@/lib/match-stats-bench";
import { getPlayer } from "@/lib/squads";
import { applySubstitution } from "@/lib/subs";
import { MAX_MATCH_SUBS } from "@/lib/constants";
import { TACTICAL_OPTIONS } from "@/lib/match-influence";
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
  subsUsed: number;
  maxSubs: number;
  title: string;
  heading: string;
  confirmLabel: string;
  showSecondHalfInfluence?: boolean;
  currentTactic?: TacticalStyle | null;
  currentCaptain?: string | null;
  onConfirm: (
    lineup: LineupSlot[],
    subsMade: number,
    tactic?: TacticalStyle | null,
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
  subsUsed,
  maxSubs,
  title,
  heading,
  confirmLabel,
  showSecondHalfInfluence = false,
  currentTactic = null,
  currentCaptain = null,
  onConfirm,
}: SubstitutionPanelProps) {
  const [draft, setDraft] = useState<LineupSlot[]>(lineup);
  const [subTargetSlotId, setSubTargetSlotId] = useState<string | null>(null);
  const [tactic, setTactic] = useState<TacticalStyle | null>(currentTactic);
  const [captain, setCaptain] = useState<string | null>(currentCaptain);
  const [panel, setPanel] = useState<"tactic" | "captain" | null>(null);

  const formation = FORMATIONS.find((f) => f.id === formationId)!;
  const subsRemaining = maxSubs - subsUsed;

  const availableBench = useMemo(
    () => getBenchPlayerNames(universeId, draft, matchBench),
    [universeId, draft, matchBench]
  );

  const changedSlotIds = useMemo(() => {
    const ids = new Set<string>();
    draft.forEach((slot, i) => {
      if (slot.playerName !== lineup[i]?.playerName) ids.add(slot.slotId);
    });
    return ids;
  }, [draft, lineup]);

  const pendingChanges = changedSlotIds.size;

  function assignPlayer(slotId: string, playerName: string) {
    if (subsUsed + pendingChanges >= maxSubs && !changedSlotIds.has(slotId)) {
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


  function handleBenchPick(playerName: string) {
    if (!subTargetSlotId) return;
    if (subsRemaining - pendingChanges <= 0 && !changedSlotIds.has(subTargetSlotId)) return;
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
            {subsRemaining - pendingChanges}/{maxSubs} subs
            {pendingChanges > 0 ? (
              <span className="text-amber-400"> · {pendingChanges} pending</span>
            ) : null}
          </p>
        </div>

        {showSecondHalfInfluence ? (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <ActionButton
              label="Tactic"
              sublabel={tactic ? "Set" : "Pick"}
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

        {panel === "tactic" && showSecondHalfInfluence ? (
          <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
            {TACTICAL_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTactic(opt.id)}
                className={`border px-2 py-1.5 text-left text-[10px] ${
                  tactic === opt.id
                    ? "border-broadcast-highlight bg-broadcast-highlight/15"
                    : "border-broadcast-border bg-black/60 hover:border-broadcast-highlight"
                }`}
              >
                <span className="font-display font-semibold uppercase text-broadcast-highlight">
                  {opt.label}
                </span>
              </button>
            ))}
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
              subTargetSlotId={subTargetSlotId}
              changedSlotIds={changedSlotIds}
              allowPitchDrag={false}
              getPlayer={(name) => getPlayer(universeId, name)}
              onSlotClick={(slotId) => {
                const slot = draft.find((s) => s.slotId === slotId);
                if (!slot?.playerName) return;
                setSubTargetSlotId((prev) => (prev === slotId ? null : slotId));
                setPanel(null);
              }}
              onAssignPlayer={assignPlayer}
            />
          </div>
        </div>

        <div className="glass-panel flex min-h-0 flex-col p-1.5">
          <p className="broadcast-label mb-1 text-[10px]">Subs</p>
          <ul className="grid flex-1 grid-rows-5 gap-1">
            {matchBench.map((name) => {
              const onPitch = draft.some((s) => s.playerName === name);
              const p = getPlayer(universeId, name);
              if (!p) return null;
              const available = availableBench.includes(name);
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
                    <span className="truncate font-display text-[10px] font-semibold uppercase">
                      {p.name}
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
          disabled={pendingChanges === 0}
          onClick={resetDraft}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn-broadcast-solid flex-1 text-xs"
          disabled={pendingChanges > subsRemaining}
          onClick={() =>
            onConfirm(
              draft,
              pendingChanges,
              showSecondHalfInfluence ? tactic : undefined,
              showSecondHalfInfluence ? captain : undefined
            )
          }
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

/** @deprecated use SubstitutionPanel */
export const HalftimePanel = SubstitutionPanel;
