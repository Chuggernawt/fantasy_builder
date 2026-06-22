"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { TeamTactics } from "@/lib/types";
import {
  BUILD_UP_OPTIONS,
  CHANCE_CREATION_OPTIONS,
  DEFENSIVE_SHAPE_OPTIONS,
  isCompleteTactics,
} from "@/lib/tactics";

interface TacticPickerProps {
  value: TeamTactics | null;
  disabled: boolean;
  onSelect: (tactics: TeamTactics) => void;
  prominent?: boolean;
  confirmLabel?: string;
  /** Hide the confirm button (e.g. when rendered in a sheet footer). */
  hideConfirm?: boolean;
}

interface TacticAxisRowsProps {
  draft: Partial<TeamTactics>;
  disabled: boolean;
  onUpdate: (patch: Partial<TeamTactics>) => void;
}

interface TacticConfirmButtonProps {
  draft: Partial<TeamTactics>;
  value: TeamTactics | null;
  disabled: boolean;
  confirmLabel: string;
  onSelect: (tactics: TeamTactics) => void;
}

interface TacticsSheetProps {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}

export function useTacticDraft(value: TeamTactics | null) {
  const [draft, setDraft] = useState<Partial<TeamTactics>>(value ?? {});

  useEffect(() => {
    setDraft(value ?? {});
  }, [value]);

  const ready = isCompleteTactics(draft);
  const unchanged =
    ready &&
    value &&
    draft.buildUp === value.buildUp &&
    draft.chanceCreation === value.chanceCreation &&
    draft.defensiveShape === value.defensiveShape;

  return {
    draft,
    updateDraft: (patch: Partial<TeamTactics>) => setDraft((prev) => ({ ...prev, ...patch })),
    ready,
    unchanged,
  };
}

function AxisRow({
  title,
  subtitle,
  options,
  selected,
  disabled,
  onPick,
}: {
  title: string;
  subtitle: string;
  options: readonly { id: string; label: string; hint: string }[];
  selected: string | undefined;
  disabled: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div className="rounded border border-broadcast-border/80 bg-black/40 p-2 sm:p-2.5">
      <div className="mb-1.5 sm:mb-2">
        <p className="font-display text-[11px] font-bold uppercase tracking-widest text-amber-300 sm:text-xs">
          {title}
        </p>
        <p className="text-[10px] leading-snug text-slate-500">{subtitle}</p>
      </div>
      {/* Single horizontal row — saves vertical space; scroll on narrow screens */}
      <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] sm:gap-2">
        {options.map((opt) => {
          const active = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onPick(opt.id)}
              className={`min-h-[4.25rem] w-[8.75rem] shrink-0 border px-2 py-2 text-left transition active:scale-[0.98] sm:min-h-[4.5rem] sm:w-[9.25rem] ${
                active
                  ? "border-broadcast-highlight bg-broadcast-highlight/20 shadow-[0_0_10px_rgba(234,179,8,0.2)]"
                  : "border-broadcast-border/70 bg-black/60 hover:border-broadcast-highlight/70 hover:bg-black/80 disabled:opacity-50"
              }`}
            >
              <p className="font-display text-[11px] font-semibold uppercase leading-tight text-broadcast-highlight sm:text-xs">
                {opt.label}
              </p>
              <p className="mt-1 text-[9px] leading-snug text-slate-400 sm:text-[10px]">{opt.hint}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TacticAxisRows({ draft, disabled, onUpdate }: TacticAxisRowsProps) {
  return (
    <div className="space-y-2 sm:space-y-2.5">
      <AxisRow
        title="Build-Up"
        subtitle="How you advance the ball in possession"
        options={BUILD_UP_OPTIONS}
        selected={draft.buildUp}
        disabled={disabled}
        onPick={(id) => onUpdate({ buildUp: id as TeamTactics["buildUp"] })}
      />
      <AxisRow
        title="Chance Creation"
        subtitle="Where you look to create and take chances"
        options={CHANCE_CREATION_OPTIONS}
        selected={draft.chanceCreation}
        disabled={disabled}
        onPick={(id) => onUpdate({ chanceCreation: id as TeamTactics["chanceCreation"] })}
      />
      <AxisRow
        title="Defensive Shape"
        subtitle="How you defend out of possession"
        options={DEFENSIVE_SHAPE_OPTIONS}
        selected={draft.defensiveShape}
        disabled={disabled}
        onPick={(id) => onUpdate({ defensiveShape: id as TeamTactics["defensiveShape"] })}
      />
    </div>
  );
}

export function TacticConfirmButton({
  draft,
  value,
  disabled,
  confirmLabel,
  onSelect,
}: TacticConfirmButtonProps) {
  const ready = isCompleteTactics(draft);
  const unchanged =
    ready &&
    value &&
    draft.buildUp === value.buildUp &&
    draft.chanceCreation === value.chanceCreation &&
    draft.defensiveShape === value.defensiveShape;

  return (
    <button
      type="button"
      disabled={disabled || !ready || !!unchanged}
      onClick={() => {
        if (isCompleteTactics(draft)) onSelect(draft);
      }}
      className="btn-broadcast w-full py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
    >
      {confirmLabel}
    </button>
  );
}

export function TacticsSheet({
  open,
  title,
  description,
  onClose,
  footer,
  children,
}: TacticsSheetProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tactics-sheet-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80"
        aria-label="Close tactics"
        onClick={onClose}
      />
      <div className="relative flex max-h-[min(94dvh,52rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl border border-broadcast-border bg-slate-950 shadow-2xl sm:rounded-lg">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-broadcast-border/80 px-3 py-3 sm:px-4">
          <div className="min-w-0">
            <p id="tactics-sheet-title" className="text-sm font-semibold text-slate-100 sm:text-base">
              {title}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500 sm:text-xs">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 border border-broadcast-border px-2 py-1 text-xs text-slate-400 hover:border-slate-500 hover:text-slate-200"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
          {children}
        </div>

        <div className="shrink-0 border-t border-broadcast-border/80 bg-slate-950/95 px-3 py-3 sm:px-4">
          {footer}
        </div>
      </div>
    </div>
  );
}

export function TacticPicker({
  value,
  disabled,
  onSelect,
  prominent = false,
  confirmLabel = "Lock in tactics",
  hideConfirm = false,
}: TacticPickerProps) {
  const { draft, updateDraft } = useTacticDraft(value);

  return (
    <div className={prominent ? "space-y-3" : "mt-3 space-y-3"}>
      {!prominent ? (
        <p className="text-xs uppercase tracking-wider text-slate-500">
          Pick one from each row — carries into the 2nd half unless you change at half time
        </p>
      ) : null}

      <TacticAxisRows draft={draft} disabled={disabled} onUpdate={updateDraft} />

      {!hideConfirm ? (
        <TacticConfirmButton
          draft={draft}
          value={value}
          disabled={disabled}
          confirmLabel={confirmLabel}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  );
}
