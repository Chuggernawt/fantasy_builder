"use client";

import { formBarBgClass, formBand, formDisplayValue } from "@/lib/instance-form";
import { fitnessPillClass, staminaDisplayValue } from "@/lib/squad-stamina";

/** Thick colour strip — form is read from colour only, no number. */
export function FormColorBar({
  value,
  className = "",
  height = "h-2.5",
}: {
  value: number;
  className?: string;
  height?: string;
}) {
  return (
    <div
      className={`w-full shrink-0 ${height} ${formBarBgClass(value)} ${className}`}
      title={`Form ${formDisplayValue(value)}`}
      role="img"
      aria-label={`Form ${formDisplayValue(value)}`}
    />
  );
}

/** Large coloured fitness percentage. */
export function FitnessPct({
  value,
  compact = false,
}: {
  value: number;
  compact?: boolean;
}) {
  const label = staminaDisplayValue(value);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-display font-bold leading-none ${fitnessPillClass(value)} ${
        compact ? "min-w-[2.25rem] px-1 py-0.5 text-[10px]" : "min-w-[2.75rem] px-1.5 py-1 text-xs"
      }`}
      title={`Fitness ${label}`}
    >
      {label}
    </span>
  );
}

/** Keys for form bars + fitness % — readable at a glance. */
export function PersistentMatchKey() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      <div className="min-w-[7rem] flex-1">
        <p className="mb-1 font-display text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          Form
        </p>
        <div className="flex h-3 overflow-hidden">
          <div className="flex-1 bg-red-500" title="Poor" />
          <div className="flex-1 bg-orange-500" title="Low" />
          <div className="flex-1 bg-slate-500" title="Neutral" />
          <div className="flex-1 bg-emerald-600" title="Good" />
          <div className="flex-1 bg-emerald-400" title="Hot" />
        </div>
        <div className="mt-1 flex justify-between font-display text-[10px] uppercase tracking-wide text-slate-400">
          <span>Poor</span>
          <span>Neutral</span>
          <span>Hot</span>
        </div>
      </div>
      <div className="min-w-[7rem] flex-1">
        <p className="mb-1 font-display text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          Fitness
        </p>
        <div className="flex h-3 overflow-hidden">
          <div className="flex-1 bg-red-500" />
          <div className="flex-1 bg-amber-400" />
          <div className="flex-1 bg-lime-500" />
          <div className="flex-1 bg-emerald-500" />
        </div>
        <div className="mt-1 flex justify-between font-display text-[10px] uppercase tracking-wide text-slate-400">
          <span>Low</span>
          <span>Fresh</span>
        </div>
      </div>
    </div>
  );
}

export function InjuryBadge({ label }: { label: string }) {
  return (
    <span
      className="shrink-0 border-2 border-red-500 bg-red-950 px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wide text-red-200"
      title={label}
    >
      Inj
    </span>
  );
}

/** @deprecated Use FormColorBar */
export function FormBadge({ value }: { value: number }) {
  return <FormColorBar value={value} height="h-2" className="max-w-[2.5rem]" />;
}

/** @deprecated Use PersistentMatchKey */
export function FormLegend({ compact: _compact = false }: { compact?: boolean }) {
  return <PersistentMatchKey />;
}

/** @deprecated Use FitnessPct */
export function StaminaBadge({ value }: { value: number }) {
  return <FitnessPct value={value} compact />;
}

/** @deprecated Use PersistentMatchKey */
export function StaminaLegend({ compact: _compact = false }: { compact?: boolean }) {
  return null;
}
