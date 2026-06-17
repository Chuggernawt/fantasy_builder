"use client";

import type { TacticalStyle } from "@/lib/types";
import { TACTICAL_OPTIONS } from "@/lib/match-influence";

interface TacticPickerProps {
  value: TacticalStyle | null;
  disabled: boolean;
  onSelect: (tactic: TacticalStyle) => void;
  prominent?: boolean;
}

export function TacticPicker({ value, disabled, onSelect, prominent = false }: TacticPickerProps) {
  return (
    <div className={prominent ? "" : "mt-4"}>
      {!prominent && (
        <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Tactic (once per half)</p>
      )}
      <div className={`grid gap-2 ${prominent ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
        {TACTICAL_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={disabled || value === opt.id}
            onClick={() => onSelect(opt.id)}
            className={`border text-left transition active:scale-[0.98] ${
              prominent ? "px-4 py-3" : "px-3 py-2"
            } ${
              value === opt.id
                ? "border-broadcast-highlight bg-broadcast-highlight/15"
                : "border-broadcast-border bg-black/60 hover:border-broadcast-highlight hover:bg-black/80 disabled:opacity-50"
            }`}
          >
            <p
              className={`font-display font-semibold uppercase tracking-wide text-broadcast-highlight ${
                prominent ? "text-sm" : "text-xs"
              }`}
            >
              {opt.label}
            </p>
            <p className={`mt-0.5 leading-snug text-slate-400 ${prominent ? "text-xs" : "text-[10px]"}`}>
              {opt.hint}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
