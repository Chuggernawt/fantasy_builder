"use client";

import { useEffect, useState } from "react";
import type { InteractiveSetPiece } from "@/lib/types";
import {
  setPieceAttackOptions,
  setPieceDefendOptions,
  setPieceTimeLeft,
} from "@/lib/set-piece-interactive";

interface SetPiecePanelProps {
  piece: InteractiveSetPiece;
  isAttacker: boolean;
  attackingLabel?: string;
  defendingLabel?: string;
  myPick: number | null;
  onPick: (choice: number) => void;
}

interface ZoneButton {
  choice: number;
  label: string;
  className: string;
}

function choiceButtonClass(selected: boolean, disabled: boolean): string {
  const base =
    "absolute z-10 max-w-[42%] border-2 px-2 py-1.5 text-[10px] font-display uppercase leading-tight tracking-wide transition sm:px-3 sm:py-2 sm:text-xs";
  if (disabled) {
    return `${base} cursor-default border-slate-600/80 bg-black/60 text-slate-500`;
  }
  if (selected) {
    return `${base} border-broadcast-highlight bg-broadcast-highlight/25 text-broadcast-highlight shadow-[0_0_12px_rgba(234,179,8,0.45)]`;
  }
  return `${base} border-white/40 bg-black/75 text-slate-100 hover:border-broadcast-highlight hover:bg-broadcast-highlight/15`;
}

function PitchGraphic({
  kind,
  zones,
  myPick,
  locked,
  onPick,
}: {
  kind: "corner" | "penalty";
  zones: ZoneButton[];
  myPick: number | null;
  locked: boolean;
  onPick: (choice: number) => void;
}) {
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-md overflow-hidden rounded-sm border border-emerald-800/60 bg-gradient-to-b from-emerald-900/90 to-emerald-950">
      {/* Pitch markings */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[38%] w-[72%] -translate-x-1/2 border border-white/25" />
        <div className="absolute left-1/2 top-0 h-[16%] w-[44%] -translate-x-1/2 border border-white/25" />
        <div className="absolute left-1/2 top-[38%] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
        {kind === "penalty" ? (
          <div className="absolute left-1/2 top-[22%] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/70" />
        ) : (
          <>
            <div className="absolute bottom-0 right-0 h-[28%] w-[28%] border-l border-t border-white/20" />
            <div className="absolute bottom-1 right-1 h-3 w-0.5 bg-amber-400/90" />
            <div className="absolute bottom-1 right-1 h-0.5 w-3 bg-amber-400/90" />
          </>
        )}
        {/* Goal frame */}
        <div className="absolute left-1/2 top-0 h-3 w-[52%] -translate-x-1/2 border-x-2 border-b-2 border-white/50 bg-slate-900/40" />
        <div className="absolute left-1/2 top-0 h-1 w-[52%] -translate-x-1/2 bg-white/30" />
      </div>

      {zones.map((zone) => (
        <button
          key={zone.choice}
          type="button"
          disabled={locked}
          onClick={() => onPick(zone.choice)}
          className={`${choiceButtonClass(myPick === zone.choice, locked)} ${zone.className}`}
        >
          <span className="text-broadcast-highlight">{zone.choice}.</span> {zone.label}
        </button>
      ))}
    </div>
  );
}

function cornerZones(isAttacker: boolean): ZoneButton[] {
  if (isAttacker) {
    return [
      { choice: 1, label: "In-swinger", className: "left-[6%] top-[14%]" },
      { choice: 2, label: "Out-swinger", className: "right-[6%] top-[14%]" },
      { choice: 3, label: "In the Mixer", className: "left-1/2 top-[30%] -translate-x-1/2" },
    ];
  }
  return [
    { choice: 1, label: "Near post", className: "left-[8%] top-[6%]" },
    { choice: 2, label: "Far post", className: "right-[8%] top-[6%]" },
    { choice: 3, label: "Keeper claim", className: "left-1/2 top-[10%] -translate-x-1/2" },
  ];
}

