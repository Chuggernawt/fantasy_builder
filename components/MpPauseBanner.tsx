"use client";

import { useEffect, useState } from "react";
import type { MpPauseState } from "@/lib/multiplayer-types";
import { pauseTimeLeft } from "@/lib/multiplayer-match-flow";

interface MpPauseBannerProps {
  pause: MpPauseState;
  myReady: boolean;
  opponentReady: boolean;
  isHost: boolean;
  onHostStart?: () => void;
}

export function MpPauseBanner({
  pause,
  myReady,
  opponentReady,
  isHost,
  onHostStart,
}: MpPauseBannerProps) {
  const [secondsLeft, setSecondsLeft] = useState(() => pauseTimeLeft(pause));

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(pauseTimeLeft(pause));
    }, 500);
    return () => clearInterval(timer);
  }, [pause]);

  const label = pause.kind === "halftime" ? "Half time" : "Substitutions";
  const bothReady = myReady && opponentReady;

  return (
    <div className="glass-panel mb-2 shrink-0 border border-fuchsia-500/40 bg-fuchsia-950/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="broadcast-label text-[10px] text-fuchsia-300">Multiplayer pause</p>
          <p className="font-display text-sm font-bold uppercase text-slate-100">{label}</p>
        </div>
        <p className="font-mono text-lg text-broadcast-highlight">
          {bothReady ? "Both ready" : `${secondsLeft}s`}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
        <span className={myReady ? "text-broadcast-highlight" : ""}>
          You: {myReady ? "Ready" : "Choosing…"}
        </span>
        <span className={opponentReady ? "text-broadcast-highlight" : ""}>
          Opponent: {opponentReady ? "Ready" : "Choosing…"}
        </span>
      </div>
      {isHost && bothReady && onHostStart ? (
        <button type="button" className="btn-broadcast-solid mt-3 w-full text-xs" onClick={onHostStart}>
          Start now (both ready)
        </button>
      ) : null}
    </div>
  );
}
