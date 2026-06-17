"use client";

import { useState } from "react";
import type { ExtraTimeApproach } from "@/lib/types";
import { EXTRA_TIME_OPTIONS } from "@/lib/stoppage-time";

interface ExtraTimePanelProps {
  accent: string;
  teamName: string;
  addedMinutes: number;
  confirmLabel?: string;
  onConfirm: (approach: ExtraTimeApproach) => void;
}

export function ExtraTimePanel({
  accent,
  teamName,
  addedMinutes,
  confirmLabel = "Start added time",
  onConfirm,
}: ExtraTimePanelProps) {
  const [choice, setChoice] = useState<ExtraTimeApproach | null>(null);

  return (
    <div className="glass-panel mb-3 shrink-0 border border-amber-500/50 bg-amber-950/30 p-4">
      <p className="broadcast-label text-[10px] text-amber-300">Added time</p>
      <h2 className="font-display text-lg font-bold uppercase text-slate-100">
        {addedMinutes} minute{addedMinutes === 1 ? "" : "s"} added
      </h2>
      <p className="mt-1 text-sm text-slate-300">
        {teamName} — pick your approach for stoppage time. This choice lasts until the final
        whistle.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {EXTRA_TIME_OPTIONS.map((opt) => {
          const selected = choice === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setChoice(opt.id)}
              className={`flex min-h-[4rem] flex-col items-center justify-center border-2 px-2 py-2 text-center transition ${
                selected
                  ? "border-broadcast-highlight bg-broadcast-highlight/15"
                  : "border-broadcast-border bg-black/70 hover:border-broadcast-highlight"
              }`}
              style={selected ? { borderColor: accent } : undefined}
            >
              <span className="font-display text-xs font-bold uppercase tracking-wide text-broadcast-highlight">
                {opt.label}
              </span>
              <span className="mt-0.5 text-[9px] leading-snug text-slate-400">{opt.hint}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="btn-broadcast-solid mt-4 w-full sm:w-auto"
        disabled={!choice}
        onClick={() => {
          if (!choice) return;
          onConfirm(choice);
        }}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
