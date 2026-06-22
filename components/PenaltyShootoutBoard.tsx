"use client";

import type { PenaltyShootoutState } from "@/lib/types";
import { shootoutDisplaySlots } from "@/lib/penalty-shootout";

interface PenaltyShootoutBoardProps {
  shootout: PenaltyShootoutState;
  homeLabel: string;
  awayLabel: string;
  homeAccent: string;
  awayAccent: string;
  /** Who is taking the current kick (optional highlight). */
  activeSide?: "home" | "away" | null;
}

function KickCircle({
  result,
  accent,
  pending,
}: {
  result?: "goal" | "miss";
  accent: string;
  pending: boolean;
}) {
  const base =
    "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition sm:h-8 sm:w-8";

  if (result === "goal") {
    return (
      <span
        className={base}
        style={{ borderColor: accent, backgroundColor: accent, color: "#0f172a" }}
        title="Scored"
      >
        ●
      </span>
    );
  }

  if (result === "miss") {
    return (
      <span
        className={`${base} border-red-500/80 bg-red-950/40 text-red-400`}
        title="Missed"
      >
        ✕
      </span>
    );
  }

  return (
    <span
      className={`${base} ${pending ? "border-broadcast-highlight/70 bg-broadcast-highlight/10" : "border-slate-600 bg-slate-900/60"}`}
      title="Pending"
    />
  );
}

function TeamRow({
  label,
  accent,
  kicks,
  taken,
  active,
}: {
  label: string;
  accent: string;
  kicks: ("goal" | "miss")[] | undefined;
  taken: number;
  active: boolean;
}) {
  const slots = shootoutDisplaySlots(kicks, taken);
  const kickList = kicks ?? [];

  return (
    <div className={`flex items-center gap-2 sm:gap-3 ${active ? "opacity-100" : "opacity-90"}`}>
      <p
        className="min-w-0 flex-1 truncate font-display text-[10px] font-semibold uppercase tracking-wide sm:text-xs"
        style={{ color: accent }}
      >
        {label}
      </p>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {Array.from({ length: slots }, (_, i) => (
          <KickCircle
            key={i}
            result={kickList[i]}
            accent={accent}
            pending={active && i === kickList.length}
          />
        ))}
      </div>
    </div>
  );
}

export function PenaltyShootoutBoard({
  shootout,
  homeLabel,
  awayLabel,
  homeAccent,
  awayAccent,
  activeSide,
}: PenaltyShootoutBoardProps) {
  const homeGoals = shootout.homeKicks?.filter((k) => k === "goal").length ?? shootout.home;
  const awayGoals = shootout.awayKicks?.filter((k) => k === "goal").length ?? shootout.away;

  return (
    <div className="mb-4 rounded-lg border border-broadcast-highlight/40 bg-black/50 px-3 py-3 sm:px-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="broadcast-label text-[10px] sm:text-xs">Penalty shootout</p>
        <p className="font-mono text-xs text-broadcast-highlight sm:text-sm">
          {homeGoals} – {awayGoals}
        </p>
      </div>
      <div className="space-y-2">
        <TeamRow
          label={homeLabel}
          accent={homeAccent}
          kicks={shootout.homeKicks}
          taken={shootout.homeTaken}
          active={activeSide === "home"}
        />
        <TeamRow
          label={awayLabel}
          accent={awayAccent}
          kicks={shootout.awayKicks}
          taken={shootout.awayTaken}
          active={activeSide === "away"}
        />
      </div>
      <p className="mt-2 text-center text-[9px] text-slate-500 sm:text-[10px]">
        ● scored · ✕ missed · sudden death after 5 each if level
      </p>
    </div>
  );
}
