"use client";

interface MatchPossessionBarProps {
  homePct: number;
  awayPct: number;
  homeAccent: string;
  awayAccent: string;
  compact?: boolean;
}

export function MatchPossessionBar({
  homePct,
  awayPct,
  homeAccent,
  awayAccent,
  compact = false,
}: MatchPossessionBarProps) {
  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      <div className="mb-1 flex justify-between font-mono text-[10px] text-slate-400 md:text-xs">
        <span style={{ color: homeAccent }}>{homePct}%</span>
        <span className="uppercase tracking-wider text-slate-500">Possession</span>
        <span style={{ color: awayAccent }}>{awayPct}%</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-black/60 md:h-2">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${homePct}%`, backgroundColor: homeAccent }}
        />
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${awayPct}%`, backgroundColor: awayAccent }}
        />
      </div>
    </div>
  );
}
