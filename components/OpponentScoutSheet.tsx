"use client";

import type { FormationId, LineupSlot, TeamTactics } from "@/lib/types";
import { FORMATIONS } from "@/lib/formations";
import { getPlayer } from "@/lib/squads";
import { formatScoutGlance } from "@/lib/tactics";
import { PitchView } from "@/components/PitchView";
import { UniverseTraitDisplay } from "@/components/UniverseTraitDisplay";
import { TacticAxisRows, TacticsSheet } from "@/components/TacticPicker";

interface OpponentScoutSheetProps {
  open: boolean;
  onClose: () => void;
  teamName: string;
  accent: string;
  universeId: string;
  formationId: FormationId;
  lineup: LineupSlot[];
  tactics: TeamTactics | null;
  captain: string | null;
}

export function OpponentScoutSheet({
  open,
  onClose,
  teamName,
  accent,
  universeId,
  formationId,
  lineup,
  tactics,
  captain,
}: OpponentScoutSheetProps) {
  const formation = FORMATIONS.find((f) => f.id === formationId) ?? FORMATIONS[0];
  const glance = formatScoutGlance(formation.label, tactics);
  const tacticDraft = tactics ?? {};

  return (
    <TacticsSheet
      open={open}
      title={`Scout report — ${teamName}`}
      description={glance}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className="btn-broadcast w-full py-2.5 text-sm">
          Close
        </button>
      }
    >
      <div className="space-y-4">
        <UniverseTraitDisplay
          universeId={universeId}
          accent={accent}
          variant="strip"
          prefix="Universe trait"
        />

        {captain ? (
          <p className="text-xs text-slate-400">
            Captain this half:{" "}
            <span className="font-semibold text-broadcast-highlight">{captain}</span>
          </p>
        ) : null}

        <div className="glass-panel p-2">
          <PitchView
            formation={formation}
            formationId={formationId}
            lineup={lineup}
            accent={accent}
            interactive={false}
            compact
            getPlayer={(name) => getPlayer(universeId, name)}
          />
        </div>

        {tactics ? (
          <div>
            <p className="mb-2 broadcast-label text-[10px]">Tactical setup</p>
            <TacticAxisRows draft={tacticDraft} disabled onUpdate={() => {}} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">Opponent tactics not locked in yet.</p>
        )}
      </div>
    </TacticsSheet>
  );
}
