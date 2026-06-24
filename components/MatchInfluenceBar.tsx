"use client";

import { useState } from "react";
import type { LineupSlot, MatchState, TeamTactics } from "@/lib/types";
import { MAX_MATCH_SUBS } from "@/lib/constants";
import { getUniverse } from "@/lib/squads";
import { UniverseTraitDisplay } from "@/components/UniverseTraitDisplay";
import { canPickTacticsInMatch, formatTacticsBrief } from "@/lib/tactics";
import {
  TacticAxisRows,
  TacticConfirmButton,
  TacticsSheet,
  useTacticDraft,
} from "@/components/TacticPicker";
import { CaptainPicker } from "@/components/CaptainPicker";
import type { MatchSide } from "@/lib/multiplayer-perspective";

type ActivePanel = "subs" | "tactic" | "captain" | null;

interface MatchInfluenceBarProps {
  matchState: MatchState;
  side: MatchSide;
  universeId: string;
  lineup: LineupSlot[];
  accent: string;
  onOpenSubs: () => void;
  onSetTactic: (tactics: TeamTactics) => void;
  onCallCaptain: (name: string) => void;
  opponentName?: string;
  opponentUniverseId?: string;
  onOpenOpponentScout?: () => void;
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
      className={`flex min-h-[4.5rem] flex-1 flex-col items-center justify-center border-2 px-3 py-3 text-center transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-broadcast-highlight bg-broadcast-highlight/10"
          : "border-broadcast-border bg-black/70 hover:border-broadcast-highlight hover:bg-black/90"
      }`}
      style={active ? { borderColor: accent } : undefined}
    >
      <span className="font-display text-sm font-bold uppercase tracking-wide text-broadcast-highlight md:text-base">
        {label}
      </span>
      <span className="mt-1 text-[10px] leading-snug text-slate-400 md:text-xs">{sublabel}</span>
    </button>
  );
}

function TacticsSheetContent({
  half,
  tactics,
  tacticLocked,
  onClose,
  onSetTactic,
}: {
  half: 1 | 2;
  tactics: TeamTactics | null;
  tacticLocked: boolean;
  onClose: () => void;
  onSetTactic: (tactics: TeamTactics) => void;
}) {
  const { draft, updateDraft } = useTacticDraft(tactics);

  return (
    <TacticsSheet
      open
      title="Match tactics"
      description={
        half === 1
          ? "Your plan carries into the 2nd half unless you change it at half time or in the 2nd half."
          : "Set a new plan for the rest of the match."
      }
      onClose={onClose}
      footer={
        <TacticConfirmButton
          draft={draft}
          value={tactics}
          disabled={tacticLocked}
          confirmLabel="Lock in tactics"
          onSelect={(t) => {
            onSetTactic(t);
            onClose();
          }}
        />
      }
    >
      <TacticAxisRows draft={draft} disabled={tacticLocked} onUpdate={updateDraft} />
    </TacticsSheet>
  );
}

export function MatchInfluenceBar({
  matchState,
  side,
  universeId,
  lineup,
  accent,
  onOpenSubs,
  onSetTactic,
  onCallCaptain,
  opponentName,
  opponentUniverseId,
  onOpenOpponentScout,
}: MatchInfluenceBarProps) {
  const [panel, setPanel] = useState<ActivePanel>(null);

  const subsUsed = side === "home" ? matchState.homeSubsUsed : matchState.awaySubsUsed;
  const tacticRevision = side === "home" ? matchState.homeTacticHalf : matchState.awayTacticHalf;
  const captainHalf = side === "home" ? matchState.homeCaptainHalf : matchState.awayCaptainHalf;
  const tactics = side === "home" ? matchState.homeTactics : matchState.awayTactics;
  const captain = side === "home" ? matchState.homeCaptain : matchState.awayCaptain;

  const subsLeft = MAX_MATCH_SUBS - subsUsed;
  const canPickTactic = canPickTacticsInMatch(tacticRevision, matchState.half);
  const tacticLocked = !canPickTactic;
  const captainSet = captainHalf === matchState.half;
  const opponentUni = opponentUniverseId ? getUniverse(opponentUniverseId) : null;

  const tacticLabel = tactics ? formatTacticsBrief(tactics) : null;

  if (matchState.status !== "running") return null;

  return (
    <>
      <div className="glass-panel mb-3 shrink-0 p-3 md:p-4">
        <div className="mb-3 space-y-2">
          <UniverseTraitDisplay
            universeId={universeId}
            accent={accent}
            variant="strip"
            prefix="Your trait"
          />
          {opponentUniverseId && opponentUni ? (
            <UniverseTraitDisplay
              universeId={opponentUniverseId}
              accent={opponentUni.accentColor}
              variant="strip"
              prefix="Opponent"
            />
          ) : null}
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="broadcast-label">Your calls</p>
          <div className="flex max-w-full flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs leading-relaxed text-slate-400">
            {onOpenOpponentScout && opponentName ? (
              <button
                type="button"
                onClick={onOpenOpponentScout}
                className="text-left hover:text-broadcast-highlight"
              >
                Scout: <span className="text-slate-200">{opponentName}</span>{" "}
                <span aria-hidden>↗</span>
              </button>
            ) : null}
            <span>
              {tacticLabel ? (
                <>
                  Tactics: <span className="text-broadcast-highlight">{tacticLabel}</span>
                </>
              ) : null}
              {captainSet && captain ? (
                <>
                  {tacticLabel ? " · " : null}
                  Captain: <span className="text-broadcast-highlight">{captain}</span>
                </>
              ) : null}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <ActionButton
            label="Substitutions"
            sublabel={subsLeft > 0 ? `${subsLeft} of ${MAX_MATCH_SUBS} left — pauses match` : "All subs used"}
            disabled={subsLeft <= 0}
            accent={accent}
            onClick={() => {
              setPanel(null);
              onOpenSubs();
            }}
          />
          <ActionButton
            label="Set Tactics"
          sublabel={
            tacticLocked
              ? matchState.half === 1
                ? "Locked for 1st half"
                : "Locked for 2nd half"
              : matchState.half === 1
                ? "Once in 1st half — carries to 2nd"
                : "Once in 2nd half"
          }
            disabled={tacticLocked}
            active={panel === "tactic"}
            accent={accent}
            onClick={() => setPanel((p) => (p === "tactic" ? null : "tactic"))}
          />
          <ActionButton
            label="Captain's Call"
            sublabel={captainSet ? `${captain} leading` : "Once per half — pick a leader"}
            disabled={captainSet}
            active={panel === "captain"}
            accent={accent}
            onClick={() => setPanel((p) => (p === "captain" ? null : "captain"))}
          />
        </div>

        {panel === "captain" && !captainSet ? (
          <div className="mt-4 max-h-[min(50dvh,24rem)] overflow-y-auto overscroll-contain border-t border-broadcast-border pt-4">
            <p className="mb-3 text-sm font-semibold text-slate-200">Who takes the armband?</p>
            <CaptainPicker
              prominent
              universeId={universeId}
              lineup={lineup}
              value={captain}
              disabled={captainSet}
              accent={accent}
              onSelect={(name) => {
                onCallCaptain(name);
                setPanel(null);
              }}
            />
          </div>
        ) : null}
      </div>

      {panel === "tactic" && canPickTactic ? (
        <TacticsSheetContent
          half={matchState.half}
          tactics={tactics}
          tacticLocked={tacticLocked}
          onClose={() => setPanel(null)}
          onSetTactic={onSetTactic}
        />
      ) : null}
    </>
  );
}
