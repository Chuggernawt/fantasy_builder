"use client";

import { useState } from "react";
import type { LineupSlot, MatchState, TacticalStyle } from "@/lib/types";
import { MAX_MATCH_SUBS } from "@/lib/constants";
import { getUniverseTrait } from "@/lib/universe-traits";
import { TACTICAL_OPTIONS } from "@/lib/match-influence";
import { TacticPicker } from "@/components/TacticPicker";
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
  onSetTactic: (tactic: TacticalStyle) => void;
  onCallCaptain: (name: string) => void;
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

export function MatchInfluenceBar({
  matchState,
  side,
  universeId,
  lineup,
  accent,
  onOpenSubs,
  onSetTactic,
  onCallCaptain,
}: MatchInfluenceBarProps) {
  const [panel, setPanel] = useState<ActivePanel>(null);

  const subsUsed = side === "home" ? matchState.homeSubsUsed : matchState.awaySubsUsed;
  const tacticHalf = side === "home" ? matchState.homeTacticHalf : matchState.awayTacticHalf;
  const captainHalf = side === "home" ? matchState.homeCaptainHalf : matchState.awayCaptainHalf;
  const tactic = side === "home" ? matchState.homeTactic : matchState.awayTactic;
  const captain = side === "home" ? matchState.homeCaptain : matchState.awayCaptain;

  const subsLeft = MAX_MATCH_SUBS - subsUsed;
  const tacticSet = tacticHalf === matchState.half;
  const captainSet = captainHalf === matchState.half;
  const trait = getUniverseTrait(universeId);

  const tacticLabel =
    tacticSet && tactic ? TACTICAL_OPTIONS.find((o) => o.id === tactic)?.label : null;

  if (matchState.status !== "running") return null;

  return (
    <div className="glass-panel mb-3 shrink-0 p-3 md:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="broadcast-label">Your calls</p>
        <span className="text-xs text-slate-400">
          Universe trait: <span className="text-slate-200">{trait.label}</span>
          {tacticLabel ? (
            <>
              {" "}
              · Tactic: <span className="text-broadcast-highlight">{tacticLabel}</span>
            </>
          ) : null}
          {captainSet && captain ? (
            <>
              {" "}
              · Captain: <span className="text-broadcast-highlight">{captain}</span>
            </>
          ) : null}
        </span>
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
          label="Set Tactic"
          sublabel={tacticSet ? "Locked this half" : "Once per half — tap to choose"}
          disabled={tacticSet}
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

      {panel === "tactic" && !tacticSet ? (
        <div className="mt-4 border-t border-broadcast-border pt-4">
          <p className="mb-3 text-sm font-semibold text-slate-200">Choose your tactic for this half</p>
          <TacticPicker
            prominent
            value={tactic}
            disabled={tacticSet}
            onSelect={(t) => {
              onSetTactic(t);
              setPanel(null);
            }}
          />
        </div>
      ) : null}

      {panel === "captain" && !captainSet ? (
        <div className="mt-4 border-t border-broadcast-border pt-4">
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
  );
}
