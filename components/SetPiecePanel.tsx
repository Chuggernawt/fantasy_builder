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
  myPick: number | null;
  onPick: (choice: number) => void;
}

export function SetPiecePanel({ piece, isAttacker, myPick, onPick }: SetPiecePanelProps) {
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

  return (
    <div className="glass-panel mb-3 shrink-0 border border-amber-500/50 bg-amber-950/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="broadcast-label text-[10px] text-amber-300">
            {piece.kind === "penalty" ? "Penalty" : "Corner"} — {isAttacker ? "Attack" : "Defend"}
          </p>
          <p className="text-sm text-slate-200">
            {piece.taker} vs {piece.keeper}
          </p>
        </div>
        <p className="font-mono text-lg text-broadcast-highlight">{secondsLeft}s</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((label, i) => {
          const choice = i + 1;
          const selected = myPick === choice;
          return (
            <button
              key={label}
              type="button"
              disabled={myPick !== null}
              onClick={() => onPick(choice)}
              className={`border-2 px-3 py-3 text-left text-xs transition ${
                selected
                  ? "border-broadcast-highlight bg-broadcast-highlight/20"
                  : "border-broadcast-border bg-black/70 hover:border-broadcast-highlight"
              }`}
            >
              <span className="font-display font-bold text-broadcast-highlight">{choice}.</span>{" "}
              {label}
            </button>
          );
        })}
      </div>
      {myPick ? (
        <p className="mt-2 text-center text-xs text-slate-400">Choice locked — waiting for opponent…</p>
      ) : null}
    </div>
  );
}