function penaltyZones(isAttacker: boolean): ZoneButton[] {
  if (isAttacker) {
    return [
      { choice: 1, label: "Shoot left", className: "left-[10%] top-[4%]" },
      { choice: 2, label: "Shoot middle", className: "left-1/2 top-[2%] -translate-x-1/2" },
      { choice: 3, label: "Shoot right", className: "right-[10%] top-[4%]" },
    ];
  }
  return [
    { choice: 1, label: "Dive left", className: "left-[10%] top-[4%]" },
    { choice: 2, label: "Stay center", className: "left-1/2 top-[2%] -translate-x-1/2" },
    { choice: 3, label: "Dive right", className: "right-[10%] top-[4%]" },
  ];
}

export function SetPiecePanel({ piece, isAttacker, attackingLabel, defendingLabel, myPick, onPick }: SetPiecePanelProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    piece.phase === "choose" ? setPieceTimeLeft(piece.chooseEndsAt) : setPieceTimeLeft(piece.revealEndsAt)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(
        piece.phase === "choose"
          ? setPieceTimeLeft(piece.chooseEndsAt)
          : setPieceTimeLeft(piece.revealEndsAt)
      );
    }, 400);
    return () => clearInterval(timer);
  }, [piece]);

  if (piece.phase === "reveal") {
    return (
      <div className="glass-panel mb-3 shrink-0 border border-amber-500/50 bg-amber-950/30 p-4 text-center">
        <p className="broadcast-label text-[10px] text-amber-300">
          {piece.kind === "penalty" ? "Penalty" : "Corner"} result
        </p>
        <p className="mt-2 font-display text-base font-bold text-slate-100">{piece.resultText}</p>
        <p className="mt-2 font-mono text-xs text-slate-400">Resuming in {secondsLeft}s…</p>
      </div>
    );
  }

  const options = isAttacker
    ? setPieceAttackOptions(piece.kind)
    : setPieceDefendOptions(piece.kind);
  const zones =
    piece.kind === "penalty" ? penaltyZones(isAttacker) : cornerZones(isAttacker);

  return (
    <div className="glass-panel mb-3 shrink-0 border border-amber-500/50 bg-amber-950/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="broadcast-label text-[10px] text-amber-300">
            {piece.kind === "penalty" ? "Penalty" : "Corner"} — {isAttacker ? "You attack" : "You defend"}
          </p>
          <p className="text-sm text-slate-200">
            {attackingLabel ?? (piece.attacking === "home" ? "Home" : "Away")} attack ·{" "}
            {defendingLabel ?? (piece.attacking === "home" ? "Away" : "Home")} defend
          </p>
          <p className="text-xs text-slate-400">
            {piece.taker} vs {piece.keeper}
            {piece.kind === "corner" && piece.cornerTaker && piece.cornerTaker !== piece.taker
              ? ` · ${piece.cornerTaker} to deliver`
              : null}
          </p>
        </div>
        <p className="font-mono text-lg text-broadcast-highlight">{secondsLeft}s</p>
      </div>

      <p className="mb-2 text-center text-[10px] uppercase tracking-wider text-slate-400">
        Tap a zone on the {piece.kind === "penalty" ? "goal" : "pitch"}
      </p>

      <PitchGraphic
        kind={piece.kind}
        zones={zones}
        myPick={myPick}
        locked={myPick !== null}
        onPick={onPick}
      />

      <div className="mt-3 flex flex-wrap justify-center gap-2 text-[10px] text-slate-500">
        {options.map((label, i) => (
          <span key={label}>
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {myPick ? (
        <p className="mt-2 text-center text-xs text-slate-400">
          {piece.phase === "choose" &&
          (isAttacker ? piece.defenderPick : piece.attackerPick)
            ? "Both sides locked in — resolving…"
            : "Choice locked — waiting for opponent…"}
        </p>
      ) : null}
    </div>
  );
}
